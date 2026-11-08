import { chakra, useRecipe } from "@chakra-ui/react";
import type { ReactNode } from "react";

import { numeric } from "../../../theme/recipes/numeric";

export interface NumericProps {
  size?: "sm" | "md" | "lg";
  tone?: "normal" | "muted" | "strong";
  children: ReactNode;
}

/**
 * 数値・日付・時刻・単位だけを等幅数字で表示する。日本語ラベルは含めない。
 */
export function Numeric({ size = "md", tone = "normal", children }: NumericProps) {
  const recipe = useRecipe({ recipe: numeric });

  return <chakra.span css={recipe({ size, tone })}>{children}</chakra.span>;
}
