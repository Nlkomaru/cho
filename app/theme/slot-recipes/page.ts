import { defineSlotRecipe } from "@chakra-ui/react";

/**
 * ページの外枠とページヘッダー。余白と最大幅はここで決め、画面側には書かない。
 */
export const pageSlotRecipe = defineSlotRecipe({
  className: "page",
  slots: ["root", "header", "back", "titleRow", "title", "meta", "actions"],
  base: {
    root: {
      w: "full",
      maxW: "calc({sizes.page.lg} + 2 * {spacing.12})",
      mx: "auto",
      px: { base: "4", md: "8", xl: "12" },
      pt: { base: "6", md: "10" },
      pb: "24",
      display: "flex",
      flexDirection: "column",
      gap: { base: "10", md: "12" },
      minW: "0",
    },
    header: { display: "flex", flexDirection: "column", gap: "3", minW: "0" },
    back: {
      display: "inline-flex",
      alignItems: "center",
      alignSelf: "flex-start",
      gap: "1.5",
      textStyle: "body.sm",
      color: "fg.muted",
      textDecoration: "none",
      "& svg": { boxSize: "4" },
      _hover: { color: "fg.strong", textDecoration: "underline", textUnderlineOffset: "3px" },
      _focusVisible: { outline: "2px solid", outlineColor: "navy.900", outlineOffset: "2px" },
    },
    // 操作はタイトルの行にそろえ、meta はその下に置く (meta の有無で操作の位置が変わらない)
    titleRow: {
      display: "grid",
      gridTemplateColumns: { base: "minmax(0, 1fr)", md: "minmax(0, 1fr) auto" },
      gridTemplateAreas: { base: '"title" "meta" "actions"', md: '"title actions" "meta meta"' },
      alignItems: "center",
      columnGap: "6",
    },
    title: { gridArea: "title", color: "fg.strong", minW: "0", overflowWrap: "anywhere" },
    meta: {
      gridArea: "meta",
      display: "flex",
      flexWrap: "wrap",
      alignItems: "center",
      columnGap: "2",
      rowGap: "1",
      mt: "2",
      textStyle: "body.sm",
      color: "fg.muted",
      fontVariantNumeric: "tabular-nums",
    },
    actions: {
      gridArea: "actions",
      display: "flex",
      flexWrap: "wrap",
      alignItems: "center",
      gap: "2",
      mt: { base: "4", md: "0" },
    },
  },
  variants: {
    size: {
      // 外枠は常に lg の格子に置き、左端をヘッダーのロゴとそろえる。狭いページは中身の幅だけ絞る
      sm: { root: { "& > *": { maxW: "page.sm" } } },
      md: { root: { "& > *": { maxW: "page.md" } } },
      lg: {},
    },
    titleSize: {
      page: { title: { textStyle: "heading.page" } },
      display: { title: { textStyle: "display" } },
    },
  },
  defaultVariants: { size: "lg", titleSize: "page" },
});
