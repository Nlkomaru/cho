import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { Ingredient } from "@/domain/ingredient";
import { IngredientEditorDrawer } from "@/routes/_app/ingredients/-components/ingredient-editor-drawer";

import { buildNutritionFacts } from "../fixtures/food";
import { fakeInventiaActions, ingredients } from "./fixtures";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function DrawerDemo({ ingredient }: { ingredient: Ingredient | null }) {
  const [open, setOpen] = useState(true);
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        {ingredient ? "材料を編集" : "材料を追加"}
      </Button>
      <IngredientEditorDrawer
        open={open}
        onOpenChange={setOpen}
        ingredient={ingredient}
        onSave={async () => {
          await wait(400);
          setOpen(false);
        }}
        onDelete={async () => {
          await wait(400);
          setOpen(false);
        }}
        onEstimate={async () => {
          await wait(600);
          return buildNutritionFacts({
            caloriesKcal: 33,
            proteinG: 1,
            fatG: 0.1,
            carbohydrateG: 8.4,
            fiberG: 1.5,
            saltEquivalentG: 0,
          });
        }}
        inventia={fakeInventiaActions}
      />
    </>
  );
}

const onion = ingredients.find((item) => item.id === "onion") ?? null;
const potato = ingredients.find((item) => item.id === "potato") ?? null;
const carrot = ingredients.find((item) => item.id === "carrot") ?? null;

const meta = {
  title: "Catalog/IngredientEditorDrawer",
  component: DrawerDemo,
  parameters: { layout: "fullscreen" },
  args: { ingredient: onion },
} satisfies Meta<typeof DrawerDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const EditLinked: Story = {};

export const EditUnlinked: Story = { args: { ingredient: potato } };

export const WithMicronutrients: Story = { args: { ingredient: carrot } };

export const New: Story = { args: { ingredient: null } };

export const Mobile: Story = {
  globals: { viewport: { value: "mobile", isRotated: false } },
};
