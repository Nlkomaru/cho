import { defineSlotRecipe } from "@chakra-ui/react";
import { numberInputAnatomy } from "@chakra-ui/react/anatomy";

import { fieldControlBase } from "../recipes/input";

export const numberInputSlotRecipe = defineSlotRecipe({
  className: "chakra-number-input",
  slots: numberInputAnatomy.keys(),
  base: {
    input: { ...fieldControlBase, focusVisibleRing: "none" },
    control: { borderColor: "border.emphasized" },
    incrementTrigger: { color: "fg.muted", _hover: { bg: "navy.100", color: "fg.strong" } },
    decrementTrigger: { color: "fg.muted", _hover: { bg: "navy.100", color: "fg.strong" } },
  },
  variants: {
    size: {
      sm: { input: { fontSize: "14px", px: "3" } },
      md: { input: { fontSize: "15px", px: "3" } },
    },
  },
});
