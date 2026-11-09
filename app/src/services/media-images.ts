import type { createDbClient } from "../db/client";
import { isSupportedImageType, MAX_IMAGE_BYTES, type SupportedImageType } from "../domain/image";
import {
  createMediaImageRepository,
  type MediaImage,
} from "../repositories/media-image-repository";
import { deleteImage, putImage } from "./image-storage";

type Database = ReturnType<typeof createDbClient>;

export { MAX_IMAGE_BYTES, MAX_INLINE_IMAGE_BYTES } from "../domain/image";

/** Upload failure with the HTTP status the REST route should answer with. */
export class ImageUploadError extends Error {
  override name = "ImageUploadError";
  constructor(
    message: string,
    readonly status: 400 | 409 | 413 | 415,
  ) {
    super(message);
  }
}

const unsupportedTypeMessage = "Only JPEG, PNG, WebP, GIF, and AVIF images are accepted.";

function startsWith(bytes: Uint8Array, signature: readonly number[], offset = 0): boolean {
  return signature.every((value, index) => bytes[offset + index] === value);
}

const ascii = (text: string) => [...text].map((char) => char.charCodeAt(0));

/** Detects the image type from the file signature instead of trusting the declared type. */
export function sniffImageType(bytes: Uint8Array): SupportedImageType | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (startsWith(bytes, ascii("GIF87a")) || startsWith(bytes, ascii("GIF89a"))) return "image/gif";
  if (startsWith(bytes, ascii("RIFF")) && startsWith(bytes, ascii("WEBP"), 8)) return "image/webp";
  if (startsWith(bytes, ascii("ftyp"), 4)) {
    const brand = String.fromCharCode(...bytes.slice(8, 12));
    if (brand === "avif" || brand === "avis") return "image/avif";
  }
  return null;
}

/** Reads a body stream, failing as soon as it grows past `maxBytes`. */
export async function readLimited(
  body: ReadableStream<Uint8Array> | null,
  maxBytes: number,
): Promise<Uint8Array> {
  if (!body) return new Uint8Array();
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined);
      throw new ImageUploadError(tooLargeMessage(maxBytes), 413);
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

function tooLargeMessage(maxBytes: number): string {
  return `Image exceeds the ${maxBytes / 1024 / 1024} MiB upload limit.`;
}

export interface StoreImageInput {
  db: Database;
  bucket: R2Bucket;
  bytes: Uint8Array;
  /** Type the client claimed. When set, the sniffed type must match it. */
  declaredType?: string | null;
  /** Pre-issued image ID (signed MCP uploads); a new UUID otherwise. */
  id?: string;
  maxBytes?: number;
}

/**
 * Validates the bytes, stores them in R2 and records an unassigned media image.
 * The R2 object is removed again when the row cannot be written.
 */
export async function storeImage({
  db,
  bucket,
  bytes,
  declaredType,
  id = crypto.randomUUID(),
  maxBytes = MAX_IMAGE_BYTES,
}: StoreImageInput): Promise<MediaImage> {
  if (bytes.byteLength === 0) throw new ImageUploadError("Uploaded file must not be empty.", 400);
  if (bytes.byteLength > maxBytes) throw new ImageUploadError(tooLargeMessage(maxBytes), 413);
  const declared = declaredType?.split(";")[0]?.trim().toLowerCase() || null;
  if (declared !== null && !isSupportedImageType(declared))
    throw new ImageUploadError(unsupportedTypeMessage, 415);
  const contentType = sniffImageType(bytes);
  if (!contentType) throw new ImageUploadError(unsupportedTypeMessage, 415);
  if (declared !== null && declared !== contentType)
    throw new ImageUploadError(
      `The file content is ${contentType}, not the declared ${declared}.`,
      415,
    );

  const repository = createMediaImageRepository(db);
  const objectKey = `images/${crypto.randomUUID()}`;
  await putImage(bucket, objectKey, bytes, contentType);
  try {
    return await repository.create({
      id,
      targetType: "unassigned",
      targetId: "unassigned",
      objectKey,
      contentType,
      byteSize: bytes.byteLength,
      width: null,
      height: null,
      blurhash: null,
      caption: null,
      sortOrder: 0,
    });
  } catch (error) {
    await deleteImage(bucket, objectKey).catch(() => undefined);
    throw error;
  }
}

/** Deletes an image that is not attached to anything. */
export async function discardUnassignedImage(
  db: Database,
  bucket: R2Bucket,
  id: string,
): Promise<"deleted" | "not_found" | "attached"> {
  const repository = createMediaImageRepository(db);
  const image = await repository.getById(id);
  if (!image) return "not_found";
  const [deleted] = await repository.deleteUnassigned([id]);
  if (!deleted) return "attached";
  await deleteImage(bucket, deleted.objectKey).catch(() => undefined);
  return "deleted";
}

/**
 * Removes unassigned images older than the grace period: uploads that were never saved
 * and images detached from a recipe or meal. Rows go first, so an image claimed in the
 * meantime is kept; a failed R2 delete only leaves an unreachable object.
 */
export async function purgeStaleUnassignedImages(
  db: Database,
  bucket: R2Bucket,
  { olderThanHours = 24, limit = 20 }: { olderThanHours?: number; limit?: number } = {},
): Promise<number> {
  const repository = createMediaImageRepository(db);
  const stale = await repository.listStaleUnassigned(olderThanHours, limit);
  const deleted = await repository.deleteUnassigned(stale.map((image) => image.id));
  await Promise.allSettled(deleted.map((image) => deleteImage(bucket, image.objectKey)));
  return deleted.length;
}

/** Runs the purge after the response without failing the request. */
export function schedulePurge(
  db: Database,
  bucket: R2Bucket,
  waitUntil: ((promise: Promise<unknown>) => void) | undefined,
): void {
  const task = purgeStaleUnassignedImages(db, bucket).catch((error: unknown) => {
    console.warn("Stale image purge failed", error);
  });
  waitUntil?.(task);
}
