import type { Meta, StoryObj } from "@storybook/react-vite";
import { UtensilsCrossed } from "lucide-react";

import { MealTable } from "@/components/meal/meal-table";
import { EmptyState } from "@/components/ui/empty-state";

import { weekMeals } from "./fixtures";

const meta = {
  title: "Meal/MealTable",
  component: MealTable,
  args: {
    meals: weekMeals,
    empty: (
      <EmptyState
        icon={<UtensilsCrossed strokeWidth={1.75} />}
        title="この期間の記録はありません"
      />
    ),
  },
} satisfies Meta<typeof MealTable>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Loading: Story = { args: { loading: true } };

export const Empty: Story = { args: { meals: [] } };

export const Mobile: Story = {
  globals: { viewport: { value: "mobile", isRotated: false } },
};
