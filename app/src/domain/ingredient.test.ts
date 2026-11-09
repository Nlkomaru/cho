import { expect, test } from "vite-plus/test";
import {
  calculateDishCost,
  calculateIngredientCost,
  calculateIngredientNutrition,
  ingredientSchema,
  inventiaUnitPriceToBasisPrice,
  isInventiaPriceStale,
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

test("dish cost sums the priced ingredients and reports the unpriced ones", () => {
  const priced = { ...ingredient("mass", "g", 100, 50), id: "priced" };
  const unpriced = { ...ingredient("mass", "g", 100, null), id: "unpriced" };
  const partial = calculateDishCost(
    [
      { ingredient: priced, amount: 200 },
      { ingredient: unpriced, amount: 100 },
    ],
    2,
  );
  expect(partial).toEqual({
    totalYen: 50,
    missingIngredientIds: ["unpriced"],
    missingCount: 1,
    complete: false,
  });
  const complete = calculateDishCost([{ ingredient: priced, amount: 100 }]);
  expect(complete).toMatchObject({ totalYen: 50, missingCount: 0, complete: true });
});

test("Inventia per-100 g / per-piece unit prices convert to the ingredient basis", () => {
  const basis = (baseDimension: "mass" | "volume" | "count", baseUnit: string, amount: number) => ({
    baseDimension,
    baseUnit,
    nutritionBasisAmount: amount,
  });
  expect(inventiaUnitPriceToBasisPrice(40, basis("mass", "g", 100))).toBe(40);
  expect(inventiaUnitPriceToBasisPrice(25, basis("volume", "mL", 100))).toBe(25);
  // Inventia always quotes kg/L items per 100 g/mL; a 1 kg basis is ten times that.
  expect(inventiaUnitPriceToBasisPrice(40, basis("mass", "kg", 1))).toBe(400);
  expect(inventiaUnitPriceToBasisPrice(25, basis("volume", "L", 1))).toBe(250);
  expect(inventiaUnitPriceToBasisPrice(30, basis("count", "個", 1))).toBe(30);
  expect(inventiaUnitPriceToBasisPrice(30, basis("mass", "袋", 1))).toBeNull();
  expect(inventiaUnitPriceToBasisPrice(Number.NaN, basis("mass", "g", 100))).toBeNull();
  const item = ingredient(
    "mass",
    "g",
    100,
    inventiaUnitPriceToBasisPrice(40, basis("mass", "g", 100)),
  );
  expect(calculateIngredientCost(item, 250)).toBe(100);
});

test("linked prices are stale when missing, older than a day, or unpriced for an hour", () => {
  const now = new Date("2026-11-10T12:00:00.000Z");
  const linked = (latestUnitPriceYen: number | null, latestPriceUpdatedAt: string | null) => ({
    inventiaItemId: "item-1",
    latestUnitPriceYen,
    latestPriceUpdatedAt,
  });
  expect(isInventiaPriceStale(linked(null, null), now)).toBe(true);
  expect(isInventiaPriceStale(linked(40, "2026-11-09T12:00:00.000Z"), now)).toBe(true);
  expect(isInventiaPriceStale(linked(40, "2026-11-09T13:00:00.000Z"), now)).toBe(false);
  expect(isInventiaPriceStale(linked(null, "2026-11-10T10:59:00.000Z"), now)).toBe(true);
  expect(isInventiaPriceStale(linked(null, "2026-11-10T11:30:00.000Z"), now)).toBe(false);
  expect(isInventiaPriceStale({ ...linked(null, null), inventiaItemId: null }, now)).toBe(false);
});

test("a recent price lookup attempt delays the next refresh even when the price is old", () => {
  const now = new Date("2026-11-10T12:00:00.000Z");
  const linked = {
    inventiaItemId: "item",
    latestUnitPriceYen: 10,
    latestPriceUpdatedAt: "2026-11-01T00:00:00.000Z",
  };
  expect(isInventiaPriceStale(linked, now)).toBe(true);
  expect(
    isInventiaPriceStale({ ...linked, latestPriceAttemptedAt: "2026-11-10T11:30:00.000Z" }, now),
  ).toBe(false);
  expect(
    isInventiaPriceStale({ ...linked, latestPriceAttemptedAt: "2026-11-10T10:00:00.000Z" }, now),
  ).toBe(true);
});
