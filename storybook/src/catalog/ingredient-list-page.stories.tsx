import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

import type { Ingredient } from "@/domain/ingredient";
import { IngredientEditorDrawer } from "@/routes/_app/ingredients/-components/ingredient-editor-drawer";
import { IngredientListView } from "@/routes/_app/ingredients/-components/ingredient-list-view";

import { buildNutritionFacts } from "../fixtures/food";
import { fakeInventiaActions, ingredients } from "./fixtures";

function IngredientListPage({
  items,
  loading,
  initialEditingId,
}: {
  items: readonly Ingredient[];
  loading?: boolean;
  initialEditingId?: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(Boolean(initialEditingId));
  const [editingId, setEditingId] = useState<string | null>(initialEditingId ?? null);
  const editing = items.find((item) => item.id === editingId) ?? null;

  return (
    <>
      <IngredientListView
        items={items}
        loading={loading}
        query={query}
        onQueryChange={setQuery}
        selectedId={open ? editingId : null}
        onSelect={(item) => {
          setEditingId(item.id);
          setOpen(true);
        }}
        onAdd={() => {
          setEditingId(null);
          setOpen(true);
        }}
      />
      <IngredientEditorDrawer
        open={open}
        onOpenChange={setOpen}
        ingredient={editing}
        onSave={async () => setOpen(false)}
        onDelete={async () => setOpen(false)}
        onEstimate={async () => buildNutritionFacts()}
        inventia={fakeInventiaActions}
      />
    </>
  );
}

const meta = {
  title: "Catalog/IngredientListPage",
  component: IngredientListPage,
  parameters: { layout: "fullscreen", router: { path: "/ingredients" } },
  args: { items: ingredients },
} satisfies Meta<typeof IngredientListPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Desktop: Story = {
  globals: { viewport: { value: "desktop", isRotated: false } },
};

export const Mobile: Story = {
  globals: { viewport: { value: "mobile", isRotated: false } },
};

export const Editing: Story = {
  args: { initialEditingId: "onion" },
  globals: { viewport: { value: "desktop", isRotated: false } },
};

export const Empty: Story = { args: { items: [] } };
