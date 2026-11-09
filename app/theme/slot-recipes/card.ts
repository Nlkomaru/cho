import { defineSlotRecipe } from "@chakra-ui/react";
import { cardAnatomy } from "@chakra-ui/react/anatomy";

/**
 * カード。角を立てた白地 + 1px の細罫、影なし。
 * plain は余白も枠もなし (余白はコンポーネント側で 0 にする)。
 */
export const cardSlotRecipe = defineSlotRecipe({
  className: "chakra-card",
  slots: cardAnatomy.keys(),
  base: {
    root: {
      borderRadius: "none",
      color: "fg",
      bg: "bg.panel",
      boxShadow: "none",
    },
    header: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: "4",
    },
    title: { textStyle: "heading.card", color: "fg.strong" },
    description: { textStyle: "caption", color: "fg.subtle", mt: "1" },
    body: { gap: "4" },
    footer: {
      borderTopWidth: "1px",
      borderColor: "border",
      pt: "4",
      mx: "var(--card-padding)",
      px: "0",
      flexWrap: "wrap",
    },
  },
  variants: {
    variant: {
      outline: { root: { bg: "bg.panel", borderWidth: "1px", borderColor: "border" } },
      subtle: { root: { bg: "bg.subtle", borderWidth: "0" } },
      plain: { root: { bg: "transparent", borderWidth: "0" } },
      elevated: { root: { bg: "bg.panel", borderWidth: "1px", borderColor: "border" } },
    },
    size: {
      sm: { root: { "--card-padding": "spacing.4" }, title: { textStyle: "heading.card" } },
      md: {
        root: { "--card-padding": { base: "spacing.4", md: "spacing.5" } },
        title: { textStyle: "heading.card" },
      },
      lg: { root: { "--card-padding": "spacing.6" }, title: { textStyle: "heading.section" } },
    },
  },
  defaultVariants: {
    variant: "outline",
    size: "md",
  },
});
