import { defineSlotRecipe } from "@chakra-ui/react";

/**
 * パンくずリスト。現在地は `fg.subtle` の semibold。
 */
export const breadcrumb = defineSlotRecipe({
  className: "cho-breadcrumb",
  slots: ["root", "item", "separator", "link", "current"],
  base: {
    root: {
      display: "flex",
      flexWrap: "wrap",
      alignItems: "center",
      gap: "2",
      textStyle: "body.sm",
    },
    item: {
      display: "flex",
      alignItems: "center",
      gap: "2",
    },
    separator: {
      color: "fg.muted",
    },
    link: {
      color: "fg",
    },
    current: {
      color: "fg.subtle",
      fontWeight: "semibold",
    },
  },
});
