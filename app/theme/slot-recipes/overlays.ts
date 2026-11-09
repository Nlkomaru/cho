import { defineSlotRecipe } from "@chakra-ui/react";
import {
  dialogAnatomy,
  drawerAnatomy,
  menuAnatomy,
  popoverAnatomy,
  toastAnatomy,
  tooltipAnatomy,
} from "@chakra-ui/react/anatomy";

const backdrop = {
  bg: "rgba(17, 24, 32, 0.4)",
  backdropFilter: "none",
};

/**
 * ダイアログ。角丸 l3、影は shadow.dialog。フッターのボタンは右寄せ。
 */
export const dialogSlotRecipe = defineSlotRecipe({
  className: "chakra-dialog",
  slots: dialogAnatomy.keys(),
  base: {
    backdrop,
    content: {
      bg: "bg.panel",
      borderRadius: "l3",
      boxShadow: "dialog",
      color: "fg",
    },
    header: { px: "6", pt: "6", pb: "0", gap: "1" },
    title: { textStyle: "heading.section", color: "fg.strong" },
    description: { textStyle: "body.sm", color: "fg.muted" },
    body: { px: "6", pt: "5", pb: "6", display: "flex", flexDirection: "column", gap: "5" },
    footer: { px: "6", pt: "0", pb: "6", gap: "2", justifyContent: "flex-end" },
    closeTrigger: { top: "4", insetEnd: "4" },
  },
  variants: {
    size: {
      sm: { content: { maxW: "400px" } },
      md: { content: { maxW: "520px" } },
      lg: { content: { maxW: "720px" } },
    },
  },
});

/**
 * ドロワー。右から開き、角なし。ヘッダー下とフッター上に細罫。
 */
export const drawerSlotRecipe = defineSlotRecipe({
  className: "chakra-drawer",
  slots: drawerAnatomy.keys(),
  base: {
    backdrop,
    content: {
      bg: "bg.panel",
      borderRadius: "none",
      boxShadow: "dialog",
      color: "fg",
    },
    header: {
      px: { base: "4", md: "6" },
      py: "4",
      minH: "16",
      display: "flex",
      alignItems: "center",
      borderBottomWidth: "1px",
      borderColor: "border",
    },
    title: { textStyle: "heading.section", color: "fg.strong" },
    body: {
      px: { base: "4", md: "6" },
      py: "6",
      display: "flex",
      flexDirection: "column",
      gap: "6",
    },
    footer: {
      px: { base: "4", md: "6" },
      py: "4",
      gap: "2",
      borderTopWidth: "1px",
      borderColor: "border",
      bg: "bg.panel",
      position: "sticky",
      bottom: "0",
      justifyContent: "flex-end",
    },
    closeTrigger: { top: "3.5", insetEnd: { base: "3", md: "5" } },
  },
  variants: {
    size: {
      xs: { content: { maxW: "320px" } },
      sm: { content: { maxW: "400px" } },
      md: { content: { maxW: "480px" } },
      lg: { content: { maxW: "640px" } },
    },
  },
});

/**
 * メニュー。白地、角丸 l2、影は shadow.overlay。
 */
export const menuSlotRecipe = defineSlotRecipe({
  className: "chakra-menu",
  slots: menuAnatomy.keys(),
  base: {
    content: {
      bg: "bg.panel",
      borderRadius: "l2",
      boxShadow: "overlay",
      p: "1",
      minW: "48",
    },
    item: {
      borderRadius: "l1",
      color: "fg.strong",
      gap: "2.5",
      _highlighted: { bg: "navy.100" },
      _icon: { width: "4", height: "4", color: "fg.muted" },
      "&[data-value=delete], &[data-tone=danger]": {
        color: "red.700",
        _icon: { color: "red.700" },
        _highlighted: { bg: "red.50" },
      },
    },
    separator: { bg: "border", my: "1" },
    itemGroupLabel: { textStyle: "caption", color: "fg.subtle", px: "2", py: "1.5" },
  },
  variants: {
    size: {
      sm: { item: { h: "8", px: "2", fontSize: "13px" } },
      md: { item: { h: "9", px: "2.5", fontSize: "14px" } },
    },
  },
});

export const popoverSlotRecipe = defineSlotRecipe({
  className: "chakra-popover",
  slots: popoverAnatomy.keys(),
  base: {
    content: {
      bg: "bg.panel",
      borderRadius: "l3",
      boxShadow: "overlay",
      color: "fg",
    },
    title: { textStyle: "heading.card", color: "fg.strong" },
  },
});

/**
 * ツールチップ。紺地に白文字 12px。
 */
export const tooltipSlotRecipe = defineSlotRecipe({
  className: "chakra-tooltip",
  slots: tooltipAnatomy.keys(),
  base: {
    content: {
      "--tooltip-bg": "colors.navy.900",
      color: "white",
      px: "2",
      py: "1",
      borderRadius: "l2",
      fontSize: "12px",
      lineHeight: "16px",
      fontWeight: "500",
      boxShadow: "none",
    },
  },
});

/**
 * トースト。白いパネル + 左の 2px バー (種類ごとの色)。
 */
export const toastSlotRecipe = defineSlotRecipe({
  className: "chakra-toast",
  slots: toastAnatomy.keys(),
  base: {
    root: {
      bg: "bg.panel",
      color: "fg",
      borderRadius: "l3",
      boxShadow: "overlay",
      borderInlineStartWidth: "2px",
      borderColor: "navy.900",
      py: "3",
      ps: "4",
      pe: "10",
      gap: "2.5",
      "&[data-type=warning]": { bg: "bg.panel", color: "fg", borderColor: "amber.600" },
      "&[data-type=success]": { bg: "bg.panel", color: "fg", borderColor: "green.600" },
      "&[data-type=error]": { bg: "bg.panel", color: "fg", borderColor: "red.600" },
    },
    title: { fontSize: "14px", lineHeight: "22px", fontWeight: "600", color: "fg.strong" },
    description: { fontSize: "14px", lineHeight: "22px", color: "fg.muted", opacity: "1" },
    closeTrigger: { top: "2", insetEnd: "2", color: "fg.subtle", _hover: { bg: "navy.100" } },
  },
});
