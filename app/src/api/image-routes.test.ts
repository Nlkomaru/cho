import { afterEach, describe, expect, test } from "vite-plus/test";
import { z } from "zod";

import { verifySignedUploadUrl } from "../services/image-storage";
import { purgeStaleUnassignedImages, sniffImageType } from "../services/media-images";
import { createTestD1Harness, type TestD1Harness } from "../tests/test-harness";
import { api } from "./index";

const key = btoa("image-route-fixture".padEnd(32, "0"));
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46]);
const ascii = (text: string) => [...text].map((char) => char.charCodeAt(0));

function memoryBucket() {
  const objects = new Map<string, { bytes: Uint8Array; contentType?: string }>();
  const bucket = {
    async put(
      key: string,
      body: Uint8Array | ReadableStream,
      options?: { httpMetadata?: { contentType?: string } },
    ) {
      const bytes =
        body instanceof Uint8Array ? body : new Uint8Array(await new Response(body).arrayBuffer());
      objects.set(key, { bytes, contentType: options?.httpMetadata?.contentType });
      return {};
    },
    async get(key: string) {
      const object = objects.get(key);
      if (!object) return null;
      return {
        body: new Response(object.bytes).body,
        httpMetadata: { contentType: object.contentType },
      };
    },
    async delete(key: string) {
      objects.delete(key);
    },
  } as unknown as R2Bucket;
  return { objects, bucket };
}

let harness: TestD1Harness;
let objects: ReturnType<typeof memoryBucket>["objects"];
afterEach(() => harness?.cleanup());

function setup() {
  harness = createTestD1Harness();
  const memory = memoryBucket();
  objects = memory.objects;
  Object.assign(harness.env, { IMAGES_BUCKET: memory.bucket, SETTINGS_ENCRYPTION_KEY: key });
}

async function upload(bytes: Uint8Array, type: string) {
  const form = new FormData();
  form.set("file", new File([bytes], "photo", { type }));
  const response = await api.fetch(
    new Request("http://localhost/api/images/upload", { method: "POST", body: form }),
    harness.env,
  );
  return { response, body: (await response.json()) as Record<string, unknown> };
}

function imageRow(id: string) {
  return harness.sqlite
    .prepare("SELECT target_type, target_id FROM media_images WHERE id = ?")
    .get(id) as { target_type: string; target_id: string } | undefined;
}

const structured = (body: { result?: Record<string, unknown> }) => body.result?.structuredContent;
const resultText = (body: { result?: Record<string, unknown> }) => JSON.stringify(body.result);

describe("image type sniffing", () => {
  test("detects supported formats from their signatures", () => {
    expect(sniffImageType(png)).toBe("image/png");
    expect(sniffImageType(jpeg)).toBe("image/jpeg");
    expect(sniffImageType(new Uint8Array(ascii("GIF89a....")))).toBe("image/gif");
    expect(sniffImageType(new Uint8Array(ascii("RIFF\0\0\0\0WEBPVP8 ")))).toBe("image/webp");
    expect(sniffImageType(new Uint8Array([0, 0, 0, 28, ...ascii("ftypavif")]))).toBe("image/avif");
    expect(sniffImageType(new Uint8Array(ascii("<svg></svg>")))).toBeNull();
  });
});

describe("REST image routes", () => {
  test("upload stores the sniffed type and rejects content that does not match", async () => {
    setup();
    const stored = await upload(png, "image/png");
    expect(stored.response.status).toBe(201);
    expect(stored.body).toMatchObject({ contentType: "image/png", byteSize: png.byteLength });
    expect(objects.size).toBe(1);

    const mismatch = await upload(png, "image/jpeg");
    expect(mismatch.response.status).toBe(415);
    const notImage = await upload(new Uint8Array(ascii("hello")), "image/png");
    expect(notImage.response.status).toBe(415);
    const empty = await upload(new Uint8Array(), "image/png");
    expect(empty.response.status).toBe(400);
    expect(objects.size).toBe(1);
    expect(harness.sqlite.prepare("SELECT COUNT(*) AS count FROM media_images").get()).toEqual({
      count: 1,
    });
  });

  test("signed reads are cacheable for the signature lifetime", async () => {
    setup();
    const { body } = await upload(jpeg, "image/jpeg");
    const redirect = await api.fetch(
      new Request(`http://localhost/api/images/${String(body.id)}`),
      harness.env,
    );
    expect(redirect.status).toBe(302);
    const image = await api.fetch(new Request(redirect.headers.get("Location") ?? ""), harness.env);
    expect(image.status).toBe(200);
    expect(image.headers.get("Cache-Control")).toBe("private, max-age=300");
    expect(new Uint8Array(await image.arrayBuffer())).toEqual(jpeg);
  });

  test("DELETE removes unassigned images only", async () => {
    setup();
    const first = String((await upload(png, "image/png")).body.id);
    const second = String((await upload(jpeg, "image/jpeg")).body.id);
    harness.sqlite
      .prepare("UPDATE media_images SET target_type = 'dish', target_id = 'd1' WHERE id = ?")
      .run(second);

    const remove = (id: string) =>
      api.fetch(
        new Request(`http://localhost/api/images/${id}`, { method: "DELETE" }),
        harness.env,
      );
    expect((await remove(first)).status).toBe(204);
    expect(imageRow(first)).toBeUndefined();
    expect((await remove(first)).status).toBe(404);
    expect((await remove(second)).status).toBe(409);
    expect(imageRow(second)).toEqual({ target_type: "dish", target_id: "d1" });
    expect(objects.size).toBe(1);
  });

  test("purge deletes only stale unassigned images and their objects", async () => {
    setup();
    const insert = (id: string, target: string, age: string) => {
      harness.sqlite
        .prepare(
          `INSERT INTO media_images (id, target_type, target_id, object_key, content_type, byte_size, created_at)
           VALUES (?, ?, ?, ?, 'image/png', 10, datetime('now', ?))`,
        )
        .run(id, target, target === "dish" ? "d1" : target, `images/${id}`, age);
      objects.set(`images/${id}`, { bytes: png });
    };
    insert("stale", "unassigned", "-2 days");
    insert("fresh", "unassigned", "-1 hours");
    insert("attached", "dish", "-30 days");

    expect(await purgeStaleUnassignedImages(harness.db, harness.env.IMAGES_BUCKET)).toBe(1);
    expect(imageRow("stale")).toBeUndefined();
    expect(imageRow("fresh")).toBeDefined();
    expect(imageRow("attached")).toBeDefined();
    expect([...objects.keys()].sort()).toEqual(["images/attached", "images/fresh"]);
  });
});

describe("MCP image tools", () => {
  const imageTools = [
    "create_ingredient",
    "create_recipe",
    "upload_image",
    "create_image_upload",
    "set_recipe_images",
  ];
  const ingredient = {
    name: "Rice",
    baseDimension: "mass",
    baseUnit: "g",
    nutritionBasisAmount: 100,
    nutritionPerBasis: {
      caloriesKcal: 350,
      proteinG: 6,
      fatG: 1,
      carbohydrateG: 78,
      fiberG: 1,
      saltEquivalentG: 0,
      micronutrients: [],
    },
  };
  const recipe = (ingredientId: string, coverImageId: string | null, stepImageIds: string[]) => ({
    name: "Rice bowl",
    servings: 1,
    coverImageId,
    recipe: {
      ingredients: [
        { id: "rice", ingredientId, name: "Rice", amount: 100, unit: "g", displayAmount: "100 g" },
      ],
      steps: [
        {
          id: "cook",
          stepNumber: 1,
          phase: "cook",
          title: "Cook",
          instruction: "Cook the rice.",
          executionMode: "active",
          timing: { activeDurationSec: 60 },
          inputs: [{ type: "ingredient", ingredientEntryId: "rice" }],
          imageIds: stepImageIds,
        },
      ],
    },
  });
  const imageResult = z.object({ imageId: z.uuid(), contentType: z.string() });

  async function uploadBase64(secret: string, bytes: Uint8Array) {
    const result = await harness.callMcp(secret, "upload_image", {
      data: btoa(String.fromCharCode(...bytes)),
    });
    return imageResult.parse(structured(result.body)).imageId;
  }

  test("upload_image and set_recipe_images attach cover and step images", async () => {
    setup();
    const { secret } = await harness.issueToken(imageTools);
    const ingredientId = z
      .object({ ingredient: z.object({ id: z.string() }) })
      .parse(structured((await harness.callMcp(secret, "create_ingredient", ingredient)).body))
      .ingredient.id;
    const cover = await uploadBase64(secret, png);
    const step = await uploadBase64(secret, jpeg);
    expect(objects.size).toBe(2);

    const created = await harness.callMcp(
      secret,
      "create_recipe",
      recipe(ingredientId, cover, [step]),
    );
    const recipeId = z
      .object({ recipe: z.object({ id: z.string() }) })
      .parse(structured(created.body)).recipe.id;
    expect(imageRow(cover)).toEqual({ target_type: "dish", target_id: recipeId });
    expect(imageRow(step)).toEqual({ target_type: "dish", target_id: recipeId });

    const reused = await harness.callMcp(secret, "create_recipe", recipe(ingredientId, cover, []));
    expect(reused.body.result?.isError).toBe(true);
    expect(resultText(reused.body)).toContain("attached to another recipe or meal");
    const missing = await harness.callMcp(
      secret,
      "create_recipe",
      recipe(ingredientId, "44444444-4444-4444-8444-444444444444", []),
    );
    expect(resultText(missing.body)).toContain("Image not found");

    const moved = await harness.callMcp(secret, "set_recipe_images", {
      recipeId,
      coverImageId: step,
      stepImages: { cook: [] },
    });
    expect(structured(moved.body)).toMatchObject({
      recipe: { coverImageId: step, recipe: { steps: [{ imageIds: [] }] } },
    });
    expect(imageRow(cover)?.target_type).toBe("unassigned");
    const unknownStep = await harness.callMcp(secret, "set_recipe_images", {
      recipeId,
      stepImages: { nope: [cover] },
    });
    expect(resultText(unknownStep.body)).toContain("Unknown step: nope");
  });

  test("upload_image enforces the inline size cap, https URLs, and declared type", async () => {
    setup();
    const { secret } = await harness.issueToken(imageTools);
    const tooLarge = await harness.callMcp(secret, "upload_image", {
      data: "A".repeat(2_796_204),
    });
    expect(tooLarge.body.result?.isError ?? tooLarge.body.error).toBeTruthy();
    const plainHttp = await harness.callMcp(secret, "upload_image", {
      url: "http://example.com/a.png",
    });
    expect(plainHttp.body.result?.isError ?? plainHttp.body.error).toBeTruthy();
    const mismatch = await harness.callMcp(secret, "upload_image", {
      data: btoa(String.fromCharCode(...png)),
      contentType: "image/jpeg",
    });
    expect(resultText(mismatch.body)).toContain("not the declared image/jpeg");
    expect(objects.size).toBe(0);
  });

  test("create_image_upload issues a single-use signed PUT URL", async () => {
    setup();
    const { secret } = await harness.issueToken(imageTools);
    const issue = async () =>
      z
        .object({ imageId: z.uuid(), uploadUrl: z.string(), method: z.literal("PUT") })
        .parse(
          structured(
            (await harness.callMcp(secret, "create_image_upload", { contentType: "image/jpeg" }))
              .body,
          ),
        );
    const put = (url: string, body: Uint8Array) =>
      api.fetch(
        new Request(url, { method: "PUT", body, headers: { "Content-Type": "image/jpeg" } }),
        harness.env,
      );

    const ticket = await issue();
    expect(ticket.uploadUrl).toMatch(/^http:\/\/localhost\/api\/mcp\/uploads\//);
    const tampered = new URL(ticket.uploadUrl);
    tampered.searchParams.set("contentType", "image/png");
    expect((await put(tampered.toString(), png)).status).toBe(403);

    const stored = await put(ticket.uploadUrl, jpeg);
    expect(stored.status).toBe(201);
    expect(await stored.json()).toMatchObject({
      imageId: ticket.imageId,
      contentType: "image/jpeg",
    });
    expect(imageRow(ticket.imageId)).toEqual({
      target_type: "unassigned",
      target_id: "unassigned",
    });
    expect((await put(ticket.uploadUrl, jpeg)).status).toBe(409);

    const second = await issue();
    expect((await put(second.uploadUrl, png)).status).toBe(415);
    expect(imageRow(second.imageId)).toBeUndefined();
    expect(
      await verifySignedUploadUrl(second.uploadUrl, second.imageId, key, Date.now() + 11 * 60_000),
    ).toBeNull();
  });

  test("image tools are hidden from tokens without the grant", async () => {
    setup();
    const { secret } = await harness.issueToken(["list_recipes"]);
    const denied = await harness.callMcp(secret, "upload_image", {
      data: btoa(String.fromCharCode(...png)),
    });
    expect(denied.body.result?.isError ?? denied.body.error).toBeTruthy();
    expect(objects.size).toBe(0);
  });
});
