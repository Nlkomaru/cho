import { defineSlotRecipe } from "@chakra-ui/react";

/**
 * 画面上の区切りセクション。上罫線 1px と見出しを共通化する。
 */
export const section = defineSlotRecipe({
  className: "cho-section",
  slots: ["root", "header", "title", "actions", "body"],
  base: {
    root: {
      display: "flex",
      flexDirection: "column",
      gap: "4",
      borderTopWidth: "1px",
      borderColor: "border",
      paddingTop: "4",
    },
    header: {
      display: "flex",
      flexWrap: "wrap",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "3",
    },
    title: {
      textStyle: "heading.md",
    },
    actions: {
      display: "flex",
      flexWrap: "wrap",
      gap: "2",
    },
    body: {
      display: "flex",
      flexDirection: "column",
      gap: "3",
    },
  },
  variants: {
    divided: {
      true: {},
      false: {
        root: { borderTopWidth: "0", paddingTop: "0" },
      },
    },
    level: {
      2: {},
      3: {
        title: { textStyle: "heading.sm" },
      },
    },
  },
  defaultVariants: { divided: true, level: 2 },
});
