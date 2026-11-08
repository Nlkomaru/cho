import { defineRecipe } from "@chakra-ui/react";

/**
 * エラー・ステータス表示。赤は注意事項に限定する。
 */
export const feedback = defineRecipe({
  className: "cho-feedback",
  base: {
    textStyle: "body.sm",
    whiteSpace: "pre-wrap",
  },
  variants: {
    tone: {
      error: { color: "red.fg" },
      status: { color: "fg.muted" },
      info: { color: "fg" },
    },
  },
  defaultVariants: { tone: "info" },
});
