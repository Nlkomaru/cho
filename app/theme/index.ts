import { createSystem, defaultConfig } from "@chakra-ui/react";

import { globalCss } from "./global-css";
import { badgeRecipe } from "./recipes/badge";
import { buttonRecipe } from "./recipes/button";
import { inputRecipe, textareaRecipe } from "./recipes/input";
import { semanticColors } from "./semantic-tokens/colors";
import { semanticRadii } from "./semantic-tokens/radii";
import { semanticShadows } from "./semantic-tokens/shadows";
import { alertSlotRecipe } from "./slot-recipes/alert";
import { appHeaderSlotRecipe } from "./slot-recipes/app-header";
import { cardSlotRecipe } from "./slot-recipes/card";
import { checkboxSlotRecipe } from "./slot-recipes/checkbox";
import { datePickerSlotRecipe } from "./slot-recipes/date-picker";
import { emptyStateSlotRecipe } from "./slot-recipes/empty-state";
import { fieldSlotRecipe } from "./slot-recipes/field";
import { nativeSelectSlotRecipe } from "./slot-recipes/native-select";
import { breadcrumbSlotRecipe, tabsSlotRecipe } from "./slot-recipes/navigation";
import { numberInputSlotRecipe } from "./slot-recipes/number-input";
import {
  dialogSlotRecipe,
  drawerSlotRecipe,
  menuSlotRecipe,
  popoverSlotRecipe,
  toastSlotRecipe,
  tooltipSlotRecipe,
} from "./slot-recipes/overlays";
import { pageSlotRecipe } from "./slot-recipes/page";
import { sectionSlotRecipe } from "./slot-recipes/section";
import { segmentGroupSlotRecipe } from "./slot-recipes/segment-group";
import { selectSlotRecipe } from "./slot-recipes/select";
import { statGroupSlotRecipe } from "./slot-recipes/stat-group";
import { switchSlotRecipe } from "./slot-recipes/switch";
import { tableSlotRecipe } from "./slot-recipes/table";
import { textStyles } from "./text-styles";
import { colors } from "./tokens/colors";
import { fonts } from "./tokens/fonts";
import { radii } from "./tokens/radii";
import { sizes } from "./tokens/sizes";

/**
 * デザインシステムの単一の情報源。画面・コンポーネント・Storybook は
 * すべてこの `system` のトークンとレシピだけを参照する。
 * Chakra 組み込みのレシピ (button, card, table など) は同じキーで上書きし、
 * アプリ独自のレシピ (appHeader, page, section, statGroup) を追加する。
 */
export const system = createSystem(defaultConfig, {
  globalCss,
  theme: {
    tokens: {
      colors,
      fonts,
      radii,
      sizes,
    },
    semanticTokens: {
      colors: semanticColors,
      radii: semanticRadii,
      shadows: semanticShadows,
    },
    textStyles,
    recipes: {
      badge: badgeRecipe,
      button: buttonRecipe,
      input: inputRecipe,
      textarea: textareaRecipe,
    },
    slotRecipes: {
      alert: alertSlotRecipe,
      appHeader: appHeaderSlotRecipe,
      breadcrumb: breadcrumbSlotRecipe,
      card: cardSlotRecipe,
      checkbox: checkboxSlotRecipe,
      datePicker: datePickerSlotRecipe,
      dialog: dialogSlotRecipe,
      drawer: drawerSlotRecipe,
      emptyState: emptyStateSlotRecipe,
      field: fieldSlotRecipe,
      menu: menuSlotRecipe,
      nativeSelect: nativeSelectSlotRecipe,
      numberInput: numberInputSlotRecipe,
      page: pageSlotRecipe,
      popover: popoverSlotRecipe,
      section: sectionSlotRecipe,
      segmentGroup: segmentGroupSlotRecipe,
      select: selectSlotRecipe,
      statGroup: statGroupSlotRecipe,
      switch: switchSlotRecipe,
      table: tableSlotRecipe,
      tabs: tabsSlotRecipe,
      toast: toastSlotRecipe,
      tooltip: tooltipSlotRecipe,
    },
  },
});
