import { defineSlotRecipe } from "@chakra-ui/react";

/**
 * 画面の区切り。見出し行の下に 2px の紺の罫 (AISI の "Technical research")。
 * 見出しレベル 3 は細罫にする。`subHeading` は見出し + 右に伸びる細罫。
 */
export const sectionSlotRecipe = defineSlotRecipe({
  className: "section",
  slots: [
    "root",
    "header",
    "titleGroup",
    "title",
    "meta",
    "actions",
    "body",
    "subHeading",
    "subTitle",
    "subRule",
  ],
  base: {
    root: { display: "flex", flexDirection: "column", minW: "0" },
    header: {
      display: "flex",
      flexWrap: "wrap",
      alignItems: "center",
      justifyContent: "space-between",
      columnGap: "4",
      rowGap: "2",
      pb: "3",
    },
    titleGroup: { display: "flex", alignItems: "baseline", gap: "3", minW: "0" },
    title: { color: "fg.strong" },
    meta: { textStyle: "body.sm", color: "fg.subtle", fontVariantNumeric: "tabular-nums" },
    actions: { display: "flex", alignItems: "center", gap: "2", flexWrap: "wrap" },
    body: { mt: "5", minW: "0" },
    subHeading: { display: "flex", alignItems: "center", gap: "3", minW: "0" },
    subTitle: { textStyle: "heading.group", color: "fg.muted", flexShrink: 0 },
    subRule: { flex: "1", h: "1px", bg: "border" },
  },
  variants: {
    variant: {
      rule: { header: { borderBottomWidth: "2px", borderColor: "border.strong" } },
      plain: { header: { pb: "0" }, body: { mt: "4" } },
    },
    level: {
      h2: { title: { textStyle: "heading.section" } },
      h3: {
        title: { textStyle: "heading.card" },
        body: { mt: "4" },
      },
    },
  },
  compoundVariants: [
    {
      variant: "rule",
      level: "h3",
      css: { header: { borderBottomWidth: "1px", borderColor: "border", pb: "2.5" } },
    },
  ],
  defaultVariants: { variant: "rule", level: "h2" },
});
