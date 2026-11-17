import { eq } from "drizzle-orm";

import { createDbClient } from "../db/client";
import { mediaImages } from "../db/schema";
import { getImage, putImage } from "./image-storage";

type Database = ReturnType<typeof createDbClient>;

export interface ImageOptimizeMessage {
  imageId: string;
}

export interface ImageOptimizeEnv {
  DB: D1Database;
  IMAGES_BUCKET?: R2Bucket;
  IMAGES?: ImagesBinding;
}

export type OptimizeImageResult =
  | { status: "missing" }
  | { status: "skipped" }
  | { status: "kept" }
  | { status: "optimized"; beforeBytes: number; afterBytes: number };

const OPTIMIZABLE_MAX_DIMENSION = 1600;
const WEBP_QUALITY = 82;

export function shouldOptimizeImageType(contentType: string): boolean {
  return contentType !== "image/webp" && contentType !== "image/avif";
}

export async function enqueueImageOptimization(
  queue: Queue<ImageOptimizeMessage> | undefined,
  image: { id: string; contentType: string },
): Promise<void> {
  if (!queue || !shouldOptimizeImageType(image.contentType)) return;
  await queue.send({ imageId: image.id });
}

/**
 * Resizes (max 1600px) and re-encodes a stored R2 image to WebP via Cloudflare Images,
 * replacing the R2 object in place and updating `media_images` metadata if smaller.
 */
export async function optimizeStoredImage({
  db,
  bucket,
  images,
  imageId,
}: {
  db: Database;
  bucket: R2Bucket;
  images: ImagesBinding;
  imageId: string;
}): Promise<OptimizeImageResult> {
  const [row] = await db
    .select({
      id: mediaImages.id,
      objectKey: mediaImages.objectKey,
      contentType: mediaImages.contentType,
      byteSize: mediaImages.byteSize,
    })
    .from(mediaImages)
    .where(eq(mediaImages.id, imageId))
    .limit(1);
  if (!row) return { status: "missing" };
  if (!shouldOptimizeImageType(row.contentType)) return { status: "skipped" };

  const object = await getImage(bucket, row.objectKey);
  if (!object) return { status: "missing" };

  const transformed = await images
    .input(object.body)
    .transform({
      width: OPTIMIZABLE_MAX_DIMENSION,
      height: OPTIMIZABLE_MAX_DIMENSION,
      fit: "scale-down",
    })
    .output({
      format: "image/webp",
      quality: WEBP_QUALITY,
    });
  const response = transformed.response();
  const optimizedBytes = new Uint8Array(await response.arrayBuffer());

  if (optimizedBytes.byteLength === 0 || optimizedBytes.byteLength >= row.byteSize) {
    return { status: "kept" };
  }

  await putImage(bucket, row.objectKey, optimizedBytes, "image/webp");
  await db
    .update(mediaImages)
    .set({
      contentType: "image/webp",
      byteSize: optimizedBytes.byteLength,
    })
    .where(eq(mediaImages.id, row.id));

  return {
    status: "optimized",
    beforeBytes: row.byteSize,
    afterBytes: optimizedBytes.byteLength,
  };
}

export async function handleImageOptimizeQueue(
  batch: MessageBatch<ImageOptimizeMessage>,
  env: ImageOptimizeEnv,
): Promise<void> {
  if (!env.IMAGES_BUCKET || !env.IMAGES) {
    for (const message of batch.messages) message.ack();
    return;
  }
  const db = createDbClient(env.DB);
  for (const message of batch.messages) {
    try {
      await optimizeStoredImage({
        db,
        bucket: env.IMAGES_BUCKET,
        images: env.IMAGES,
        imageId: message.body.imageId,
      });
      message.ack();
    } catch (error) {
      console.error(`Failed to optimize image ${message.body.imageId}:`, error);
      message.retry();
    }
  }
}
