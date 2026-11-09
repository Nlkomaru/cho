import { Box } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

import type { RecipeIngredientEntry } from "@/domain/recipe";
import { IngredientRows } from "@/routes/_app/dishes/new/-components/ingredient-rows";
import { emptyEntry, fieldIds } from "@/routes/_app/dishes/new/-components/recipe-draft";

import { curryDraft, editorIngredients } from "./fixtures";

const { recipe } = curryDraft;

function IngredientRowsDemo({
  initial,
  errors,
}: {
  initial: RecipeIngredientEntry[];
  errors?: Record<string, string>;
}) {
  const [entries, setEntries] = useState(initial);
  return (
    <Box maxW="800px">
      <IngredientRows
        entries={entries}
        groups={recipe.ingredientGroups}
        ingredients={editorIngredients}
        errors={errors}
        onAdd={() => setEntries((current) => [...current, emptyEntry()])}
        onRemove={(id) => setEntries((current) => current.filter((entry) => entry.id !== id))}
        onChange={(id, patch) =>
          setEntries((current) =>
            current.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)),
          )
        }
      />
    </Box>
  );
}

const incomplete: RecipeIngredientEntry = { ...emptyEntry(), id: "e-new" };

/**
 * 材料の編集行。md 以上は見出し行付きの表、狭い画面では各欄にラベルを出す。
 */
const meta = {
  title: "RecipeEditor/IngredientRows",
  component: IngredientRowsDemo,
  args: { initial: recipe.ingredients.slice(0, 6) },
} satisfies Meta<typeof IngredientRowsDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithGroups: Story = {
  args: { initial: recipe.ingredients },
};

export const Empty: Story = {
  args: { initial: [] },
};

export const WithErrors: Story = {
  args: {
    initial: [...recipe.ingredients.slice(0, 2), incomplete],
    errors: {
      [fieldIds.entry("e-new", "ingredient")]: "材料を選択",
      [fieldIds.entry("e-new", "amount")]: "基準量を入力",
      [fieldIds.entry("e-new", "display")]: "表示分量を入力",
    },
  },
};

export const Mobile: Story = {
  args: { initial: recipe.ingredients.slice(0, 4) },
  globals: { viewport: { value: "mobile", isRotated: false } },
};
