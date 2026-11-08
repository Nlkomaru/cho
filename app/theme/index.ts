import { createSystem, defaultConfig } from "@chakra-ui/react";

import { globalCss } from "./global-css";
import { appHeader } from "./recipes/app-header";
import { feedback } from "./recipes/feedback";
import { fieldControl } from "./recipes/field-control";
import { navItem } from "./recipes/nav-item";
import { page } from "./recipes/page";
import { semanticColors } from "./semantic-tokens/colors";
import { semanticRadii } from "./semantic-tokens/radii";
import { breadcrumb } from "./slot-recipes/breadcrumb";
import { card } from "./slot-recipes/card";
import { dataTable } from "./slot-recipes/data-table";
import { formField } from "./slot-recipes/form-field";
import { ganttChart } from "./slot-recipes/gantt-chart";
import { list } from "./slot-recipes/list";
import { pageHeader } from "./slot-recipes/page-header";
import { section } from "./slot-recipes/section";
import { sidebar } from "./slot-recipes/sidebar";
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
      appHeader,
      feedback,
      fieldControl,
      navItem,
      page,
    },
    slotRecipes: {
      breadcrumb,
      card,
      dataTable,
      formField,
      ganttChart,
      list,
      pageHeader,
      section,
      sidebar,
      statBar,
    },
  },
});
