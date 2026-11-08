import { signImageUrl, verifyImageUrlSignature } from "./crypto";

const IMAGE_API_PATH = "/api/images/";
const EXPIRY_QUERY = "expires";
const SIGNATURE_QUERY = "signature";

export async function putImage(
  bucket: R2Bucket,
  objectKey: string,
  body: ReadableStream | ArrayBuffer | ArrayBufferView | string | Blob,
  contentType: string,
): Promise<void> {
  assertObjectKey(objectKey);
  await bucket.put(objectKey, body, {
    httpMetadata: { contentType },
  });
}

export async function getImage(bucket: R2Bucket, objectKey: string): Promise<R2ObjectBody | null> {
  assertObjectKey(objectKey);
  return bucket.get(objectKey);
}

export async function deleteImage(bucket: R2Bucket, objectKey: string): Promise<void> {
  assertObjectKey(objectKey);
  await bucket.delete(objectKey);
}

export async function createSignedImageUrl(
  publicOrigin: string | URL,
  imageId: string,
  objectKey: string,
  expiresAt: number,
  settingsEncryptionKey: string,
): Promise<string> {
  assertImageId(imageId);
  assertObjectKey(objectKey);
  const url = new URL(`${IMAGE_API_PATH}${encodeURIComponent(imageId)}`, publicOrigin);
  const signature = await signImageUrl(objectKey, expiresAt, settingsEncryptionKey);
  url.searchParams.set(EXPIRY_QUERY, String(expiresAt));
  url.searchParams.set(SIGNATURE_QUERY, signature);
  return url.toString();
}

export async function verifySignedImageUrl(
  requestUrl: string | URL,
  expectedImageId: string,
  objectKey: string,
  settingsEncryptionKey: string,
  now: number = Date.now(),
): Promise<boolean> {
  assertImageId(expectedImageId);
  assertObjectKey(objectKey);
  let url: URL;
  try {
    url = new URL(requestUrl);
  } catch {
    return false;
  }

  if (url.pathname !== `${IMAGE_API_PATH}${encodeURIComponent(expectedImageId)}`) {
    return false;
  }

  const expiries = url.searchParams.getAll(EXPIRY_QUERY);
  const signatures = url.searchParams.getAll(SIGNATURE_QUERY);
  if (expiries.length !== 1 || signatures.length !== 1 || !/^\d+$/.test(expiries[0])) {
    return false;
  }
  const expiresAt = Number(expiries[0]);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= 0) return false;

  return verifyImageUrlSignature(objectKey, expiresAt, signatures[0], settingsEncryptionKey, now);
}

function assertImageId(imageId: string): void {
  if (!imageId || imageId.includes("/") || imageId.includes("\n")) {
    throw new Error("Image ID must be a non-empty path segment without newlines.");
  }
}

function assertObjectKey(objectKey: string): void {
  if (!objectKey || objectKey.startsWith("/") || objectKey.includes("\n")) {
    throw new Error("Image object key must be a non-empty relative path without newlines.");
  }
}
