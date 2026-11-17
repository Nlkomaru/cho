import type { RecipeStatus, RecipeStep } from "@/domain/recipe";

const HEAT_LEVEL_LABELS: Record<RecipeStep["heatLevel"], string | null> = {
  none: null,
  low: "弱火",
  medium_low: "弱めの中火",
  medium: "中火",
  medium_high: "強めの中火",
  high: "強火",
  boil: "沸騰",
  simmer: "とろ火",
};

/** 火加減の表示名。火を使わない手順は null。 */
export function heatLevelLabel(level: RecipeStep["heatLevel"]): string | null {
  return HEAT_LEVEL_LABELS[level] ?? null;
}

export interface RecipeStatusMeta {
  value: RecipeStatus;
  label: string;
  description: string;
  colorPalette: "amber" | "navy" | "green";
}

export const RECIPE_STATUS_OPTIONS: readonly RecipeStatusMeta[] = [
  {
    value: "spark",
    label: "Spark",
    description: "AI等で自動生成された下書き",
    colorPalette: "amber",
  },
  {
    value: "grid",
    label: "Grid",
    description: "人によってチェック済み",
    colorPalette: "navy",
  },
  {
    value: "orbit",
    label: "Orbit",
    description: "人によって十分に検証され安定",
    colorPalette: "green",
  },
];

const RECIPE_STATUS_MAP: Record<RecipeStatus, RecipeStatusMeta> = {
  spark: RECIPE_STATUS_OPTIONS[0],
  grid: RECIPE_STATUS_OPTIONS[1],
  orbit: RECIPE_STATUS_OPTIONS[2],
};

/** レシピの成熟度ステータス表示情報。 */
export function recipeStatusMeta(status: RecipeStatus): RecipeStatusMeta {
  return RECIPE_STATUS_MAP[status] ?? RECIPE_STATUS_MAP.spark;
}
