import { defineSlotRecipe } from "@chakra-ui/react";

/**
 * 水平ナビゲーション。デスクトップは最上部の1行、モバイルは
 * ブランドとメニューボタンのみを出し、項目は Chakra Drawer に逃がす。
 */
export const appNav = defineSlotRecipe({
  className: "cho-app-nav",
  slots: ["root", "inner", "brand", "primary", "resources", "mobile", "menuButton"],
  base: {
    root: {
      position: "sticky",
      top: "0",
      zIndex: "30",
      borderBottomWidth: "1px",
      borderColor: "border",
      background: "bg.panel",
    },
    inner: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "4",
      width: "full",
      maxWidth: "1120px",
      marginInline: "auto",
      minHeight: "14",
      paddingInline: { base: "4", md: "8" },
    },
    brand: {
      textStyle: "heading.sm",
      textDecoration: "none",
      flexShrink: "0",
    },
    primary: {
      display: { base: "none", md: "flex" },
      alignItems: "center",
      gap: "1",
      flex: "1",
    },
    resources: {
      display: { base: "none", md: "flex" },
      alignItems: "center",
      gap: "2",
      flexShrink: "0",
    },
    mobile: {
      display: { base: "flex", md: "none" },
      alignItems: "center",
      gap: "2",
    },
    menuButton: {
      minWidth: "10",
      minHeight: "10",
    },
  },
});
