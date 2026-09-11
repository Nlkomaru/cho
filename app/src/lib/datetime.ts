/**
 * 日時の表示。保存は ISO 8601 UTC に揃え、画面は日本時間（UTC+9、夏時間なし）で出す。
 */
const jstOffsetMs = 9 * 60 * 60 * 1000;

const shifted = (iso: string): Date =>
	new Date(new Date(iso).getTime() + jstOffsetMs);

const pad = (value: number): string => String(value).padStart(2, "0");

/** 「2026年9月11日 20:30」 */
export const formatJstDateTime = (iso: string): string => {
	const date = shifted(iso);
	return `${date.getUTCFullYear()}年${date.getUTCMonth() + 1}月${date.getUTCDate()}日 ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
};

/** 「2026年9月11日」 */
export const formatJstDate = (iso: string): string => {
	const date = shifted(iso);
	return `${date.getUTCFullYear()}年${date.getUTCMonth() + 1}月${date.getUTCDate()}日`;
};

/** `<input type="datetime-local">` へ入れる値 */
export const toJstInputValue = (iso: string): string => {
	const date = shifted(iso);
	return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}T${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
};

/** `<input type="datetime-local">` の値を UTC の ISO 8601 へ戻す */
export const fromJstInputValue = (value: string): string => {
	const withSeconds = value.length === 16 ? `${value}:00` : value;
	return new Date(`${withSeconds}+09:00`).toISOString();
};

/** 記録の既定値。今の日本時間を分単位で丸めた値 */
export const nowAsJstInputValue = (): Date =>
	new Date(Date.now() + jstOffsetMs);
