import type { RecipeStep } from "@/domain/recipe";

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
