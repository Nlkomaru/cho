import { defineSlotRecipe } from "@chakra-ui/react";
import { segmentGroupAnatomy } from "@chakra-ui/react/anatomy";

/**
 * 切り替え (日/週/月、カード/表 など)。トラックは bg.muted、選択中は白地に罫線。
 */
export const segmentGroupSlotRecipe = defineSlotRecipe({
  className: "chakra-segment-group",
  slots: segmentGroupAnatomy.keys(),
  base: {
    root: {
      "--segment-radius": "radii.l2",
      "--segment-indicator-bg": "colors.white",
      "--segment-indicator-shadow": "0 0 0 1px {colors.border}",
      bg: "bg.muted",
      boxShadow: "none",
      p: "0.5",
      alignSelf: "flex-start",
    },
    item: {
      color: "fg.muted",
      fontWeight: "500",
      _checked: { color: "fg.strong" },
      _hover: { color: "fg.strong" },
      _before: { display: "none" },
      "&:has(input:focus-visible)": {
        outline: "2px solid {colors.navy.900}",
        outlineOffset: "2px",
      },
      _icon: { width: "4", height: "4" },
    },
    indicator: { boxShadow: "var(--segment-indicator-shadow)" },
  },
  variants: {
    size: {
      xs: { item: { h: "7", px: "2.5", fontSize: "13px", gap: "1.5" } },
      sm: { item: { h: "8", px: "3", fontSize: "14px", gap: "1.5" } },
      md: { item: { h: "9", px: "3.5", fontSize: "14px", gap: "2" } },
    },
  },
  defaultVariants: { size: "sm" },
});
