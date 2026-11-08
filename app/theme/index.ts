import { createSystem, defaultConfig } from "@chakra-ui/react";
import { semanticColors } from "./semantic-tokens/colors";
import { colors } from "./tokens/colors";
import { fonts } from "./tokens/fonts";

export const system = createSystem(defaultConfig, {
  globalCss: {
    ":root": { colorScheme: "light" },
    "html, body": {
      background: "bg.canvas",
      color: "fg",
      fontFamily: "body",
    },
  },
  theme: {
    semanticTokens: { colors: semanticColors },
    tokens: { colors, fonts },
  },
});
