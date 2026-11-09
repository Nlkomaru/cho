import { defineSlotRecipe } from "@chakra-ui/react";
import { fieldAnatomy } from "@chakra-ui/react/anatomy";

/**
 * フォーム項目のラベル・補足・エラー。ラベルは `label` 書体の fg.muted。
 */
export const fieldSlotRecipe = defineSlotRecipe({
  className: "chakra-field",
  slots: fieldAnatomy.keys(),
  base: {
    root: { gap: "1.5" },
    label: {
      textStyle: "label",
      color: "fg.muted",
      gap: "1",
      _disabled: { opacity: 0.5 },
    },
    requiredIndicator: { color: "red.600", marginStart: "0.5" },
    helperText: { textStyle: "caption", color: "fg.subtle" },
    errorText: {
      textStyle: "caption",
      color: "fg.error",
      gap: "1",
      _icon: { width: "3.5", height: "3.5" },
    },
  },
});
