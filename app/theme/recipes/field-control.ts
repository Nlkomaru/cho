import { defineRecipe } from "@chakra-ui/react";

/**
 * ネイティブの input / select / textarea 用。ブラウザ既定の枠線・背景を
 * 画面ごとに上書きしないよう、フォーム部品はこのレシピだけを参照する。
 */
export const fieldControl = defineRecipe({
  className: "cho-field-control",
  base: {
    width: "100%",
    minHeight: "10",
    borderWidth: "1px",
    borderColor: "border.outline",
    borderRadius: "l3",
    background: "bg.panel",
    color: "fg",
    paddingInline: "2.5",
    paddingBlock: "2",
    fontSize: "sm",
    fontFamily: "body",
    _placeholder: { color: "fg.muted" },
    _hover: { borderColor: "border.outline" },
    _focusVisible: {
      outline: "2px solid",
      outlineColor: "red.border",
      outlineOffset: "2px",
    },
    _disabled: { background: "bg.muted", color: "fg.muted" },
  },
  variants: {
    variant: {
      input: {},
      select: { paddingBlock: "1.5" },
      multiselect: { minHeight: "20", paddingBlock: "1.5" },
      textarea: { minHeight: "20", paddingBlock: "2", resize: "vertical" },
    },
  },
  defaultVariants: { variant: "input" },
});
