import { defineGlobalStyles } from "@chakra-ui/react";

/**
 * グローバル CSS。Light テーマ固定で、背景は白、本文は紺。
 * 余白の初期化もここで行い、画面側でアドホックな margin を書かない。
 */
export const globalCss = defineGlobalStyles({
  ":root": { colorScheme: "light" },
  html: {
    colorPalette: "navy",
    bg: "bg.canvas",
    color: "fg",
    lineHeight: "1.6",
  },
  body: {
    margin: "0",
    minWidth: "320px",
    bg: "bg.canvas",
    color: "fg",
    fontFamily: "body",
    textStyle: "body",
    textRendering: "optimizeLegibility",
  },
  "*": {
    fontFeatureSettings: "normal",
    "--global-color-border": "colors.border",
  },
  "*, *::before, *::after": {
    boxSizing: "border-box",
  },
  "h1, h2, h3, h4, h5, h6, p, figure, blockquote, dl, dd": {
    margin: "0",
  },
  "h1, h2, h3, h4, h5, h6": {
    fontFamily: "heading",
    fontWeight: "500",
    color: "fg.strong",
  },
  "b, strong": { fontWeight: "600" },
  a: {
    color: "inherit",
    textDecoration: "none",
  },
  "button, input, select, textarea": {
    font: "inherit",
    color: "inherit",
  },
  table: {
    borderCollapse: "collapse",
    borderSpacing: "0",
  },
  "img, svg, video, canvas": {
    display: "block",
    verticalAlign: "middle",
  },
  "*::placeholder, *[data-placeholder]": {
    color: "navy.400",
  },
  "*::selection": {
    bg: "red.100",
    color: "fg.strong",
  },
});
