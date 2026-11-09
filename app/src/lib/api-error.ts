// 画像まわりのエラー本文は英語なので、既知の形を日本語にする
const imageErrorMessages: [RegExp, string | ((match: RegExpMatchArray) => string)][] = [
  [/^Image not found: /, "使おうとした画像が見つかりません。画像を入れ直してください"],
  [
    /^Image .* is attached to another recipe or meal\.$|^An image is attached to another recipe or meal\.$/,
    "他のレシピや食事で使われている画像が含まれています。画像を入れ直してください",
  ],
  [/^Image .* is used more than once\.$/, "同じ画像を複数の場所に使うことはできません"],
  [
    /^A recipe can use at most (\d+) images\.$/,
    (match) => `1 つのレシピに使える画像は ${match[1]} 枚までです`,
  ],
];

const localizeImageError = (message: string): string => {
  for (const [pattern, text] of imageErrorMessages) {
    const match = message.match(pattern);
    if (match) return typeof text === "string" ? text : text(match);
  }
  return message;
};

/**
 * API のエラーレスポンスからメッセージを取り出す。形は外部入力なので
 * 実行時に検証してから読む。
 */
export const errorMessageFrom = (value: unknown, fallback: string): string => {
  if (typeof value === "object" && value !== null && "error" in value) {
    const { error } = value;
    if (typeof error === "string") return localizeImageError(error);
  }
  return fallback;
};
