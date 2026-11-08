const ENCRYPTED_PAYLOAD_VERSION = "v1";
const AES_GCM_IV_BYTES = 12;
const AES_KEY_BYTES = 32;
const IMAGE_SIGNATURE_CONTEXT = "cho:image-url:v1";

/**
 * Stored format: `v1.<base64url IV>.<base64url AES-GCM ciphertext and tag>`.
 * The 96-bit IV is stored with each ciphertext; SETTINGS_ENCRYPTION_KEY must
 * be a canonical standard-Base64 encoding of exactly 32 bytes.
 */
export async function encryptSecret(
  plaintext: string,
  settingsEncryptionKey: string,
): Promise<string> {
  const key = await importAesKey(settingsEncryptionKey, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(AES_GCM_IV_BYTES));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(plaintext),
  );

  return `${ENCRYPTED_PAYLOAD_VERSION}.${encodeBase64Url(iv)}.${encodeBase64Url(new Uint8Array(ciphertext))}`;
}

export async function decryptSecret(
  encryptedPayload: string,
  settingsEncryptionKey: string,
): Promise<string> {
  const key = await importAesKey(settingsEncryptionKey, ["decrypt"]);
  const parts = encryptedPayload.split(".");
  if (parts.length !== 3 || parts[0] !== ENCRYPTED_PAYLOAD_VERSION) {
    throw new Error("Encrypted secret must use the v1 payload format.");
  }

  const iv = decodeBase64Url(parts[1], "encrypted payload IV");
  const ciphertext = decodeBase64Url(parts[2], "encrypted payload ciphertext");
  if (iv.byteLength !== AES_GCM_IV_BYTES || ciphertext.byteLength < 16) {
    throw new Error("Encrypted secret has an invalid IV or ciphertext length.");
  }

  try {
    const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
    return new TextDecoder("utf-8", { fatal: true }).decode(plaintext);
  } catch {
    throw new Error("Encrypted secret authentication or UTF-8 decoding failed.");
  }
}

/** Signs an object path and Unix expiry (seconds) with HMAC-SHA-256. */
export async function signImageUrl(
  objectPath: string,
  expiresAt: number,
  settingsEncryptionKey: string,
): Promise<string> {
  assertSigningInput(objectPath, expiresAt);
  const key = await importHmacKey(settingsEncryptionKey, ["sign"]);
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(signatureMessage(objectPath, expiresAt)),
  );
  return encodeBase64Url(new Uint8Array(signature));
}

/** Returns false for expired URLs, malformed signatures, or mismatches. */
export async function verifyImageUrlSignature(
  objectPath: string,
  expiresAt: number,
  signature: string,
  settingsEncryptionKey: string,
  now: number = Date.now(),
): Promise<boolean> {
  assertSigningInput(objectPath, expiresAt);
  if (!Number.isFinite(now) || expiresAt <= Math.floor(now / 1000)) return false;

  let signatureBytes: Uint8Array;
  try {
    signatureBytes = decodeBase64Url(signature, "image URL signature");
  } catch {
    return false;
  }
  if (signatureBytes.byteLength !== 32) return false;

  const key = await importHmacKey(settingsEncryptionKey, ["verify"]);
  return crypto.subtle.verify(
    "HMAC",
    key,
    signatureBytes,
    new TextEncoder().encode(signatureMessage(objectPath, expiresAt)),
  );
}

async function importAesKey(base64Key: string, usages: KeyUsage[]): Promise<CryptoKey> {
  const keyBytes = decodeSettingsKey(base64Key);
  return crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, usages);
}

async function importHmacKey(base64Key: string, usages: KeyUsage[]): Promise<CryptoKey> {
  const keyBytes = decodeSettingsKey(base64Key);
  return crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, usages);
}

function decodeSettingsKey(base64Key: string): Uint8Array {
  const keyBytes = decodeBase64(base64Key, "SETTINGS_ENCRYPTION_KEY");
  if (keyBytes.byteLength !== AES_KEY_BYTES) {
    throw new Error("SETTINGS_ENCRYPTION_KEY must encode exactly 32 bytes.");
  }
  return keyBytes;
}

function decodeBase64(value: string, label: string): Uint8Array {
  if (
    !value ||
    value.length % 4 !== 0 ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)
  ) {
    throw new Error(`${label} is not valid canonical Base64.`);
  }
  try {
    const binary = atob(value);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    if (btoa(binary) !== value) throw new Error();
    return bytes;
  } catch {
    throw new Error(`${label} is not valid canonical Base64.`);
  }
}

function encodeBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function decodeBase64Url(value: string, label: string): Uint8Array {
  if (!value || !/^[A-Za-z0-9_-]+$/.test(value) || value.length % 4 === 1) {
    throw new Error(`${label} is not valid Base64URL.`);
  }
  const standardBase64 = value.replaceAll("-", "+").replaceAll("_", "/");
  return decodeBase64(standardBase64 + "=".repeat((4 - (standardBase64.length % 4)) % 4), label);
}

function assertSigningInput(objectPath: string, expiresAt: number): void {
  if (!objectPath || objectPath.startsWith("/") || objectPath.includes("\n")) {
    throw new Error("Image URL object path must be a non-empty relative path without newlines.");
  }
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= 0) {
    throw new Error("Image URL expiry must be a positive Unix timestamp in seconds.");
  }
}

function signatureMessage(objectPath: string, expiresAt: number): string {
  return `${IMAGE_SIGNATURE_CONTEXT}\n${expiresAt}\n${objectPath}`;
}
