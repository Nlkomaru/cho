import { defineRecipe } from "@chakra-ui/react";

/**
 * アプリ共通のスティッキーヘッダー。
 */
export const appHeader = defineRecipe({
  className: "cho-app-header",
  base: {
    position: "sticky",
    top: "0",
    zIndex: "20",
    display: "flex",
    alignItems: "center",
    minHeight: "4rem",
    borderBottomWidth: "1px",
    borderColor: "border",
    background: "bg.panel",
    paddingInline: { base: "4", md: "6" },
  },
});
