import { defineSlotRecipe } from "@chakra-ui/react";
import { checkboxAnatomy } from "@chakra-ui/react/anatomy";

/**
 * チェックボックス。16px、角丸 l1、チェック時は紺の塗り。
 */
export const checkboxSlotRecipe = defineSlotRecipe({
  className: "chakra-checkbox",
  slots: checkboxAnatomy.keys(),
  base: {
    root: { gap: "2.5" },
    label: { color: "fg", fontWeight: "400" },
    control: {
      borderRadius: "l1",
      borderColor: "border.emphasized",
      bg: "bg.panel",
      "&:is([data-state=checked], [data-state=indeterminate])": {
        bg: "navy.900",
        borderColor: "navy.900",
        color: "white",
      },
      _focusVisible: {
        outline: "2px solid {colors.navy.900}",
        outlineOffset: "2px",
      },
    },
  },
  variants: {
    size: {
      sm: { root: { gap: "2" }, label: { fontSize: "14px" }, control: { boxSize: "4" } },
      md: { root: { gap: "2.5" }, label: { fontSize: "15px" }, control: { boxSize: "4" } },
    },
  },
});
