import { defineSemanticTokens } from "@chakra-ui/react";

/**
 * Chakra 組み込みコンポーネントが参照する角丸。
 * l1: バー・小さなチップ、l2: 入力・タグ・メニュー、l3: ダイアログ・ポップオーバー。
 */
export const semanticRadii = defineSemanticTokens.radii({
  l1: { value: "{radii.xs}" },
  l2: { value: "{radii.sm}" },
  l3: { value: "{radii.md}" },
});
