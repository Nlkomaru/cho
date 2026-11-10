import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { z } from "zod";

import { createDbClient } from "../db/client";
import { createMediaImageRepository } from "../repositories/media-image-repository";
import { createSignedImageUrl, getImage, verifySignedImageUrl } from "../services/image-storage";
import {
  discardUnassignedImage,
  ImageUploadError,
  MAX_IMAGE_BYTES,
  schedulePurge,
  storeImage,
} from "../services/media-images";
import type { ApiBindings } from "./index";

const SIGNED_URL_LIFETIME_SECONDS = 5 * 60;
const STORAGE_UNAVAILABLE = "Image storage is not available in this environment.";

/** Preview Workers are deployed without the production R2 binding. */
const hasImageStorage = (env: ApiBindings) => Boolean(env.IMAGES_BUCKET);

/** `executionCtx` throws outside a Worker request (tests); the purge is then skipped. */
export function waitUntilOf(context: {
  executionCtx: { waitUntil(promise: Promise<unknown>): void };
}): ((promise: Promise<unknown>) => void) | undefined {
  try {
    const executionContext = context.executionCtx;
    return (promise) => executionContext.waitUntil(promise);
  } catch {
    return undefined;
  }
}
const errorSchema = z.object({ error: z.string() }).strict();
const uploadResponseSchema = z
  .object({
    id: z.string(),
    contentType: z.string(),
    byteSize: z.number().int(),
    imageUrl: z.string().url(),
  })
  .strict();
const binaryResponseSchema = z.string().openapi({ type: "string", format: "binary" });

export const imageRoutes = new OpenAPIHono<{ Bindings: ApiBindings }>();

const uploadImageRoute = createRoute({
  method: "post",
  path: "/api/images/upload",
  summary: "Upload an image",
  description: `Upload an image file (maximum ${MAX_IMAGE_BYTES} bytes) to R2. The type is detected from the file content and must match the declared type. The image stays unassigned until a recipe or meal references it; unassigned images older than 24 hours are deleted.`,
  request: {
    body: {
      required: true,
      content: {
        "multipart/form-data": {
          schema: z.object({
            // A File, not a string: a string schema made the validator reject every upload.
            file: z
              .custom<File>(
                (value) => value instanceof File,
                "A multipart file upload is required.",
              )
              .openapi({ type: "string", format: "binary" }),
          }),
        },
      },
    },
  },
  responses: {
    201: {
      description: "Image stored with a short-lived signed URL.",
      content: { "application/json": { schema: uploadResponseSchema } },
    },
    400: {
      description: "Missing or invalid file upload.",
      content: { "application/json": { schema: errorSchema } },
    },
    413: {
      description: "Image exceeds the upload size limit.",
      content: { "application/json": { schema: errorSchema } },
    },
    415: {
      description: "Uploaded file is not an image.",
      content: { "application/json": { schema: errorSchema } },
    },
    500: {
      description: "Image upload failed.",
      content: { "application/json": { schema: errorSchema } },
    },
    503: {
      description: "Image storage is not bound (preview deployments).",
      content: { "application/json": { schema: errorSchema } },
    },
  },
});

imageRoutes.openapi(uploadImageRoute, async (context) => {
  let body: Record<string, unknown>;
  try {
    body = await context.req.parseBody();
  } catch {
    return context.json({ error: "A multipart file upload is required." }, 400);
  }
  const file = body.file;
  if (!(file instanceof File))
    return context.json({ error: "A multipart file upload is required." }, 400);
  if (file.size > MAX_IMAGE_BYTES)
    return context.json({ error: "Image exceeds the 10 MiB upload limit." }, 413);
  const encryptionKey = context.env.SETTINGS_ENCRYPTION_KEY;
  if (!encryptionKey) return context.json({ error: "Image signing is not configured." }, 500);
  if (!hasImageStorage(context.env)) return context.json({ error: STORAGE_UNAVAILABLE }, 503);

  const db = createDbClient(context.env.DB);
  try {
    const metadata = await storeImage({
      db,
      bucket: context.env.IMAGES_BUCKET,
      bytes: new Uint8Array(await file.arrayBuffer()),
      declaredType: file.type || null,
    });
    schedulePurge(db, context.env.IMAGES_BUCKET, waitUntilOf(context));
    const expiresAt = Math.floor(Date.now() / 1000) + SIGNED_URL_LIFETIME_SECONDS;
    const imageUrl = await createSignedImageUrl(
      new URL(context.req.url).origin,
      metadata.id,
      metadata.objectKey,
      expiresAt,
      encryptionKey,
    );
    return context.json(
      {
        id: metadata.id,
        contentType: metadata.contentType,
        byteSize: metadata.byteSize,
        imageUrl,
      },
      201,
    );
  } catch (error) {
    if (error instanceof ImageUploadError && error.status !== 409)
      return context.json({ error: error.message }, error.status);
    return context.json({ error: "Image upload failed." }, 500);
  }
});

const deleteImageRoute = createRoute({
  method: "delete",
  path: "/api/images/{id}",
  summary: "Delete an unused image",
  description:
    "Delete an uploaded image that is not attached to a recipe or meal. Attached images are released by saving the recipe or meal without them.",
  request: { params: z.object({ id: z.string().min(1).max(128) }).strict() },
  responses: {
    204: { description: "Image deleted." },
    404: {
      description: "Image not found.",
      content: { "application/json": { schema: errorSchema } },
    },
    409: {
      description: "Image is attached to a recipe or meal.",
      content: { "application/json": { schema: errorSchema } },
    },
  },
});

imageRoutes.openapi(deleteImageRoute, async (context) => {
  const { id } = context.req.valid("param");
  const result = await discardUnassignedImage(
    createDbClient(context.env.DB),
    context.env.IMAGES_BUCKET,
    id,
  );
  if (result === "not_found") return context.json({ error: "Image not found." }, 404);
  if (result === "attached")
    return context.json({ error: "Image is attached to a recipe or meal." }, 409);
  return context.body(null, 204);
});

const getImageRoute = createRoute({
  method: "get",
  path: "/api/images/{id}",
  summary: "Get an image",
  request: { params: z.object({ id: z.string().min(1).max(128) }).strict() },
  responses: {
    200: { description: "Image bytes.", content: { "image/*": { schema: binaryResponseSchema } } },
    302: { description: "Redirect to a short-lived signed image URL." },
    400: {
      description: "Malformed, invalid, or expired signature.",
      content: { "application/json": { schema: errorSchema } },
    },
    404: {
      description: "Image not found.",
      content: { "application/json": { schema: errorSchema } },
    },
    415: {
      description: "Stored object content type is not an image.",
      content: { "application/json": { schema: errorSchema } },
    },
    500: {
      description: "Image signing or retrieval failed.",
      content: { "application/json": { schema: errorSchema } },
    },
    503: {
      description: "Image storage is not bound (preview deployments).",
      content: { "application/json": { schema: errorSchema } },
    },
  },
});

imageRoutes.openapi(getImageRoute, async (context) => {
  const { id } = context.req.valid("param");
  const repository = createMediaImageRepository(createDbClient(context.env.DB));
  const metadata = await repository.getById(id);
  if (!metadata) return context.json({ error: "Image not found." }, 404);

  const encryptionKey = context.env.SETTINGS_ENCRYPTION_KEY;
  if (!encryptionKey) return context.json({ error: "Image signing is not configured." }, 500);
  const url = new URL(context.req.url);
  const hasExpiry = url.searchParams.has("expires");
  const hasSignature = url.searchParams.has("signature");
  if (hasExpiry !== hasSignature) {
    return context.json({ error: "Invalid image signature query." }, 400);
  }
  if (!hasExpiry) {
    try {
      const expiresAt = Math.floor(Date.now() / 1000) + SIGNED_URL_LIFETIME_SECONDS;
      const signedUrl = await createSignedImageUrl(
        url.origin,
        metadata.id,
        metadata.objectKey,
        expiresAt,
        encryptionKey,
      );
      return context.redirect(signedUrl, 302);
    } catch {
      return context.json({ error: "Image signing failed." }, 500);
    }
  }

  try {
    if (!(await verifySignedImageUrl(url, metadata.id, metadata.objectKey, encryptionKey))) {
      return context.json({ error: "Invalid or expired image signature." }, 400);
    }
  } catch {
    return context.json({ error: "Image signature verification failed." }, 500);
  }
  if (!hasImageStorage(context.env)) return context.json({ error: STORAGE_UNAVAILABLE }, 503);
  try {
    const image = await getImage(context.env.IMAGES_BUCKET, metadata.objectKey);
    if (!image) return context.json({ error: "Image not found." }, 404);
    const contentType = image.httpMetadata?.contentType ?? metadata.contentType;
    if (!contentType.toLowerCase().startsWith("image/")) {
      return context.json({ error: "Image content type is invalid." }, 415);
    }
    return new Response(image.body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(metadata.byteSize),
        "Cache-Control": "private, max-age=300",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return context.json({ error: "Image retrieval failed." }, 500);
  }
});
