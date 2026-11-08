import { defineGlobalStyles } from "@chakra-ui/react";

/**
 * グローバル CSS (spec/02_design-system.md §1, §2)
 * Light モード固定。背景は白、本文は `fg`、見出しは `fg.subtle`。
 * 余白の初期化もここで行い、画面側でアドホックな margin を書かない。
 */
export const globalCss = defineGlobalStyles({
  ":root": { colorScheme: "light" },
  "html, body": {
    background: "bg.canvas",
    color: "fg",
    fontFamily: "body",
  },
  body: {
    margin: "0",
    minWidth: "320px",
  },
  "*, *::before, *::after": {
    boxSizing: "border-box",
  },
  "h1, h2, h3, h4, h5, h6, p, figure, blockquote, dl, dd": {
    margin: "0",
  },
  "h1, h2, h3, h4, h5, h6": {
    fontFamily: "heading",
    fontWeight: "semibold",
    color: "fg.subtle",
  },
  "b, strong": { fontWeight: "semibold" },
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
});
