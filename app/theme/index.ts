import { createSystem, defaultConfig } from "@chakra-ui/react";

import { globalCss } from "./global-css";
import { feedback } from "./recipes/feedback";
import { navItem } from "./recipes/nav-item";
import { numeric } from "./recipes/numeric";
import { page } from "./recipes/page";
import { semanticColors } from "./semantic-tokens/colors";
import { semanticRadii } from "./semantic-tokens/radii";
import { appNav } from "./slot-recipes/app-nav";
import { card } from "./slot-recipes/card";
import { ganttChart } from "./slot-recipes/gantt-chart";
import { journal } from "./slot-recipes/journal";
import { list } from "./slot-recipes/list";
import { pageHeader } from "./slot-recipes/page-header";
import { section } from "./slot-recipes/section";
import { statBar } from "./slot-recipes/stat-bar";
import { textStyles } from "./text-styles";
import { colors } from "./tokens/colors";
import { fonts } from "./tokens/fonts";
import { radii } from "./tokens/radii";

/**
 * デザインシステムの単一の情報源。画面・コンポーネント・Storybook は
 * すべてこの `system` のトークンとレシピだけを参照する。
 */
export const system = createSystem(defaultConfig, {
  globalCss,
  theme: {
    semanticTokens: {
      colors: semanticColors,
      radii: semanticRadii,
    },
    tokens: {
      colors,
      fonts,
      radii,
    },
    textStyles,
    recipes: {
      feedback,
      navItem,
      numeric,
      page,
    },
    slotRecipes: {
      appNav,
      card,
      ganttChart,
      journal,
      list,
      pageHeader,
      section,
      statBar,
    },
  },
});
