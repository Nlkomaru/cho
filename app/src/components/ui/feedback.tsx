import { Box, useRecipe } from "@chakra-ui/react";
import type { ReactNode } from "react";

import { feedback } from "../../../theme/recipes/feedback";

export interface FeedbackProps {
  tone?: "error" | "status" | "info";
  role?: "alert" | "status";
  ariaLive?: "polite" | "assertive";
  children: ReactNode;
}

/**
 * エラー・ステータスの表示。赤字はエラーと注意事項のみ。
 */
export function Feedback({ tone = "info", role, ariaLive, children }: FeedbackProps) {
  const recipe = useRecipe({ recipe: feedback });

  return (
    <Box as="p" role={role} aria-live={ariaLive} css={recipe({ tone })}>
      {children}
    </Box>
  );
}
