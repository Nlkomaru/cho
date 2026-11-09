import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

import type { DishRow } from "@/routes/_app/dishes/-components/dish-table";
import { DishListView } from "@/routes/_app/dishes/-components/dish-list-view";

import { dishRows } from "./fixtures";

function DishListPage({
  rows,
  loading,
  error,
}: {
  rows: readonly DishRow[];
  loading?: boolean;
  error?: string;
}) {
  const [query, setQuery] = useState("");
  return (
    <DishListView
      rows={rows}
      loading={loading}
      error={error}
      onRetry={() => undefined}
      query={query}
      onQueryChange={setQuery}
      onSelect={() => undefined}
    />
  );
}

const meta = {
  title: "Catalog/DishListPage",
  component: DishListPage,
  parameters: { layout: "fullscreen", router: { path: "/dishes" } },
  args: { rows: dishRows },
} satisfies Meta<typeof DishListPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Desktop: Story = {
  globals: { viewport: { value: "desktop", isRotated: false } },
};

export const Mobile: Story = {
  globals: { viewport: { value: "mobile", isRotated: false } },
};

export const Loading: Story = { args: { loading: true } };

export const Empty: Story = { args: { rows: [] } };

export const LoadError: Story = {
  args: { rows: [], error: "通信に失敗しました (500)" },
};
