import { defineRecipe } from "@chakra-ui/react";

/**
 * ページ本体のコンテナ。max-width だけを variant で切り替える。
 */
export const page = defineRecipe({
  className: "cho-page",
  base: {
    display: "flex",
    flexDirection: "column",
    width: "full",
    maxWidth: "6xl",
    marginInline: "auto",
    paddingInline: { base: "4", md: "8" },
    paddingBlock: "8",
    gap: "7",
    color: "fg",
  },
  variants: {
    size: {
      sm: { maxWidth: "4xl" },
      md: { maxWidth: "6xl" },
      lg: { maxWidth: "7xl" },
    },
  },
  defaultVariants: { size: "md" },
});
