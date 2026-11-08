import { defineRecipe } from "@chakra-ui/react";

/**
 * 数値・日付・時刻・単位だけに使うインラインスタイル。
 * 日本語ラベルには適用しない（和文が等幅フォントに落ちるのを防ぐ）。
 */
export const numeric = defineRecipe({
  className: "cho-numeric",
  base: {
    fontFamily: "mono",
    fontVariantNumeric: "tabular-nums",
    color: "fg",
    whiteSpace: "nowrap",
  },
  variants: {
    size: {
      sm: { fontSize: "sm" },
      md: { fontSize: "md" },
      lg: { fontSize: "xl" },
    },
    tone: {
      normal: {},
      muted: { color: "fg.muted" },
      strong: { color: "fg.subtle", fontWeight: "semibold" },
    },
  },
  defaultVariants: { size: "md", tone: "normal" },
});
