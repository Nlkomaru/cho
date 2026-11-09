import { defineSlotRecipe } from "@chakra-ui/react";
import { nativeSelectAnatomy } from "@chakra-ui/react/anatomy";

import { fieldControlBase } from "../recipes/input";

export const nativeSelectSlotRecipe = defineSlotRecipe({
  className: "chakra-native-select",
  slots: nativeSelectAnatomy.keys(),
  base: {
    field: { cursor: "pointer" },
    indicator: { color: "fg.subtle", _icon: { width: "4", height: "4" } },
  },
  variants: {
    variant: {
      outline: { field: { ...fieldControlBase, focusVisibleRing: "none" } },
      subtle: { field: { ...fieldControlBase, focusVisibleRing: "none", bg: "bg.subtle" } },
    },
    size: {
      xs: { root: { "--select-field-height": "sizes.7" }, field: { fontSize: "13px", ps: "2.5" } },
      sm: { root: { "--select-field-height": "sizes.8" }, field: { fontSize: "14px", ps: "3" } },
      md: { root: { "--select-field-height": "sizes.10" }, field: { fontSize: "15px", ps: "3" } },
      lg: { root: { "--select-field-height": "sizes.11" }, field: { fontSize: "16px", ps: "3.5" } },
    },
  },
});
