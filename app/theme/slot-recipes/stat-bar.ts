import { defineSlotRecipe } from "@chakra-ui/react";

/**
 * 日本語ラベルを等幅フォントに落とさない。
 */
export const statBar = defineSlotRecipe({
  className: "cho-stat-bar",
  slots: ["root", "item", "label", "value", "note"],
  base: {
    root: {
      display: "grid",
      gridTemplateColumns: {
        base: "repeat(2, minmax(0, 1fr))",
        md: "repeat(4, minmax(0, 1fr))",
      },
      borderTopWidth: "1px",
      borderLeftWidth: "1px",
      borderColor: "border",
    },
    item: {
      display: "flex",
      flexDirection: "column",
      gap: "2",
      padding: "4",
      borderRightWidth: "1px",
      borderBottomWidth: "1px",
      borderColor: "border",
      minWidth: "0",
    },
    label: {
      textStyle: "caption",
    },
    value: {
      display: "flex",
      flexWrap: "wrap",
      alignItems: "baseline",
      columnGap: "4",
      rowGap: "1",
      minWidth: "0",
      overflowWrap: "anywhere",
    },
    note: {
      textStyle: "caption",
    },
  },
});
