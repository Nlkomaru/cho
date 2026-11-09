import type { Meta, StoryObj } from "@storybook/react-vite";
import { Carrot } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { IngredientTable } from "@/routes/_app/ingredients/-components/ingredient-table";

import { ingredients } from "./fixtures";

const meta = {
  title: "Catalog/IngredientTable",
  component: IngredientTable,
  args: {
    items: ingredients,
    onSelect: () => undefined,
    empty: <EmptyState icon={<Carrot strokeWidth={1.75} />} title="材料がありません" />,
  },
} satisfies Meta<typeof IngredientTable>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const SelectedRow: Story = { args: { selectedId: "carrot" } };

export const Loading: Story = { args: { loading: true } };

export const Empty: Story = { args: { items: [] } };

export const Mobile: Story = {
  globals: { viewport: { value: "mobile", isRotated: false } },
};
