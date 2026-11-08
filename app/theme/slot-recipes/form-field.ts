import { defineSlotRecipe } from "@chakra-ui/react";

/**
 * フォーム項目のラベル・コントロール・補助テキスト。
 */
export const formField = defineSlotRecipe({
  className: "cho-form-field",
  slots: ["root", "label", "control", "help", "error"],
  base: {
    root: {
      display: "flex",
      flexDirection: "column",
      flex: "1",
      gap: "1",
      minWidth: "0",
    },
    label: {
      textStyle: "body.sm",
      fontWeight: "semibold",
      color: "fg.subtle",
    },
    control: {
      display: "flex",
      flexDirection: "column",
      minWidth: "0",
    },
    help: {
      textStyle: "caption",
    },
    error: {
      textStyle: "body.sm",
      color: "red.fg",
    },
  },
});
