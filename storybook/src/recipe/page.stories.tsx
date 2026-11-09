import type { Meta, StoryObj } from "@storybook/react-vite";

import { AppShell } from "@/components/layout/app-shell";
import { DishDetailView } from "@/routes/_app/dishes/$dishId/-components/dish-detail-view";

import { curryDish, currySchedule, gratinDish, gratinSchedule, ingredientById } from "./fixtures";

/**
 * レシピ詳細画面の本文 (データ取得なし)。工程表 → 材料 → 手順、lg 以上は右に栄養価と補足。
 */
const meta = {
  title: "Recipe/Page",
  component: DishDetailView,
  parameters: { layout: "fullscreen", router: { path: "/dishes/dish-curry" } },
  render: (args) => (
    <AppShell pathname="/dishes/dish-curry">
      <DishDetailView {...args} />
    </AppShell>
  ),
  args: { dish: curryDish, schedule: currySchedule, ingredientById },
} satisfies Meta<typeof DishDetailView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Desktop: Story = {
  globals: { viewport: { value: "desktop", isRotated: false } },
};

export const Mobile: Story = {
  globals: { viewport: { value: "mobile", isRotated: false } },
};

export const InProgress: Story = {
  args: { initialCompletedStepIds: ["s-rice", "s-cut"], initialServings: 2 },
  globals: { viewport: { value: "desktop", isRotated: false } },
};

export const Gratin: Story = {
  args: { dish: gratinDish, schedule: gratinSchedule },
  globals: { viewport: { value: "desktop", isRotated: false } },
};
