import { defineSlotRecipe } from "@chakra-ui/react";

/**
 * 数値サマリー。箱で囲まず、各セルの上に細罫を引くだけ。値は桁揃え。
 */
export const statGroupSlotRecipe = defineSlotRecipe({
  className: "stat-group",
  slots: ["root", "item", "label", "value", "unit", "note"],
  base: {
    root: {
      display: "grid",
      columnGap: { base: "4", md: "6" },
      rowGap: "5",
      m: "0",
    },
    item: {
      display: "flex",
      flexDirection: "column",
      gap: "1",
      minW: "0",
      pt: "4",
      borderTopWidth: "1px",
      borderColor: "border",
    },
    label: { textStyle: "label", color: "fg.muted", order: 0 },
    value: {
      color: "fg.strong",
      fontVariantNumeric: "tabular-nums",
      display: "flex",
      flexWrap: "wrap",
      alignItems: "baseline",
      columnGap: "3",
      rowGap: "0.5",
      m: "0",
    },
    unit: {
      textStyle: "body.sm",
      color: "fg.subtle",
      ms: "1",
      fontWeight: "400",
      letterSpacing: "0",
    },
    note: { textStyle: "caption", color: "fg.subtle" },
  },
  variants: {
    size: {
      md: {
        value: {
          textStyle: "stat",
          "&[data-multi]": {
            textStyle: "stat.sm",
            columnGap: "2.5",
            flexWrap: { base: "wrap", lg: "nowrap" },
            // 行の高さは 1 つの値とそろえる
            lineHeight: { base: "30px", md: "34px" },
          },
        },
      },
      sm: {
        value: { textStyle: "stat.sm", "&[data-multi]": { columnGap: "2.5" } },
        item: { pt: "3" },
      },
    },
  },
  defaultVariants: { size: "md" },
});
