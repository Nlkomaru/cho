import { defineRecipe } from "@chakra-ui/react";

const primary = {
  bg: "red.600",
  color: "white",
  borderColor: "transparent",
  _hover: { bg: "red.700" },
  _active: { bg: "red.800" },
  _expanded: { bg: "red.700" },
  // 薄い赤は桃色に見えるので、押せない間は紺の淡色にする (読み込み中は赤のまま)
  "&:is(:disabled, [data-disabled]):not([data-loading])": {
    bg: "navy.200",
    color: "navy.500",
    opacity: 1,
  },
};

const secondary = {
  bg: "navy.900",
  color: "white",
  borderColor: "transparent",
  _hover: { bg: "navy.700" },
  _active: { bg: "navy.950" },
  _expanded: { bg: "navy.700" },
};

const outline = {
  bg: "bg.panel",
  color: "fg.strong",
  borderColor: "border.emphasized",
  _hover: { bg: "navy.50", borderColor: "navy.400" },
  _active: { bg: "navy.100" },
  _expanded: { bg: "navy.50", borderColor: "navy.400" },
};

const ghost = {
  bg: "transparent",
  color: "fg.strong",
  borderColor: "transparent",
  _hover: { bg: "navy.100" },
  _active: { bg: "navy.200" },
  _expanded: { bg: "navy.100" },
};

const link = {
  h: "auto",
  minW: "0",
  px: "0",
  borderRadius: "none",
  borderColor: "transparent",
  bg: "transparent",
  color: "red.600",
  fontWeight: "500",
  textUnderlineOffset: "3px",
  _hover: { textDecoration: "underline", color: "red.700" },
};

/**
 * ボタン。角は完全な丸、影なし。
 * 赤の `primary` は 1 画面に 1 つだけ。破壊的操作は `danger` (塗りなし)。
 * Chakra 内部の CloseButton などが使う solid / subtle / surface / plain も同じ見た目に寄せる。
 */
export const buttonRecipe = defineRecipe({
  className: "chakra-button",
  base: {
    borderRadius: "full",
    fontWeight: "600",
    gap: "2",
    borderWidth: "1px",
    transitionProperty: "color, background-color, border-color",
    transitionDuration: "120ms",
    focusVisibleRing: "outside",
    focusRingColor: "navy.900",
    focusRingWidth: "2px",
    focusRingOffset: "2px",
    _disabled: { opacity: 0.4, cursor: "not-allowed" },
    _icon: { flexShrink: "0", width: "4", height: "4" },
  },
  variants: {
    size: {
      "2xs": { h: "6", minW: "6", px: "2.5", fontSize: "12px", gap: "1" },
      xs: { h: "7", minW: "7", px: "3", fontSize: "13px", gap: "1.5" },
      sm: { h: "8", minW: "8", px: "3.5", fontSize: "14px" },
      md: { h: "10", minW: "10", px: "5", fontSize: "15px" },
      lg: { h: "11", minW: "11", px: "6", fontSize: "16px" },
      xl: { h: "12", minW: "12", px: "6", fontSize: "16px" },
      "2xl": { h: "14", minW: "14", px: "7", fontSize: "17px" },
    },
    variant: {
      primary,
      secondary,
      outline,
      ghost,
      danger: {
        bg: "bg.panel",
        color: "red.700",
        borderColor: "red.200",
        _hover: { bg: "red.50", borderColor: "red.300" },
        _active: { bg: "red.100" },
        _expanded: { bg: "red.50" },
      },
      link,
      solid: secondary,
      subtle: ghost,
      surface: outline,
      plain: { ...link, color: "fg.strong", _hover: { textDecoration: "underline" } },
    },
  },
  defaultVariants: {
    size: "md",
    variant: "outline",
  },
});
