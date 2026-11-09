import { defineSlotRecipe } from "@chakra-ui/react";
import { selectAnatomy } from "@chakra-ui/react/anatomy";

import { fieldControlBase } from "../recipes/input";

export const selectSlotRecipe = defineSlotRecipe({
  className: "chakra-select",
  slots: selectAnatomy.keys(),
  base: {
    label: { textStyle: "label", color: "fg.muted" },
    trigger: { cursor: "pointer" },
    indicator: { color: "fg.subtle" },
    content: {
      bg: "bg.panel",
      borderRadius: "l2",
      boxShadow: "overlay",
    },
    item: {
      borderRadius: "l1",
      color: "fg",
      _highlighted: { bg: "navy.100" },
      _selected: { color: "fg.strong", fontWeight: "500" },
    },
  },
  variants: {
    variant: {
      outline: { trigger: { ...fieldControlBase, focusVisibleRing: "none" } },
      subtle: { trigger: { ...fieldControlBase, focusVisibleRing: "none", bg: "bg.subtle" } },
    },
    size: {
      sm: {
        root: { "--select-trigger-height": "sizes.8", "--select-trigger-padding-x": "spacing.3" },
        trigger: { fontSize: "14px" },
        item: { fontSize: "14px", minH: "8" },
      },
      md: {
        root: { "--select-trigger-height": "sizes.10", "--select-trigger-padding-x": "spacing.3" },
        trigger: { fontSize: "15px" },
        item: { fontSize: "14px", minH: "9" },
      },
    },
  },
});
