import { defineSlotRecipe } from "@chakra-ui/react";
import { tableAnatomy } from "@chakra-ui/react/anatomy";

// 最初と最後の列は内側の余白を取らず、文字の端をページの見出しや検索欄とそろえる
const flushEdges = { _first: { ps: "0" }, _last: { pe: "0" } };

/**
 * 表。外枠・縞模様なし。見出しの下に紺の細罫、行は細罫で区切る。
 */
export const tableSlotRecipe = defineSlotRecipe({
  className: "chakra-table",
  slots: tableAnatomy.keys(),
  base: {
    root: {
      fontVariantNumeric: "lining-nums tabular-nums",
      bg: "transparent",
    },
    columnHeader: {
      textStyle: "label",
      color: "fg.muted",
      fontWeight: "500",
      whiteSpace: "nowrap",
      bg: "bg.panel",
      borderBottomWidth: "1px",
      borderBottomColor: "navy.900",
      verticalAlign: "bottom",
    },
    cell: {
      color: "fg",
      borderBottomWidth: "1px",
      borderBottomColor: "border",
      verticalAlign: "middle",
    },
    row: {
      bg: "bg.panel",
      transitionProperty: "background-color",
      transitionDuration: "120ms",
      _selected: {
        bg: "red.50",
        // 最初の列は余白が無いので、選択の印は文字に重ならないよう外側に出す
        "& > td:first-of-type": {
          boxShadow: "-6px 0 0 {colors.red.50}, -8px 0 0 {colors.red.600}",
        },
      },
    },
    caption: {
      position: "absolute",
      width: "1px",
      height: "1px",
      overflow: "hidden",
      clip: "rect(0, 0, 0, 0)",
      whiteSpace: "nowrap",
    },
  },
  variants: {
    interactive: {
      true: {
        body: {
          "& tr": { cursor: "pointer", _hover: { bg: "navy.50" } },
        },
      },
    },
    variant: {
      line: {
        columnHeader: { borderBottomWidth: "1px" },
        cell: { borderBottomWidth: "1px" },
        row: { bg: "bg.panel" },
      },
      outline: {
        root: { boxShadow: "none" },
        header: { bg: "bg.panel" },
      },
    },
    size: {
      sm: {
        root: { textStyle: "body.sm" },
        columnHeader: { px: "3", py: "2", ...flushEdges },
        cell: { px: "3", py: "2", h: "11", ...flushEdges },
      },
      md: {
        root: { textStyle: "body.sm" },
        columnHeader: { px: "3", py: "2.5", ...flushEdges },
        cell: { px: "3", py: "3", h: "14", ...flushEdges },
      },
    },
  },
  defaultVariants: {
    variant: "line",
    size: "md",
  },
});
