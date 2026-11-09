import { defineRecipe } from "@chakra-ui/react";

/**
 * 入力欄の共通外観。1px の枠、角丸 l2、フォーカスは紺の 1px リング (グローなし)。
 */
export const fieldControlBase = {
  bg: "bg.panel",
  color: "fg.strong",
  borderRadius: "l2",
  borderWidth: "1px",
  borderColor: "border.emphasized",
  transitionProperty: "border-color, box-shadow",
  transitionDuration: "120ms",
  _hover: { borderColor: "navy.400" },
  _focusVisible: {
    outline: "none",
    borderColor: "navy.900",
    boxShadow: "0 0 0 1px {colors.navy.900}",
  },
  _invalid: {
    borderColor: "red.600",
    _focusVisible: { boxShadow: "0 0 0 1px {colors.red.600}" },
  },
  _readOnly: { bg: "bg.subtle" },
  _disabled: { opacity: 0.5, cursor: "not-allowed", bg: "bg.subtle" },
} as const;

export const inputRecipe = defineRecipe({
  className: "chakra-input",
  base: {
    "--focus-color": "colors.navy.900",
    "--error-color": "colors.red.600",
  },
  variants: {
    size: {
      xs: { fontSize: "13px", px: "2.5", "--input-height": "sizes.7" },
      sm: { fontSize: "14px", px: "3", "--input-height": "sizes.8" },
      md: { fontSize: "15px", px: "3", "--input-height": "sizes.10" },
      lg: { fontSize: "16px", px: "3.5", "--input-height": "sizes.11" },
    },
    variant: {
      outline: { ...fieldControlBase, focusVisibleRing: "none" },
      subtle: { ...fieldControlBase, focusVisibleRing: "none", bg: "bg.subtle" },
      flushed: {
        bg: "transparent",
        borderRadius: "0",
        borderBottomWidth: "1px",
        borderBottomColor: "border.emphasized",
        px: "0",
        _hover: { borderBottomColor: "navy.400" },
        _focusVisible: {
          outline: "none",
          borderBottomColor: "navy.900",
          boxShadow: "0 1px 0 0 {colors.navy.900}",
        },
      },
    },
  },
  defaultVariants: {
    size: "md",
    variant: "outline",
  },
});

export const textareaRecipe = defineRecipe({
  className: "chakra-textarea",
  base: {
    minH: "24",
    lineHeight: "1.6",
    py: "2.5",
  },
  variants: {
    size: {
      sm: { fontSize: "14px", px: "3" },
      md: { fontSize: "15px", px: "3" },
      lg: { fontSize: "16px", px: "3.5" },
    },
    variant: {
      outline: { ...fieldControlBase, focusVisibleRing: "none" },
      subtle: { ...fieldControlBase, focusVisibleRing: "none", bg: "bg.subtle" },
    },
  },
  defaultVariants: {
    size: "md",
    variant: "outline",
  },
});
