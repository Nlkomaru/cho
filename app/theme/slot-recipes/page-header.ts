import { defineSlotRecipe } from "@chakra-ui/react";

/**
 * ページヘッダーはタイトルとアクションのみ (spec/02_design-system.md §4.1)。
 * 説明文・サブタイトル用のスロットは意図的に持たない。
 */
export const pageHeader = defineSlotRecipe({
  className: "cho-page-header",
  slots: ["root", "title", "actions"],
  base: {
    root: {
      display: "flex",
      flexDirection: { base: "column", sm: "row" },
      alignItems: { base: "stretch", sm: "center" },
      justifyContent: "space-between",
      gap: "3",
      width: "full",
    },
    title: {
      textStyle: "heading.lg",
      minWidth: "0",
      overflowWrap: "anywhere",
    },
    actions: {
      display: "flex",
      flexWrap: "wrap",
      alignItems: "center",
      gap: "2",
    },
  },
});
