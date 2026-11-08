import { defineRecipe } from "@chakra-ui/react";

/**
 * サイドバーのナビゲーション項目。赤はアクティブ表示にのみ使う
 * (spec/02_design-system.md §3.2, §4.1)。
 */
export const navItem = defineRecipe({
  className: "cho-nav-item",
  base: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "2",
    paddingInline: "3",
    paddingBlock: "2",
    borderRadius: "l3",
    color: "fg",
    fontWeight: "normal",
    textDecoration: "none",
    transitionProperty: "background-color, color",
    transitionDuration: "fast",
    _hover: { background: "bg.subtle", textDecoration: "none" },
    _focusVisible: {
      outline: "2px solid",
      outlineColor: "red.border",
      outlineOffset: "2px",
    },
  },
  variants: {
    active: {
      true: {
        background: "red.subtle",
        color: "red.fg",
        fontWeight: "semibold",
        _hover: { background: "red.subtle" },
      },
      false: {},
    },
    emphasis: {
      primary: { fontSize: "md" },
      resource: { fontSize: "sm", color: "fg.muted" },
    },
  },
  defaultVariants: { active: false, emphasis: "primary" },
});
