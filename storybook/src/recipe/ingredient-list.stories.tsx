import { Box } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import {
  buildIngredientGroups,
  buildIngredientItems,
} from "@/components/recipe/build-ingredient-items";
import { IngredientList } from "@/components/recipe/ingredient-list";

import { curryRecipe, curryRecipeSplitOil, gratinDish, ingredientById } from "./fixtures";

const curryItems = buildIngredientItems(curryRecipeSplitOil, { scale: 1, ingredientById });

const meta = {
  title: "Recipe/IngredientList",
  component: IngredientList,
  args: { items: buildIngredientItems(gratinDish.recipe, { scale: 1, ingredientById }) },
  render: (args) => (
    <Box maxW={args.columns === 2 ? "960px" : "640px"}>
      <IngredientList {...args} />
    </Box>
  ),
} satisfies Meta<typeof IngredientList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** ★ 隠し味のグループと、2 つの手順で使う油。 */
export const WithGroups: Story = {
  args: { items: curryItems, groups: buildIngredientGroups(curryRecipe) },
};

export const WithNutrition: Story = {
  args: { items: curryItems, groups: buildIngredientGroups(curryRecipe), showNutrition: true },
};

/** 単価が無い材料（最初の 2 品）は「単価未登録」と出る。 */
export const WithUnpriced: Story = {
  args: {
    items: curryItems.map((item, index) => (index < 2 ? { ...item, costYen: null } : item)),
    groups: buildIngredientGroups(curryRecipe),
    showNutrition: true,
  },
};

/** 栄養価を出さない表示でも、単価が無い材料の行に「単価未登録」が付く。 */
export const UnpricedWithoutNutrition: Story = {
  args: {
    items: curryItems.map((item, index) => (index < 2 ? { ...item, costYen: null } : item)),
    groups: buildIngredientGroups(curryRecipe),
  },
};

/** 6 人前に換算した分量。 */
export const Scaled: Story = {
  args: {
    items: buildIngredientItems(curryRecipe, { scale: 1.5, ingredientById }),
    groups: buildIngredientGroups(curryRecipe),
  },
};

export const TwoColumns: Story = {
  args: { items: curryItems, groups: buildIngredientGroups(curryRecipe), columns: 2 },
};
