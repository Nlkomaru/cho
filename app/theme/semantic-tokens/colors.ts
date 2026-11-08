import { defineSemanticTokens } from "@chakra-ui/react";

export const semanticColors = defineSemanticTokens.colors({
  bg: {
    DEFAULT: { value: "{colors.white}" },
    canvas: { value: "{colors.white}" },
    panel: { value: "{colors.white}" },
    subtle: { value: "{colors.gray.50}" },
    muted: { value: "{colors.gray.100}" },
    emphasized: { value: "{colors.gray.200}" },
  },
  fg: {
    DEFAULT: { value: "{colors.gray.700}" },
    muted: { value: "{colors.gray.600}" },
    subtle: { value: "{colors.black}" },
  },
  border: {
    DEFAULT: { value: "{colors.gray.200}" },
    muted: { value: "{colors.gray.100}" },
    outline: { value: "{colors.gray.300}" },
  },
  red: {
    solid: { value: "{colors.red.600}" },
    contrast: { value: "{colors.white}" },
    subtle: { value: "{colors.red.50}" },
    fg: { value: "{colors.red.700}" },
    border: { value: "{colors.red.500}" },
  },
});
