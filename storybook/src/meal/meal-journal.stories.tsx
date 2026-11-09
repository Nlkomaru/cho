import type { Meta, StoryObj } from "@storybook/react-vite";

import { MealJournal, MealJournalSkeleton } from "@/components/meal/meal-journal";
import { groupMealsByDay } from "@/components/meal/meal-shared";

import { weekMeals } from "./fixtures";

const meta = {
  title: "Meal/MealJournal",
  component: MealJournal,
  args: { days: groupMealsByDay(weekMeals) },
} satisfies Meta<typeof MealJournal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Mobile: Story = {
  globals: { viewport: { value: "mobile", isRotated: false } },
};

export const Loading: Story = {
  render: () => <MealJournalSkeleton />,
};
