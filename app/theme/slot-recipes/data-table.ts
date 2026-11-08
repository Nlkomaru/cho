import { defineSlotRecipe } from "@chakra-ui/react";

/**
 * 一覧・内訳の表。数値セルは `cellNumeric` を使い桁を揃える。
 */
export const dataTable = defineSlotRecipe({
  className: "cho-data-table",
  slots: ["root", "table", "head", "headerCell", "body", "row", "cell", "cellNumeric"],
  base: {
    root: {
      overflowX: "auto",
      borderTopWidth: "1px",
      borderColor: "border",
    },
    table: {
      width: "full",
      borderCollapse: "collapse",
      textStyle: "body.sm",
    },
    head: {},
    headerCell: {
      paddingBlock: "2",
      paddingRight: "4",
      borderBottomWidth: "1px",
      borderColor: "border",
      color: "fg.subtle",
      fontWeight: "semibold",
      textAlign: "start",
      whiteSpace: "nowrap",
    },
    body: {},
    row: {
      borderBottomWidth: "1px",
      borderColor: "border.muted",
    },
    cell: {
      paddingBlock: "2.5",
      paddingRight: "4",
      verticalAlign: "top",
      color: "fg",
    },
    cellNumeric: {
      paddingBlock: "2.5",
      paddingRight: "4",
      verticalAlign: "top",
      textStyle: "numeric.sm",
      whiteSpace: "nowrap",
    },
  },
});
