import { defineSlotRecipe } from "@chakra-ui/react";
import { datePickerAnatomy } from "@chakra-ui/react/anatomy";

import { fieldControlBase } from "../recipes/input";

/**
 * 日付入力。入力欄はほかのフォーム部品と同じ外観、カレンダーは shadow.overlay。
 */
export const datePickerSlotRecipe = defineSlotRecipe({
  className: "chakra-date-picker",
  slots: datePickerAnatomy.keys(),
  base: {
    root: { gap: "1.5" },
    label: { textStyle: "label", color: "fg.muted" },
    // 右端のカレンダー・クリアボタンと日付が重ならないよう余白を確保する
    input: {
      fontSize: "15px",
      fontVariantNumeric: "tabular-nums",
      pe: "calc(var(--datepicker-indicators-offset) + {sizes.14})",
    },
    trigger: { color: "fg.subtle", _hover: { color: "fg.strong", bg: "navy.100" } },
    clearTrigger: { color: "fg.subtle", _hover: { color: "fg.strong", bg: "navy.100" } },
    content: { bg: "bg.panel", borderRadius: "l3", boxShadow: "overlay" },
    tableCellTrigger: {
      _selected: { bg: "navy.900", color: "white" },
      _today: { color: "red.700", fontWeight: "600" },
    },
  },
  variants: {
    variant: {
      outline: { input: { ...fieldControlBase, focusVisibleRing: "none" } },
    },
  },
});
