import { defineSlotRecipe } from "@chakra-ui/react";
import { alertAnatomy } from "@chakra-ui/react/anatomy";

/**
 * 通知 (Feedback)。左の 2px バー + 淡い地。角は立てる。
 */
export const alertSlotRecipe = defineSlotRecipe({
  className: "chakra-alert",
  slots: alertAnatomy.keys(),
  base: {
    root: {
      borderRadius: "none",
      borderInlineStartWidth: "2px",
      borderColor: "colorPalette.solid",
      alignItems: "flex-start",
    },
    title: { fontWeight: "600", color: "colorPalette.fg" },
    description: { color: "fg" },
    indicator: { color: "colorPalette.solid", mt: "3px" },
    content: { gap: "0.5" },
  },
  variants: {
    status: {
      info: { root: { colorPalette: "navy" } },
      warning: { root: { colorPalette: "amber" } },
      success: { root: { colorPalette: "green" } },
      error: { root: { colorPalette: "red" } },
      neutral: { root: { colorPalette: "navy" } },
    },
    variant: {
      subtle: { root: { bg: "colorPalette.subtle", color: "fg" } },
    },
    size: {
      sm: {
        root: { gap: "2", px: "3", py: "2", textStyle: "body.sm" },
        indicator: { boxSize: "3.5" },
      },
      md: {
        root: { gap: "2.5", px: "4", py: "3", textStyle: "body.sm" },
        indicator: { boxSize: "4" },
      },
    },
  },
  defaultVariants: {
    status: "info",
    variant: "subtle",
    size: "md",
  },
});
