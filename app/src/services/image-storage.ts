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

const UPLOAD_API_PATH = "/api/mcp/uploads/";
const CONTENT_TYPE_QUERY = "contentType";

// Upload signatures cover a path outside `images/`, so a read signature (which signs the
// R2 object key) can never be replayed as an upload signature or the other way round.
function uploadSigningPath(imageId: string, contentType: string): string {
  return `uploads/${imageId}/${contentType}`;
}

/** URL that lets a client without an MCP byte channel PUT one image with a pre-issued ID. */
export async function createSignedUploadUrl(
  publicOrigin: string | URL,
  imageId: string,
  contentType: string,
  expiresAt: number,
  settingsEncryptionKey: string,
): Promise<string> {
  assertImageId(imageId);
  const url = new URL(`${UPLOAD_API_PATH}${encodeURIComponent(imageId)}`, publicOrigin);
  const signature = await signImageUrl(
    uploadSigningPath(imageId, contentType),
    expiresAt,
    settingsEncryptionKey,
  );
  url.searchParams.set(CONTENT_TYPE_QUERY, contentType);
  url.searchParams.set(EXPIRY_QUERY, String(expiresAt));
  url.searchParams.set(SIGNATURE_QUERY, signature);
  return url.toString();
}

/** Returns the signed content type when the upload URL is valid and unexpired, else null. */
export async function verifySignedUploadUrl(
  requestUrl: string | URL,
  expectedImageId: string,
  settingsEncryptionKey: string,
  now: number = Date.now(),
): Promise<string | null> {
  assertImageId(expectedImageId);
  let url: URL;
  try {
    url = new URL(requestUrl);
  } catch {
    return null;
  }
  if (url.pathname !== `${UPLOAD_API_PATH}${encodeURIComponent(expectedImageId)}`) return null;
  const contentTypes = url.searchParams.getAll(CONTENT_TYPE_QUERY);
  const expiries = url.searchParams.getAll(EXPIRY_QUERY);
  const signatures = url.searchParams.getAll(SIGNATURE_QUERY);
  if (
    contentTypes.length !== 1 ||
    expiries.length !== 1 ||
    signatures.length !== 1 ||
    !/^image\/[a-z0-9.+-]+$/.test(contentTypes[0]) ||
    !/^\d+$/.test(expiries[0])
  )
    return null;
  const expiresAt = Number(expiries[0]);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= 0) return null;
  const valid = await verifyImageUrlSignature(
    uploadSigningPath(expectedImageId, contentTypes[0]),
    expiresAt,
    signatures[0],
    settingsEncryptionKey,
    now,
  );
  return valid ? contentTypes[0] : null;
}
