import { defineSemanticTokens } from "@chakra-ui/react";

/**
 * セマンティックな角丸。`l3` がカード・フォームの基本半径 (6px)。
 */
export const semanticRadii = defineSemanticTokens.radii({
  l1: { value: "{radii.xs}" },
  l2: { value: "{radii.sm}" },
  l3: { value: "{radii.md}" },
});
