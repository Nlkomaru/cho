/**
 * 表示用の数値・日時フォーマット。値が無いときはすべて "—" を返す。
 */

export const EMPTY_VALUE = "—";

const isPresent = (value: number | null | undefined): value is number =>
  value !== null && value !== undefined && Number.isFinite(value);

export type FormatNumberOptions = {
  /** 小数桁を digits に固定する。表や数値の並ぶ行で桁をそろえるときに使う。 */
  fixed?: boolean;
};

/** PFC・食物繊維・塩分など g 単位の栄養値の小数桁。表と集計で共通。 */
export const NUTRIENT_DIGITS = 1;

export function formatNumber(
  value: number | null | undefined,
  digits = 1,
  { fixed = false }: FormatNumberOptions = {},
): string {
  if (!isPresent(value)) return EMPTY_VALUE;
  return value.toLocaleString("ja-JP", {
    minimumFractionDigits: fixed ? digits : 0,
    maximumFractionDigits: digits,
  });
}

/** 小数桁を固定した数値。表の列や栄養値の行で使う。 */
export function formatFixed(value: number | null | undefined, digits = NUTRIENT_DIGITS): string {
  return formatNumber(value, digits, { fixed: true });
}

/** "¥1,280"。0 より大きく ¥1 に満たない額は "¥0" ではなく "<¥1" にする。 */
export function formatYen(value: number | null | undefined): string {
  if (!isPresent(value)) return EMPTY_VALUE;
  if (value > 0 && value < 0.5) return "<¥1";
  return `¥${Math.round(value).toLocaleString("ja-JP")}`;
}

export function formatKcal(value: number | null | undefined): string {
  if (!isPresent(value)) return EMPTY_VALUE;
  return `${formatNumber(value, 0)} kcal`;
}

export function formatGrams(value: number | null | undefined, digits = 1): string {
  if (!isPresent(value)) return EMPTY_VALUE;
  return `${formatNumber(value, digits)} g`;
}

/** 秒を "52:00" / "1:05:00" の時計表記にする。 */
export function formatClock(seconds: number | null | undefined): string {
  if (!isPresent(seconds)) return EMPTY_VALUE;
  const total = Math.max(0, Math.round(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

/** 秒を "52分" / "1時間5分" にする。1 分未満は "45秒"。 */
export function formatMinutes(seconds: number | null | undefined): string {
  if (!isPresent(seconds)) return EMPTY_VALUE;
  const total = Math.max(0, Math.round(seconds));
  if (total < 60) return `${total}秒`;
  const minutes = Math.round(total / 60);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}分`;
  return m === 0 ? `${h}時間` : `${h}時間${m}分`;
}

const toDate = (value: Date | string | number | null | undefined): Date | null => {
  if (value === null || value === undefined) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"] as const;

/** "11月10日(火)" */
export function formatDateJa(value: Date | string | number | null | undefined): string {
  const date = toDate(value);
  if (!date) return EMPTY_VALUE;
  return `${date.getMonth() + 1}月${date.getDate()}日(${WEEKDAYS[date.getDay()]})`;
}

/** "2026/11/10" */
export function formatDateNumeric(value: Date | string | number | null | undefined): string {
  const date = toDate(value);
  if (!date) return EMPTY_VALUE;
  return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}`;
}

/** "2026/11/10 18:30" */
export function formatDateTimeNumeric(value: Date | string | number | null | undefined): string {
  const date = toDate(value);
  if (!date) return EMPTY_VALUE;
  return `${formatDateNumeric(date)} ${formatTime(date)}`;
}

/** タイムゾーンを変換せずに "2026-11-09" を "2026/11/09" にする (UTC の日付キー向け)。 */
export function formatDateKey(key: string | null | undefined): string {
  if (!key) return EMPTY_VALUE;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  return match ? `${match[1]}/${match[2]}/${match[3]}` : key;
}

/** "18:30" */
export function formatTime(value: Date | string | number | null | undefined): string {
  const date = toDate(value);
  if (!date) return EMPTY_VALUE;
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}
