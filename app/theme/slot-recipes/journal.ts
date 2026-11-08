import { defineSlotRecipe } from "@chakra-ui/react";

/**
 * 日付ごとにまとめる食事ジャーナル。日付ヘッダーと日計、時刻ガター、
 * 料理名・写真・数値の1行で構成する。影やカードの反復は使わない。
 */
export const journal = defineSlotRecipe({
  className: "cho-journal",
  slots: [
    "root",
    "day",
    "dayHeader",
    "dayTitle",
    "dayTotals",
    "entries",
    "entry",
    "time",
    "body",
    "head",
    "thumb",
    "text",
    "title",
    "meta",
    "values",
    "valueGroup",
  ],
  base: {
    root: {
      display: "flex",
      flexDirection: "column",
      gap: "5",
    },
    day: {
      display: "flex",
      flexDirection: "column",
    },
    dayHeader: {
      display: "flex",
      flexWrap: "wrap",
      alignItems: "baseline",
      justifyContent: "space-between",
      gap: "2",
      borderTopWidth: "1px",
      borderColor: "border",
      paddingBlock: "2",
    },
    dayTitle: {
      fontWeight: "semibold",
      fontSize: "sm",
      color: "fg.subtle",
    },
    dayTotals: {
      display: "flex",
      flexWrap: "wrap",
      alignItems: "baseline",
      gap: "3",
      fontSize: "sm",
      color: "fg.muted",
    },
    entries: {
      display: "flex",
      flexDirection: "column",
      margin: "0",
      padding: "0",
      listStyle: "none",
    },
    entry: {
      display: "flex",
      alignItems: "flex-start",
      gap: "3",
      borderBottomWidth: "1px",
      borderColor: "border.muted",
      paddingBlock: "3",
    },
    time: {
      width: "3.5rem",
      flexShrink: "0",
      paddingTop: "0.5",
    },
    body: {
      display: "flex",
      flexDirection: "column",
      gap: "1",
      flex: "1",
      minWidth: "0",
    },
    head: {
      display: "flex",
      alignItems: "flex-start",
      gap: "3",
      minWidth: "0",
    },
    thumb: {
      width: "16",
      height: "16",
      flexShrink: "0",
      borderRadius: "l3",
      borderWidth: "1px",
      borderColor: "border",
      objectFit: "cover",
      background: "bg.muted",
    },
    text: {
      display: "flex",
      flexDirection: "column",
      gap: "1",
      minWidth: "0",
      flex: "1",
    },
    title: {
      fontWeight: "semibold",
      fontSize: "md",
      color: "fg.subtle",
      overflowWrap: "anywhere",
      "& a": { color: "inherit", textDecoration: "none" },
    },
    meta: {
      textStyle: "caption",
    },
    values: {
      display: "flex",
      flexWrap: "wrap",
      alignItems: "baseline",
      gap: "3",
      fontSize: "sm",
      color: "fg.muted",
    },
    valueGroup: {
      display: "inline-flex",
      alignItems: "baseline",
      gap: "1",
    },
  },
});
