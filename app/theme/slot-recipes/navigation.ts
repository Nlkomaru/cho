import { defineSlotRecipe } from "@chakra-ui/react";
import { breadcrumbAnatomy, tabsAnatomy } from "@chakra-ui/react/anatomy";

/**
 * タブ。`line` は 2px の赤い下線で選択中を示す。
 */
export const tabsSlotRecipe = defineSlotRecipe({
  className: "chakra-tabs",
  slots: tabsAnatomy.keys(),
  base: {
    trigger: {
      fontWeight: "500",
      _focusVisible: { outline: "2px solid {colors.navy.900}", outlineOffset: "-2px" },
    },
  },
  variants: {
    variant: {
      line: {
        list: { borderColor: "border", gap: "6" },
        trigger: {
          px: "0",
          color: "fg.muted",
          _hover: { color: "fg.strong" },
          _selected: {
            color: "fg.strong",
            _horizontal: {
              layerStyle: "indicator.bottom",
              "--indicator-offset-y": "-1px",
              "--indicator-color": "colors.red.600",
              "--indicator-thickness": "2px",
            },
          },
        },
      },
    },
    size: {
      sm: { trigger: { fontSize: "14px" } },
      md: { root: { "--tabs-height": "sizes.11" }, trigger: { fontSize: "15px" } },
    },
  },
});

/**
 * パンくず。13px fg.muted、リンクはホバーで fg.strong。
 */
export const breadcrumbSlotRecipe = defineSlotRecipe({
  className: "chakra-breadcrumb",
  slots: breadcrumbAnatomy.keys(),
  base: {
    list: { color: "fg.muted", flexWrap: "wrap" },
    link: {
      color: "fg.muted",
      transitionProperty: "color",
      transitionDuration: "120ms",
      _hover: { color: "fg.strong", textDecoration: "underline", textUnderlineOffset: "3px" },
      _focusVisible: { outline: "2px solid {colors.navy.900}", outlineOffset: "2px" },
    },
    currentLink: { color: "fg.strong" },
    separator: { color: "fg.subtle", opacity: 1, _icon: { boxSize: "3" } },
  },
  variants: {
    size: {
      sm: { list: { gap: "1.5", fontSize: "13px", lineHeight: "18px" } },
      md: { list: { gap: "1.5", fontSize: "13px", lineHeight: "18px" } },
    },
  },
});
