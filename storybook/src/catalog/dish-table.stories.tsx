import type { Meta, StoryObj } from "@storybook/react-vite";
import { BookOpen } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { DishTable } from "@/routes/_app/dishes/-components/dish-table";

import { dishRows } from "./fixtures";

const meta = {
  title: "Catalog/DishTable",
  component: DishTable,
  args: {
    rows: dishRows,
    onSelect: () => undefined,
    empty: <EmptyState icon={<BookOpen strokeWidth={1.75} />} title="レシピがありません" />,
  },
} satisfies Meta<typeof DishTable>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Loading: Story = { args: { loading: true } };

export const Empty: Story = { args: { rows: [] } };

export const Mobile: Story = {
  globals: { viewport: { value: "mobile", isRotated: false } },
};
