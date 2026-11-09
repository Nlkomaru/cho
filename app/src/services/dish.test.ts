import { expect, test } from "vite-plus/test";
import type { Dish, Ingredient } from "../domain/ingredient";
import { recipeSchema } from "../domain/recipe";
import { createDishService, type DishRepository } from "./dish";

const facts = {
  caloriesKcal: 100,
  proteinG: 1,
  fatG: 1,
  carbohydrateG: 1,
  fiberG: null,
  saltEquivalentG: null,
  micronutrients: [],
};
const ingredientFor = (id: string): Ingredient => ({
  id,
  name: id,
  normalizedName: id,
  baseDimension: "mass",
  baseUnit: "g",
  nutritionBasisAmount: 100,
  nutritionPerBasis: facts,
  gramPerUnit: null,
  inventiaItemId: null,
  latestUnitPriceYen: 10,
  latestPriceUpdatedAt: null,
  memo: null,
});
function dishFor(index: number, ingredientIds: string[]): Dish {
  return {
    id: `dish-${index}`,
    name: `Dish ${index}`,
    category: null,
    servings: 1,
    recipe: recipeSchema.parse({
      ingredients: ingredientIds.map((ingredientId, position) => ({
        id: `entry-${position}`,
        ingredientId,
        name: ingredientId,
        amount: 100,
        unit: "g",
        displayAmount: "100 g",
      })),
      steps: [
        {
          id: "step",
          stepNumber: 1,
          phase: "cook",
          title: "Cook",
          instruction: "Cook.",
          executionMode: "active",
          timing: { activeDurationSec: 60 },
          inputs: ingredientIds.map((_, position) => ({
            type: "ingredient",
            ingredientEntryId: `entry-${position}`,
          })),
        },
      ],
    }),
    totalNutrition: null,
    totalCostYen: null,
    coverImageId: null,
    notes: null,
  };
}

test("listing dishes resolves ingredients in bulk instead of one lookup per recipe ingredient", async () => {
  const ids = Array.from({ length: 20 }, (_, index) => `ing-${index}`);
  const dishes = Array.from({ length: 50 }, (_, index) => dishFor(index, ids));
  let singleLookups = 0;
  let bulkLookups = 0;
  const repository = { list: async () => dishes } as unknown as DishRepository;
  const service = createDishService({
    repository,
    ingredientRepository: {
      getById: async (id) => {
        singleLookups += 1;
        return ingredientFor(id);
      },
      getByIds: async (requested) => {
        bulkLookups += 1;
        return requested.map(ingredientFor);
      },
    },
  });
  const listed = await service.list();
  expect(listed).toHaveLength(50);
  expect(listed[0]?.totalCostYen).toBeCloseTo(20 * 10);
  expect(singleLookups).toBe(0);
  expect(bulkLookups).toBe(1);
});

test("dishes still resolve when the ingredient repository has no bulk lookup", async () => {
  const dishes = [dishFor(0, ["a", "b", "a"])];
  const service = createDishService({
    repository: { list: async () => dishes } as unknown as DishRepository,
    ingredientRepository: { getById: async (id) => ingredientFor(id) },
  });
  expect(await service.list()).toHaveLength(1);
});

test("a dish that references an unknown ingredient is rejected by name of the entry", async () => {
  const service = createDishService({
    repository: { list: async () => [dishFor(0, ["ghost"])] } as unknown as DishRepository,
    ingredientRepository: { getById: async () => null, getByIds: async () => [] },
  });
  await expect(service.list()).rejects.toThrow("Unknown ingredient ghost");
});
