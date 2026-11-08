import { Box } from "@chakra-ui/react";

import { Numeric } from "../../../components/ui/numeric";
import type { NutritionFacts } from "../../../domain/nutrition";
import { fmt } from "./meal-shared";

export interface NutritionLineProps {
  nutrition: NutritionFacts | null;
  size?: "sm" | "md";
}

/**
 * 栄養価の表示。日本語ラベルは本文フォント、数値だけ Numeric にする。
 */
export function NutritionLine({ nutrition, size = "sm" }: NutritionLineProps) {
  if (!nutrition) return <Box as="span">栄養価 —</Box>;

  return (
    <Box as="span" display="inline-flex" flexWrap="wrap" alignItems="baseline" gap="2">
      <Box as="span">
        エネルギー <Numeric size={size}>{fmt(nutrition.caloriesKcal)}</Numeric> kcal
      </Box>
      <Box as="span">
        P <Numeric size={size}>{fmt(nutrition.proteinG)}</Numeric> g / F{" "}
        <Numeric size={size}>{fmt(nutrition.fatG)}</Numeric> g / C{" "}
        <Numeric size={size}>{fmt(nutrition.carbohydrateG)}</Numeric> g
      </Box>
      <Box as="span">
        食物繊維 <Numeric size={size}>{fmt(nutrition.fiberG)}</Numeric> g
      </Box>
      <Box as="span">
        食塩 <Numeric size={size}>{fmt(nutrition.saltEquivalentG)}</Numeric> g
      </Box>
    </Box>
  );
}
