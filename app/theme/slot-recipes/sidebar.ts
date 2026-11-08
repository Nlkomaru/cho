import { defineSlotRecipe } from "@chakra-ui/react";

/**
 * アプリシェルのサイドバー。白背景・右罫線 1px のみで装飾しない。
 */
export const sidebar = defineSlotRecipe({
  className: "cho-sidebar",
  slots: ["root", "body", "brand", "nav", "navList", "footer", "resources", "copyright"],
  base: {
    root: {
      width: "16rem",
      minHeight: "100vh",
      flexShrink: "0",
      borderRightWidth: "1px",
      borderColor: "border",
      background: "bg.panel",
      paddingInline: "4",
      paddingBlock: "6",
    },
    body: {
      display: "flex",
      flexDirection: "column",
      gap: "8",
      minHeight: "calc(100vh - 3rem)",
    },
    brand: {
      textStyle: "heading.sm",
      textDecoration: "none",
      width: "fit-content",
    },
    nav: {},
    navList: {
      display: "flex",
      flexDirection: "column",
      gap: "1",
      margin: "0",
      padding: "0",
      listStyle: "none",
    },
    footer: {
      marginTop: "auto",
      borderTopWidth: "1px",
      borderColor: "border",
      paddingTop: "4",
    },
    resources: {
      display: "flex",
      flexDirection: "column",
      gap: "1",
      margin: "0",
      padding: "0",
      listStyle: "none",
    },
    copyright: {
      textStyle: "numeric.xs",
      marginTop: "3",
      paddingInline: "3",
    },
  },
});
