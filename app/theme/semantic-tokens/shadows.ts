import { defineSemanticTokens } from "@chakra-ui/react";

/**
 * 影は重なる要素 (メニュー・ポップオーバー・ダイアログ) にだけ使う。
 * カード・ボタン・入力欄は影を持たない。
 */
export const semanticShadows = defineSemanticTokens.shadows({
  overlay: {
    value: "0 12px 32px -8px rgba(17, 24, 32, 0.18), 0 0 0 1px rgba(141, 145, 154, 0.25)",
  },
  dialog: { value: "0 24px 64px -16px rgba(17, 24, 32, 0.28)" },
  xs: { value: "none" },
  sm: { value: "none" },
  md: { value: "{shadows.overlay}" },
  lg: { value: "{shadows.overlay}" },
  xl: { value: "{shadows.dialog}" },
  "2xl": { value: "{shadows.dialog}" },
  inset: { value: "none" },
});
