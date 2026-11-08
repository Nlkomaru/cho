import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { z } from "zod";

import { createDbClient } from "../db/client";
import { createMediaImageRepository } from "../repositories/media-image-repository";
import {
  createSignedImageUrl,
  deleteImage,
  getImage,
  putImage,
  verifySignedImageUrl,
} from "../services/image-storage";
import type { ApiBindings } from "./index";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const SIGNED_URL_LIFETIME_SECONDS = 5 * 60;

const SUPPORTED_IMAGE_TYPES: Record<string, true> = {
  "image/jpeg": true,
  "image/png": true,
  "image/webp": true,
  "image/gif": true,
  "image/avif": true,
};
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
  description: `Upload an image file (maximum ${MAX_IMAGE_BYTES} bytes) to R2.`,
  request: {
    body: {
      required: true,
      content: {
        "multipart/form-data": {
          schema: z.object({
            file: z.string().openapi({ type: "string", format: "binary" }),
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
  if (!Object.hasOwn(SUPPORTED_IMAGE_TYPES, file.type.toLowerCase())) {
    return context.json({ error: "Only JPEG, PNG, WebP, GIF, and AVIF images are accepted." }, 415);
  }
  if (file.size === 0) return context.json({ error: "Uploaded file must not be empty." }, 400);
  if (file.size > MAX_IMAGE_BYTES)
    return context.json({ error: "Image exceeds the 10 MiB upload limit." }, 413);
  const encryptionKey = context.env.SETTINGS_ENCRYPTION_KEY;
  if (!encryptionKey) return context.json({ error: "Image signing is not configured." }, 500);

  const id = crypto.randomUUID();
  const objectKey = `images/${crypto.randomUUID()}`;
  const db = createDbClient(context.env.DB);
  const repository = createMediaImageRepository(db);
  let stored = false;
  try {
    await putImage(context.env.IMAGES_BUCKET, objectKey, file.stream(), file.type);
    stored = true;
    const metadata = await repository.create({
      id,
      targetType: "unassigned",
      targetId: "unassigned",
      objectKey,
      contentType: file.type,
      byteSize: file.size,
      sortOrder: 0,
    });
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
  } catch {
    if (stored) {
      try {
        await deleteImage(context.env.IMAGES_BUCKET, objectKey);
      } catch {
        // Preserve the safe upload error response if cleanup also fails.
      }
    }
    return context.json({ error: "Image upload failed." }, 500);
  }
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
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return context.json({ error: "Image retrieval failed." }, 500);
  }
});
