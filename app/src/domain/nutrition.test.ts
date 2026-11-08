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
