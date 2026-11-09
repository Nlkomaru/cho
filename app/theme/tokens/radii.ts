import { defineTokens } from "@chakra-ui/react";

/**
 * 角丸のプリミティブ。面 (カード・表・セクション) は角を立て、
 * 操作要素 (ボタン) だけを丸くする。
 */
export const radii = defineTokens.radii({
  none: { value: "0" },
  xs: { value: "2px" },
  sm: { value: "4px" },
  md: { value: "6px" },
  full: { value: "9999px" },
});
