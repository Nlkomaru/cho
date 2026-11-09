import { defineSlotRecipe } from "@chakra-ui/react";
import { switchAnatomy } from "@chakra-ui/react/anatomy";

/**
 * スイッチ。オフは navy.300、オンは navy.900。赤は使わない。
 */
export const switchSlotRecipe = defineSlotRecipe({
  className: "chakra-switch",
  slots: switchAnatomy.keys(),
  base: {
    label: { color: "fg", fontWeight: "500" },
    control: {
      bg: "navy.300",
      _checked: { bg: "navy.900" },
      _focusVisible: {
        outline: "2px solid {colors.navy.900}",
        outlineOffset: "2px",
      },
    },
    thumb: { bg: "white", boxShadow: "none" },
  },
  variants: {
    variant: {
      solid: {
        control: { bg: "navy.300", _checked: { bg: "navy.900" } },
        thumb: { bg: "white" },
      },
    },
    size: {
      sm: { label: { fontSize: "14px" } },
      md: { label: { fontSize: "14px" } },
    },
  },
});
