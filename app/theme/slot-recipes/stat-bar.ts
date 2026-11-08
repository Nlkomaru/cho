import { defineSlotRecipe } from "@chakra-ui/react";

/**
 * 期間集計・食事詳細・レシピ詳細で使う数値サマリー。
 * 罫線 1px のグリッドで、数値は `numeric` テキストスタイル
 * (JetBrains Mono + tabular-nums) を使う。
 */
export const statBar = defineSlotRecipe({
  className: "cho-stat-bar",
  slots: ["root", "item", "label", "value", "note"],
  base: {
    root: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 190px), 1fr))",
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
      textStyle: "numeric.strong",
      overflowWrap: "anywhere",
    },
    note: {
      textStyle: "numeric.xs",
    },
  },
});
