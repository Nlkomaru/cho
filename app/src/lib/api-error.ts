/**
 * API のエラーレスポンスからメッセージを取り出す。形は外部入力なので
 * 実行時に検証してから読む。
 */
export const errorMessageFrom = (value: unknown, fallback: string): string => {
  if (typeof value === "object" && value !== null && "error" in value) {
    const { error } = value;
    if (typeof error === "string") return error;
  }
  return fallback;
};
