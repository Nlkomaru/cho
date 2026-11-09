/** Upload limits shared by the REST API, MCP tools and the editor. */
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
/** Cap for base64 uploads through MCP; larger files go through create_image_upload. */
export const MAX_INLINE_IMAGE_BYTES = 2 * 1024 * 1024;
export const supportedImageTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
] as const;
export type SupportedImageType = (typeof supportedImageTypes)[number];

export function isSupportedImageType(value: string): value is SupportedImageType {
  return (supportedImageTypes as readonly string[]).includes(value);
}
