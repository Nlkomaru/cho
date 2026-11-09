import { defineTokens } from "@chakra-ui/react";

/**
 * 色のプリミティブ。白地に紺の文字、赤は唯一のアクセント。
 * 画面側では直接参照せず、semantic-tokens/colors.ts の意味づけを使う。
 */
export const colors = defineTokens.colors({
  white: { value: "#ffffff" },
  black: { value: "#000000" },
  navy: {
    50: { value: "#f9fafb" },
    100: { value: "#f2f4f6" },
    200: { value: "#eaecf0" },
    300: { value: "#d0d5dd" },
    400: { value: "#98a2b3" },
    500: { value: "#5c667a" },
    600: { value: "#485261" },
    700: { value: "#333a47" },
    800: { value: "#222830" },
    900: { value: "#111820" },
    950: { value: "#0b1016" },
  },
  red: {
    50: { value: "#fdecee" },
    100: { value: "#fbd5d9" },
    200: { value: "#f6aab3" },
    300: { value: "#ef7684" },
    400: { value: "#e63f53" },
    500: { value: "#e3132c" },
    600: { value: "#dc001a" },
    700: { value: "#b80016" },
    800: { value: "#93000f" },
    900: { value: "#6e000b" },
    950: { value: "#4a0007" },
  },
  green: {
    50: { value: "#ecfdf3" },
    100: { value: "#d1fadf" },
    200: { value: "#a6f4c5" },
    600: { value: "#067647" },
    700: { value: "#085d3a" },
  },
  amber: {
    50: { value: "#fffaeb" },
    100: { value: "#fef0c7" },
    200: { value: "#fedf89" },
    600: { value: "#b54708" },
    700: { value: "#93370d" },
  },
});
