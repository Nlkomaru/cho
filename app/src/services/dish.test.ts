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
    costMissingCount: 0,
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

test("saving keeps only labels that differ from the master ingredient name", async () => {
  const base = dishFor(0, ["玉ねぎ", "食塩"]);
  const dish: Dish = {
    ...base,
    recipe: {
      ...base.recipe,
      ingredients: [
        { ...base.recipe.ingredients[0], label: "玉ねぎ" },
        { ...base.recipe.ingredients[1], label: "塩ひとつまみ" },
      ],
    },
  };
  let saved: Dish | undefined;
  const service = createDishService({
    repository: {
      create: async (input: Dish) => (saved = input),
    } as unknown as DishRepository,
    ingredientRepository: { getById: async (id) => ingredientFor(id) },
  });
  await service.create(dish);
  expect(saved?.recipe.ingredients.map((entry) => entry.label)).toEqual([null, "塩ひとつまみ"]);
});

test("legacy entries with a copied name read as having no label", async () => {
  // dishFor writes the old `name` field, set to the master name
  const service = createDishService({
    repository: { list: async () => [dishFor(0, ["玉ねぎ"])] } as unknown as DishRepository,
    ingredientRepository: { getById: async (id) => ingredientFor(id) },
  });
  const [dish] = await service.list();
  expect(dish?.recipe.ingredients[0]).not.toHaveProperty("name");
  expect(dish?.recipe.ingredients[0]?.label).toBeNull();
});

function serviceWithPrices(prices: Record<string, number | null>) {
  const repository = {
    create: async (dish: Dish) => dish,
    getById: async () => null,
  } as unknown as DishRepository;
  return createDishService({
    repository,
    ingredientRepository: {
      getById: async (id) => ({ ...ingredientFor(id), latestUnitPriceYen: prices[id] ?? null }),
      getByIds: async (ids) =>
        ids.map((id) => ({ ...ingredientFor(id), latestUnitPriceYen: prices[id] ?? null })),
    },
  });
}

test("a dish with some unpriced ingredients keeps the partial sum and counts the gaps", async () => {
  const service = serviceWithPrices({ a: 10, b: null, c: null });
  const created = await service.create({ ...dishFor(0, ["a", "b", "c"]), servings: 2 });
  expect(created.totalCostYen).toBeCloseTo(10 / 2);
  expect(created.costMissingCount).toBe(2);
});

test("a dish with no priced ingredient has null cost and counts every ingredient", async () => {
  const service = serviceWithPrices({ a: null, b: null });
  const created = await service.create(dishFor(0, ["a", "b"]));
  expect(created.totalCostYen).toBeNull();
  expect(created.costMissingCount).toBe(2);
});

test("a fully priced dish reports no missing ingredients", async () => {
  const service = serviceWithPrices({ a: 10, b: 20 });
  const created = await service.create(dishFor(0, ["a", "b"]));
  expect(created.totalCostYen).toBeCloseTo(30);
  expect(created.costMissingCount).toBe(0);
});
