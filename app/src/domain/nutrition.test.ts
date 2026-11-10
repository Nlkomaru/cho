import { expect, test } from "vite-plus/test";
import { nutritionFactsSchema, sumNutritionFacts } from "./nutrition";

const facts = (partial: Record<string, unknown> = {}) =>
  nutritionFactsSchema.parse({
    caloriesKcal: 0,
    proteinG: 0,
    fatG: 0,
    carbohydrateG: 0,
    ...partial,
  });

test("nutrition sums preserve a nutrient found in only one input", () => {
  const result = sumNutritionFacts([
    facts({ micronutrients: [{ key: "iron", label: "Iron", amount: 2, unit: "mg" }] }),
    facts({ micronutrients: [{ key: "vitamin-c", label: "Vitamin C", amount: 5, unit: "mg" }] }),
  ]);
  expect(result.micronutrients).toEqual([
    { key: "iron", label: "Iron", amount: 2, unit: "mg" },
    { key: "vitamin-c", label: "Vitamin C", amount: 5, unit: "mg" },
  ]);
});

test("nutrition sums combine matching nutrient key and unit but retain distinct units", () => {
  const result = sumNutritionFacts([
    facts({
      micronutrients: [
        { key: "iron", label: "Iron", amount: 2, unit: "mg" },
        { key: "iron", label: "Iron", amount: 0.1, unit: "g" },
      ],
    }),
    facts({ micronutrients: [{ key: "iron", label: "Iron", amount: 3, unit: "mg" }] }),
  ]);
  expect(result.micronutrients).toEqual([
    { key: "iron", label: "Iron", amount: 5, unit: "mg" },
    { key: "iron", label: "Iron", amount: 0.1, unit: "g" },
  ]);
});

test("nutrition sums add the salt and fiber that are known instead of dropping them", () => {
  const result = sumNutritionFacts([
    facts({ fiberG: 1.5, saltEquivalentG: 1.2 }),
    facts({ fiberG: null, saltEquivalentG: null }),
    facts({ fiberG: 0.5, saltEquivalentG: 0.3 }),
  ]);
  expect(result.fiberG).toBeCloseTo(2);
  expect(result.saltEquivalentG).toBeCloseTo(1.5);
});

test("nutrition sums keep salt unknown only when no input has it", () => {
  const result = sumNutritionFacts([facts(), facts()]);
  expect(result.fiberG).toBeNull();
  expect(result.saltEquivalentG).toBeNull();
  expect(sumNutritionFacts([]).saltEquivalentG).toBe(0);
});
