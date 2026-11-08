import { defineSlotRecipe } from "@chakra-ui/react";

/**
 * 罫線で区切る一覧。行ごとの border 指定を画面に書かないための共通面。
 */
export const list = defineSlotRecipe({
  className: "cho-list",
  slots: ["root", "item"],
  base: {
    root: {
      display: "flex",
      flexDirection: "column",
      margin: "0",
      padding: "0",
      listStyle: "none",
    },
    item: {
      display: "flex",
      flexDirection: "column",
      gap: "2",
      paddingBlock: "3",
      minWidth: "0",
    },
  },
  variants: {
    divided: {
      true: {
        item: { borderBottomWidth: "1px", borderColor: "border" },
      },
      false: {},
    },
    layout: {
      stack: {},
      row: {
        item: {
          flexDirection: "row",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "3",
        },
      },
    },
  },
  defaultVariants: { divided: true, layout: "stack" },
});
