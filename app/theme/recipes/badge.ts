import { defineRecipe } from "@chakra-ui/react";

/**
 * バッジ・タグ。淡い地に濃い文字、角丸は l2。大文字化・字間は使わない。
 * 区分 = navy subtle、手順のメタ = navy outline、クリティカルパス = red subtle。
 */
export const badgeRecipe = defineRecipe({
  className: "chakra-badge",
  base: {
    borderRadius: "l2",
    fontWeight: "500",
    textTransform: "none",
    letterSpacing: "0",
    gap: "1",
    _icon: { width: "3", height: "3" },
  },
  variants: {
    variant: {
      subtle: { bg: "colorPalette.subtle", color: "colorPalette.fg" },
      outline: {
        bg: "bg.panel",
        color: "colorPalette.fg",
        shadow: "none",
        borderWidth: "1px",
        borderColor: "colorPalette.border",
      },
      solid: { bg: "colorPalette.solid", color: "colorPalette.contrast" },
      surface: {
        bg: "colorPalette.subtle",
        color: "colorPalette.fg",
        shadow: "none",
        borderWidth: "1px",
        borderColor: "colorPalette.border",
      },
    },
    size: {
      sm: { minH: "5", px: "1.5", fontSize: "12px", lineHeight: "16px" },
      md: { minH: "6", px: "2", fontSize: "12px", lineHeight: "16px" },
      lg: { minH: "7", px: "2.5", fontSize: "13px", lineHeight: "18px" },
    },
  },
  defaultVariants: {
    variant: "subtle",
    size: "md",
  },
});
