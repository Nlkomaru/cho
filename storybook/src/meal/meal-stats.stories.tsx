import type { Meta, StoryObj } from "@storybook/react-vite";

import { summarizeMeals } from "@/components/meal/meal-shared";
import { MealStats } from "@/components/meal/meal-stats";

import { convenienceMeal, curryMeal, weekMeals } from "./fixtures";

const meta = {
  title: "Meal/MealStats",
  component: MealStats,
  args: { label: "期間の集計", totals: summarizeMeals(weekMeals) },
} satisfies Meta<typeof MealStats>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 期間の集計。栄養価の無い記録は除いて合計し、その件数を添える。 */
export const Period: Story = {};

export const SingleMeal: Story = {
  args: { label: "この食事の合計", totals: summarizeMeals([curryMeal]) },
};

export const WithoutNutrition: Story = {
  args: { label: "この食事の合計", totals: summarizeMeals([convenienceMeal]) },
};

export const Loading: Story = { args: { totals: null } };
