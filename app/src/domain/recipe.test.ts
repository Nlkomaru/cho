import { describe, expect, test } from "vite-plus/test";

import {
  dropRedundantLabels,
  recipeEntryName,
  recipeIngredientEntrySchema,
  UNKNOWN_INGREDIENT_NAME,
  withEntryNames,
} from "./recipe";

const entry = (extra: Record<string, unknown> = {}) => ({
  id: "e-onion",
  ingredientId: "ing-onion",
  amount: 100,
  unit: "g",
  displayAmount: "1/2個",
  ...extra,
});
const master = new Map([["ing-onion", { name: "玉ねぎ" }]]);

describe("recipe ingredient entries", () => {
  test("label is optional and defaults to null", () => {
    expect(recipeIngredientEntrySchema.parse(entry()).label).toBeNull();
  });

  test("a legacy name is read as the label", () => {
    const parsed = recipeIngredientEntrySchema.parse(entry({ name: "新玉ねぎ" }));
    expect(parsed.label).toBe("新玉ねぎ");
    expect(parsed).not.toHaveProperty("name");
  });

  test("with a label key, name is a read-only display name and is ignored", () => {
    expect(
      recipeIngredientEntrySchema.parse(entry({ label: null, name: "玉ねぎ" })).label,
    ).toBeNull();
    expect(
      recipeIngredientEntrySchema.parse(entry({ label: "飾り用", name: "飾り用" })).label,
    ).toBe("飾り用");
  });

  test("a blank label means the master name", () => {
    expect(recipeIngredientEntrySchema.parse(entry({ label: "  " })).label).toBeNull();
    expect(recipeIngredientEntrySchema.parse(entry({ name: "" })).label).toBeNull();
  });

  test("the display name is the label, else the master name", () => {
    expect(recipeEntryName({ ingredientId: "ing-onion", label: null }, master)).toBe("玉ねぎ");
    expect(recipeEntryName({ ingredientId: "ing-onion", label: "飾り用" }, master)).toBe("飾り用");
    expect(recipeEntryName({ ingredientId: "ing-missing", label: null }, master)).toBe(
      UNKNOWN_INGREDIENT_NAME,
    );
  });

  test("labels that repeat the master name are dropped", () => {
    const recipe = {
      ingredients: [
        recipeIngredientEntrySchema.parse(entry({ label: "玉ねぎ" })),
        recipeIngredientEntrySchema.parse(entry({ id: "e-2", label: "飾り用" })),
      ],
    };
    expect(dropRedundantLabels(recipe, master).ingredients.map((item) => item.label)).toEqual([
      null,
      "飾り用",
    ]);
    const clean = { ingredients: [recipe.ingredients[1]] };
    expect(dropRedundantLabels(clean, master)).toBe(clean);
  });

  test("outputs carry the display name next to the label", () => {
    const recipe = { ingredients: [recipeIngredientEntrySchema.parse(entry())] };
    expect(withEntryNames(recipe, master).ingredients[0]).toMatchObject({
      label: null,
      name: "玉ねぎ",
    });
  });
});
