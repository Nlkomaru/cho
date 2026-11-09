import { defineSlotRecipe } from "@chakra-ui/react";
import { emptyStateAnatomy } from "@chakra-ui/react/anatomy";

/**
 * 空状態。上罫線の下に、灰色の円に赤い線画アイコン (AISI のアイコン円)。
 */
export const emptyStateSlotRecipe = defineSlotRecipe({
  className: "chakra-empty-state",
  slots: emptyStateAnatomy.keys(),
  base: {
    root: {
      width: "full",
      borderTopWidth: "1px",
      borderColor: "border",
      py: "12",
      px: "4",
    },
    content: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      textAlign: "center",
      gap: "3",
    },
    indicator: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      boxSize: "12",
      borderRadius: "full",
      bg: "navy.100",
      color: "red.600",
      _icon: { boxSize: "5" },
    },
    title: { textStyle: "heading.card", color: "fg.strong" },
    description: { textStyle: "body.sm", color: "fg.muted", maxW: "sm" },
  },
  variants: {
    size: {
      sm: { root: { py: "8" } },
      md: { root: { py: "12" } },
      lg: { root: { py: "16" } },
    },
  },
  defaultVariants: { size: "md" },
});
