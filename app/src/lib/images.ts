import { createContext, useContext } from "react";

import { isSupportedImageType, MAX_IMAGE_BYTES, supportedImageTypes } from "@/domain/image";

/** 画像 API の表示 URL。署名付き URL へリダイレクトされる。 */
export const imageUrl = (id: string) => `/api/images/${encodeURIComponent(id)}`;

/** `<input type="file" accept>` に渡す値。 */
export const acceptedImageTypes = supportedImageTypes.join(",");

/** 選べる形式と上限の説明。 */
export const imageLimitText = "JPEG・PNG・WebP・GIF・AVIF、10MB まで";

export { MAX_IMAGE_BYTES };

/** アップロード前の形式・サイズの確認。問題があれば表示用のメッセージを返す。 */
export function checkImageFile(file: File): string | null {
  if (!isSupportedImageType(file.type)) return "この形式の画像は使えません";
  if (file.size === 0) return "空のファイルです";
  if (file.size > MAX_IMAGE_BYTES) return "10MB を超える画像は使えません";
  return null;
}

/** アップロード結果。id は料理・手順に保存する画像 ID。 */
export interface UploadedImage {
  id: string;
}

// API のエラー本文は英語なので、状態コードから日本語の理由を出す
const uploadErrorMessage = (status: number) => {
  if (status === 413) return "10MB を超える画像は使えません";
  if (status === 415) return "画像の形式を読み取れませんでした";
  if (status === 400) return "ファイルを読み取れませんでした";
  return `アップロードに失敗しました (${status})`;
};

/** 画像を 1 枚アップロードする。失敗したら表示用のメッセージを持つ Error を投げる。 */
export async function uploadImage(file: File, signal?: AbortSignal): Promise<UploadedImage> {
  const form = new FormData();
  form.append("file", file);
  let response: Response;
  try {
    response = await fetch("/api/images/upload", { method: "POST", body: form, signal });
  } catch (cause) {
    if (signal?.aborted) throw cause;
    throw new Error("通信に失敗しました");
  }
  if (!response.ok) {
    throw new Error(uploadErrorMessage(response.status));
  }
  const body = (await response.json()) as { id: string };
  return { id: body.id };
}

/** 保存前に外した画像を消す。失敗しても未使用の画像は後で掃除されるので無視する。 */
export function discardImage(id: string): Promise<void> {
  return fetch(imageUrl(id), { method: "DELETE" }).then(
    () => undefined,
    () => undefined,
  );
}

/**
 * 画像 ID から表示 URL を作る関数。既定は画像 API。
 * Storybook では手元の画像に差し替える。
 */
export const ImageSourceContext = createContext<(id: string) => string>(imageUrl);

export const useImageSrc = () => useContext(ImageSourceContext);
