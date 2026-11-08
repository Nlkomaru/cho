import { expect, test } from "vite-plus/test";
import {
  calculateIngredientCost,
  calculateIngredientNutrition,
  ingredientSchema,
} from "./ingredient";

function ingredient(
  baseDimension: "mass" | "volume" | "count",
  baseUnit: string,
  basis: number,
  price: number | null,
) {
  return ingredientSchema.parse({
    id: `${baseDimension}-ingredient`,
    name: "Test ingredient",
    baseDimension,
    baseUnit,
    nutritionBasisAmount: basis,
    nutritionPerBasis: { caloriesKcal: 100, proteinG: 10, fatG: 5, carbohydrateG: 20 },
    latestUnitPriceYen: price,
  });
}

test("ingredient calculations scale mass and volume from their 100-unit basis", () => {
  for (const [dimension, unit] of [
    ["mass", "g"],
    ["volume", "mL"],
  ] as const) {
    const item = ingredient(dimension, unit, 100, 250);
    expect(calculateIngredientNutrition(item, 50).caloriesKcal).toBe(50);
    expect(calculateIngredientCost(item, 50)).toBe(125);
  }
});

test("count ingredients use their one-unit basis for nutrition and cost", () => {
  const item = ingredient("count", "個", 1, 30);
  expect(calculateIngredientNutrition(item, 3).caloriesKcal).toBe(300);
  expect(calculateIngredientCost(item, 3)).toBe(90);
});

test("ingredient schema accepts canonical mass, volume, and count bases", () => {
  for (const [baseDimension, baseUnit, nutritionBasisAmount] of [
    ["mass", "g", 100],
    ["volume", "mL", 100],
    ["count", "custom unit", 1],
  ] as const) {
    expect(
      ingredientSchema.safeParse({
        id: "canonical",
        name: "Canonical",
        baseDimension,
        baseUnit,
        nutritionBasisAmount,
        nutritionPerBasis: { caloriesKcal: 100, proteinG: 10, fatG: 5, carbohydrateG: 20 },
      }).success,
    ).toBe(true);
  }
});

test("ingredient schema rejects noncanonical units and basis amounts", () => {
  for (const [baseDimension, baseUnit, nutritionBasisAmount] of [
    ["mass", "kg", 100],
    ["mass", "g", 1],
    ["volume", "L", 100],
    ["volume", "mL", 1],
    ["count", "custom unit", 100],
  ] as const) {
    expect(
      ingredientSchema.safeParse({
        id: "noncanonical",
        name: "Noncanonical",
        baseDimension,
        baseUnit,
        nutritionBasisAmount,
        nutritionPerBasis: { caloriesKcal: 100, proteinG: 10, fatG: 5, carbohydrateG: 20 },
      }).success,
    ).toBe(false);
  }
});

test("missing latest price yields null cost without affecting nutrition", () => {
  const item = ingredient("mass", "g", 100, null);
  expect(calculateIngredientCost(item, 40)).toBe(null);
  expect(calculateIngredientNutrition(item, 40).caloriesKcal).toBe(40);
});
