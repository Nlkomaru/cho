import type { Meta, StoryObj } from "@storybook/react-vite";

import { RecipeMetaDialog } from "@/routes/_app/dishes/$dishId/-components/recipe-meta-dialog";

import { curryDish } from "./fixtures";

/** 詳細画面から料理名・カテゴリ・メモだけを直すダイアログ。 */
const meta = {
  title: "Recipe/RecipeMetaDialog",
  component: RecipeMetaDialog,
  parameters: { layout: "fullscreen" },
  args: {
    open: true,
    onOpenChange: () => undefined,
    initial: {
      name: curryDish.name,
      category: curryDish.category,
      notes: "隠し味のしょうゆとみりんはルウを溶かした後に加える。",
    },
    onSubmit: () => undefined,
  },
} satisfies Meta<typeof RecipeMetaDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = {
  args: { initial: { name: "", category: null, notes: null } },
};

export const Busy: Story = { args: { busy: true } };

export const Failed: Story = {
  args: { error: "保存できませんでした。時間をおいて再度お試しください。" },
};

export const Mobile: Story = { globals: { viewport: { value: "mobile", isRotated: false } } };
