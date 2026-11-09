/**
 * ストーリー用の画像。外部の画像を読まないよう SVG を埋め込み、画像 ID から決まった絵を返す。
 * preview.tsx の ImageSourceContext から使う。
 */

/** fixtures で使う画像 ID (API と同じく UUID)。 */
export const sampleImageIds = {
  curryCover: "6a1f0c52-0d8e-4c1b-9a3e-2f6d8b7c1a01",
  curryCut: "6a1f0c52-0d8e-4c1b-9a3e-2f6d8b7c1a02",
  currySaute1: "6a1f0c52-0d8e-4c1b-9a3e-2f6d8b7c1a03",
  currySaute2: "6a1f0c52-0d8e-4c1b-9a3e-2f6d8b7c1a04",
  currySimmer: "6a1f0c52-0d8e-4c1b-9a3e-2f6d8b7c1a05",
  gratinCover: "6a1f0c52-0d8e-4c1b-9a3e-2f6d8b7c1a06",
  misoCover: "6a1f0c52-0d8e-4c1b-9a3e-2f6d8b7c1a07",
} as const;

/** 読み込みに失敗する画像 ID (削除済みの画像の表示確認用)。 */
export const missingImageId = "00000000-0000-4000-8000-000000000000";

const palettes: Record<string, readonly [string, string, string]> = {
  [sampleImageIds.curryCover]: ["#e9dcc7", "#b5651d", "#f4f1ea"],
  [sampleImageIds.curryCut]: ["#d9cbb3", "#e8a33d", "#8fb35a"],
  [sampleImageIds.currySaute1]: ["#3a3d42", "#d7b98e", "#f0e3c7"],
  [sampleImageIds.currySaute2]: ["#3a3d42", "#a8683a", "#e3c08d"],
  [sampleImageIds.currySimmer]: ["#2f3236", "#8a4b1c", "#c9772e"],
  [sampleImageIds.gratinCover]: ["#e2d6c2", "#c98b3b", "#f3d38a"],
  [sampleImageIds.misoCover]: ["#d8d0c2", "#b8864b", "#3f6b3a"],
};

const hash = (value: string) =>
  [...value].reduce((total, char) => (total * 31 + char.charCodeAt(0)) >>> 0, 7);

/** 卓上に置いた皿のような絵。色は画像 ID から決まる。 */
export function sampleImageSrc(id: string, width = 640, height = 480): string {
  if (id === missingImageId) return "data:image/png;base64,";
  const hue = hash(id) % 360;
  const [table, food, accent] = palettes[id] ?? [
    `hsl(${hue} 20% 84%)`,
    `hsl(${hue} 45% 52%)`,
    `hsl(${(hue + 40) % 360} 50% 72%)`,
  ];
  const cx = width / 2;
  const cy = height / 2;
  const r = Math.min(width, height) * 0.36;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" fill="${table}"/><circle cx="${cx + r * 0.08}" cy="${cy + r * 0.1}" r="${r * 1.04}" fill="rgba(0,0,0,0.12)"/><circle cx="${cx}" cy="${cy}" r="${r}" fill="#fbfaf7"/><circle cx="${cx}" cy="${cy}" r="${r * 0.72}" fill="${food}"/><circle cx="${cx - r * 0.22}" cy="${cy - r * 0.18}" r="${r * 0.16}" fill="${accent}"/><circle cx="${cx + r * 0.25}" cy="${cy + r * 0.12}" r="${r * 0.13}" fill="${accent}"/><circle cx="${cx + r * 0.05}" cy="${cy + r * 0.32}" r="${r * 0.1}" fill="${accent}"/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
