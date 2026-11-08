import { defineSlotRecipe } from "@chakra-ui/react";

/**
 * カード (spec/02_design-system.md §4.2)
 * 1px solid `border` (#e4e4e7) / 背景 `bg.panel` (#FFFFFF) / 角丸 `l3` (6px)。
 * 影・グラデーションは使わない。
 */
export const card = defineSlotRecipe({
  className: "cho-card",
  slots: ["root", "media", "header", "title", "description", "meta", "body", "footer"],
  base: {
    root: {
      display: "flex",
      flexDirection: "column",
      minWidth: "0",
      borderWidth: "1px",
      borderColor: "border",
      borderRadius: "l3",
      background: "bg.panel",
      color: "fg",
      boxShadow: "none",
      overflow: "hidden",
    },
    media: {
      display: "block",
      background: "bg.muted",
      lineHeight: "0",
      "& > img": {
        width: "full",
        maxHeight: "180px",
        objectFit: "cover",
      },
    },
    header: {
      display: "flex",
      flexDirection: "column",
      gap: "1",
      paddingInline: "4",
      paddingTop: "4",
    },
    title: {
      textStyle: "heading.sm",
      overflowWrap: "anywhere",
    },
    description: {
      textStyle: "caption",
    },
    meta: {
      textStyle: "body.sm",
      color: "fg.muted",
    },
    body: {
      display: "flex",
      flexDirection: "column",
      flex: "1",
      gap: "2",
      padding: "4",
    },
    footer: {
      display: "flex",
      alignItems: "center",
      gap: "2",
      paddingInline: "4",
      paddingBottom: "4",
    },
  },
  variants: {
    padding: {
      sm: {
        header: { paddingInline: "3", paddingTop: "3" },
        body: { padding: "3" },
        footer: { paddingInline: "3", paddingBottom: "3" },
      },
      md: {},
    },
  },
  defaultVariants: { padding: "md" },
});
