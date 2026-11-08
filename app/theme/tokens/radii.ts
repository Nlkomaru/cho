import { defineTokens } from "@chakra-ui/react";

/**
 * 角丸のプリミティブ。セマンティックトークン `l1` / `l2` / `l3` から参照する。
 * カード・入力欄は仕様どおり `l3` (6px) を使う。
 */
export const radii = defineTokens.radii({
  none: { value: "0" },
  "2xs": { value: "0.0625rem" },
  xs: { value: "0.125rem" },
  sm: { value: "0.25rem" },
  md: { value: "0.375rem" },
  lg: { value: "0.5rem" },
  xl: { value: "0.75rem" },
  "2xl": { value: "1rem" },
  "3xl": { value: "1.5rem" },
  full: { value: "9999px" },
});
