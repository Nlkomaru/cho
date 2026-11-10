import { expect, test } from "vite-plus/test";
import { createMealLogService, type MealLogRepository } from "./meal-log";
import { InventiaHttpError } from "./inventia-client";
import { mealLogSchema, type Dish, type Ingredient, type MealLog } from "../domain/ingredient";
import { recipeSchema } from "../domain/recipe";
import { validateRecipeDag } from "../domain/recipe-scheduler";

const facts = {
  caloriesKcal: 100,
  proteinG: 5,
  fatG: 2,
  carbohydrateG: 10,
  fiberG: 1,
  saltEquivalentG: 0.2,
  micronutrients: [],
};
const ingredient = (price: number | null, inventiaItemId: string | null = null): Ingredient => ({
  id: "tomato",
  name: "Tomato",
  normalizedName: "tomato",
  baseDimension: "mass",
  baseUnit: "g",
  nutritionBasisAmount: 100,
  nutritionPerBasis: facts,
  gramPerUnit: null,
  inventiaItemId,
  latestUnitPriceYen: price,
  latestPriceUpdatedAt: null,
  memo: null,
});
const recipe = () => {
  const value = recipeSchema.parse({
    servings: 2,
    ingredients: [
      {
        id: "tomato-a",
        ingredientId: "tomato",
        name: "Tomato",
        amount: 40,
        unit: "g",
        displayAmount: "40 g",
      },
      {
        id: "tomato-b",
        ingredientId: "tomato",
        name: "Tomato",
        amount: 60,
        unit: "g",
        displayAmount: "60 g",
      },
    ],
    steps: [
      {
        id: "use",
        stepNumber: 1,
        phase: "prep",
        title: "Use tomato",
        instruction: "Prepare it",
        executionMode: "active",
        timing: { activeDurationSec: 1, passiveDurationSec: 0 },
        inputs: [
          { type: "ingredient", ingredientEntryId: "tomato-a" },
          { type: "ingredient", ingredientEntryId: "tomato-b" },
        ],
        outputs: [{ id: "out", label: "Prepared tomato" }],
      },
    ],
  });
  if (!validateRecipeDag(value).success) throw new Error("Recipe fixture must pass DAG validation");
  return value;
};
const dish: Dish = {
  id: "dish-1",
  name: "Tomato dish",
  category: null,
  servings: 2,
  recipe: recipe(),
  totalNutrition: facts,
  totalCostYen: 50,
  coverImageId: null,
  notes: null,
};
function fixture(currentIngredient = ingredient(100), currentDish: Dish = dish) {
  let saved: MealLog | null = null;
  const statuses: string[] = [];
  const repository: MealLogRepository = {
    list: async () => (saved ? [saved] : []),
    getById: async () => saved,
    create: async (input) => (saved = input),
    update: async (_id, changes) => (saved ? (saved = { ...saved, ...changes }) : null),
    delete: async () => saved,
    setInventiaConsumptionStatus: async (_id, status) => {
      statuses.push(status);
      if (saved) saved = { ...saved, inventiaConsumptionStatus: status };
      return !!saved;
    },
  };
  const service = createMealLogService({
    repository,
    dishRepository: { getById: async (id) => (id === currentDish.id ? currentDish : null) },
    ingredientRepository: {
      getById: async (id) => (id === currentIngredient.id ? currentIngredient : null),
    },
    inventiaClient: {
      getItem: async (id) => ({
        id,
        name: "Tomato",
        baseUnit: "g",
        baseDimension: "mass",
        currentQuantity: 1000,
      }),
      adjustStock: async () => ({}) as never,
    },
    providerId: "provider-7",
  });
  return {
    service,
    statuses,
    setIngredient: (next: Ingredient) => {
      currentIngredient = next;
    },
  };
}
const mealInput = {
  id: "meal-1",
  eatenAt: "2026-01-02T12:00:00.000Z",
  mealTiming: null,
  sourceType: "self_cooked" as const,
  placeName: null,
  title: "Lunch",
  totalPriceYen: null,
  totalNutrition: null,
  rating: null,
  memo: "before",
  imageIds: [],
  items: [
    {
      id: "item-1",
      dishId: dish.id,
      ingredientId: null,
      name: dish.name,
      servingsFactor: 1,
      priceYen: null,
      nutrition: null,
      ingredientCostBreakdown: [],
      estimationSource: "recipe" as const,
      sortOrder: 0,
    },
  ],
};

test("snapshots self-cooked item price, nutrition, and ingredient costs; memo patch preserves history", async () => {
  const state = fixture();
  const created = await state.service.create(mealInput);
  expect(created.items[0]?.priceYen).toBe(50);
  expect(created.totalPriceYen).toBe(50);
  expect(created.items[0]?.nutrition?.caloriesKcal).toBe(50);
  expect(created.items[0]?.ingredientCostBreakdown).toEqual([
    { ingredientId: "tomato", name: "Tomato", amount: 20, unit: "g", costYen: 20 },
    { ingredientId: "tomato", name: "Tomato", amount: 30, unit: "g", costYen: 30 },
  ]);
  state.setIngredient(ingredient(300));
  const updated = await state.service.update("meal-1", { memo: "after" });
  expect(updated?.memo).toBe("after");
  expect(updated?.items).toEqual(created.items);
  expect(updated?.totalPriceYen).toBe(created.totalPriceYen);
  expect(updated?.totalNutrition).toEqual(created.totalNutrition);
});

test("aggregates duplicate recipe ingredients into one exact Inventia adjustment and transitions status", async () => {
  const state = fixture(ingredient(100, "inventia-tomato"));
  await state.service.create(mealInput);
  const calls: unknown[] = [];
  const service = createMealLogService({
    repository: {
      list: async () => [],
      getById: async () => state.service.get("meal-1"),
      create: async (value) => value,
      update: async () => null,
      delete: async () => null,
      setInventiaConsumptionStatus: async (_id, status) => {
        state.statuses.push(status);
        return true;
      },
    },
    dishRepository: { getById: async () => dish },
    ingredientRepository: { getById: async () => ingredient(100, "inventia-tomato") },
    providerId: "provider-7",
    inventiaClient: {
      getItem: async (id) => ({
        id,
        name: "Tomato",
        baseUnit: "g",
        baseDimension: "mass",
        currentQuantity: 1000,
      }),
      adjustStock: async (id, body) => {
        calls.push({ id, body });
        return { id: "operation-1" } as never;
      },
    },
  });
  const results = await service.consumeStock("meal-1");
  expect(calls).toEqual([
    {
      id: "inventia-tomato",
      body: {
        delta: -50,
        reason: "consume",
        idempotencyKey: "cho:meal:meal-1:item:item-1:ing:tomato",
        note: "Cho: Tomato dish",
        externalProviderId: "provider-7",
        externalId: "meal-1",
      },
    },
  ]);
  expect(results).toHaveLength(1);
  expect(state.statuses).toEqual(["pending", "succeeded"]);
});

test("marks consumption failed and rethrows an adjustment rejection", async () => {
  const state = fixture(ingredient(100, "inventia-tomato"));
  await state.service.create(mealInput);
  const failure = new Error("stock unavailable");
  const service = createMealLogService({
    repository: {
      list: async () => [],
      getById: async () => state.service.get("meal-1"),
      create: async (value) => value,
      update: async () => null,
      delete: async () => null,
      setInventiaConsumptionStatus: async (_id, status) => {
        state.statuses.push(status);
        return true;
      },
    },
    dishRepository: { getById: async () => dish },
    ingredientRepository: { getById: async () => ingredient(100, "inventia-tomato") },
    providerId: "provider-7",
    inventiaClient: {
      getItem: async (id) => ({
        id,
        name: "Tomato",
        baseUnit: "g",
        baseDimension: "mass",
        currentQuantity: 1000,
      }),
      adjustStock: async () => {
        throw failure;
      },
    },
  });
  await expect(service.consumeStock("meal-1")).rejects.toBe(failure);
  expect(state.statuses).toEqual(["pending", "failed"]);
});

const listMeal = (
  id: string,
  eatenAt: string,
  priceYen: number,
  caloriesKcal: number,
  mealTiming: MealLog["mealTiming"] = "lunch",
): MealLog =>
  mealLogSchema.parse({
    id,
    eatenAt,
    mealTiming,
    sourceType: "other",
    title: id,
    totalPriceYen: priceYen,
    totalNutrition: { ...facts, caloriesKcal },
    items: [
      {
        id: `item-${id}`,
        name: id,
        priceYen,
        nutrition: { ...facts, caloriesKcal },
        estimationSource: "manual",
      },
    ],
  });

function summaryService(meals: MealLog[]) {
  const filters: unknown[] = [];
  const repository: MealLogRepository = {
    list: async (filter) => {
      filters.push(filter);
      return meals;
    },
    getById: async () => null,
    create: async (value) => value,
    update: async () => null,
    delete: async () => null,
    setInventiaConsumptionStatus: async () => false,
  };
  return {
    filters,
    service: createMealLogService({
      repository,
      dishRepository: { getById: async () => null },
      ingredientRepository: { getById: async () => null },
    }),
  };
}

test("summarises day, week, and month totals in JST and honours date/type/timing/text filters", async () => {
  const meals = [
    listMeal("today", "2026-01-02T03:00:00.000Z", 500, 600),
    listMeal("week", "2026-01-01T03:00:00.000Z", 300, 400),
    listMeal("last-month", "2025-12-20T03:00:00.000Z", 100, 100),
    listMeal("future", "2026-01-03T00:00:00.000Z", 999, 999),
  ];
  const { filters, service } = summaryService(meals);
  const result = await service.list(
    { date: "2026-01-02", sourceType: "other", mealTiming: "lunch", q: "Ramen" },
    new Date("2026-01-02T03:30:00.000Z"),
  );
  expect(result.meals).toStrictEqual(meals);
  expect(result.summary.day.priceYen).toBe(500);
  expect(result.summary.day.caloriesKcal).toBe(600);
  expect(result.summary.week.priceYen).toBe(800);
  expect(result.summary.week.caloriesKcal).toBe(1000);
  expect(result.summary.month.priceYen).toBe(800);
  expect(result.summary.month.caloriesKcal).toBe(1000);
  expect(filters).toEqual([
    {
      from: "2026-01-01T15:00:00.000Z",
      to: "2026-01-02T14:59:59.999Z",
      sourceType: "other",
      mealTiming: "lunch",
      q: "Ramen",
    },
  ]);
});

test("createWithStock consumes stock during creation and reports a failure without losing the meal", async () => {
  const state = fixture(ingredient(100, "inventia-tomato"));
  const created = await state.service.createWithStock(mealInput);
  expect(created.stockConsumption.status).toBe("succeeded");
  expect(created.stockConsumption.results).toHaveLength(1);
  expect(created.stockConsumption.error).toBeNull();
  expect(created.meal.id).toBe("meal-1");
  expect(created.meal.inventiaConsumptionStatus).toBe("succeeded");
  expect(state.statuses).toEqual(["pending", "succeeded"]);

  const failing = createMealLogService({
    repository: {
      list: async () => [],
      getById: async () => state.service.get("meal-1"),
      create: async (value) => value,
      update: async () => null,
      delete: async () => null,
      setInventiaConsumptionStatus: async (_id, status) => {
        state.statuses.push(status);
        return true;
      },
    },
    dishRepository: { getById: async () => dish },
    ingredientRepository: { getById: async () => ingredient(100, "inventia-tomato") },
    providerId: "provider-7",
    inventiaClient: {
      getItem: async (id) => ({
        id,
        name: "Tomato",
        baseUnit: "g",
        baseDimension: "mass",
        currentQuantity: 1000,
      }),
      adjustStock: async () => {
        throw new InventiaHttpError(401);
      },
    },
  });
  const failed = await failing.createWithStock(mealInput);
  expect(failed.meal.id).toBe("meal-1");
  expect(failed.stockConsumption.status).toBe("failed");
  expect(failed.stockConsumption.error).toContain("API token");
});

test("meal consumption refuses an item whose unit changed after linking", async () => {
  const state = fixture(ingredient(100, "inventia-tomato"));
  await state.service.create(mealInput);
  const service = createMealLogService({
    repository: {
      list: async () => [],
      getById: async () => state.service.get("meal-1"),
      create: async (value) => value,
      update: async () => null,
      delete: async () => null,
      setInventiaConsumptionStatus: async (_id, status) => {
        state.statuses.push(status);
        return true;
      },
    },
    dishRepository: { getById: async () => dish },
    ingredientRepository: { getById: async () => ingredient(100, "inventia-tomato") },
    providerId: "provider-7",
    inventiaClient: {
      getItem: async (id) => ({
        id,
        name: "Tomato",
        baseUnit: "kg",
        baseDimension: "mass",
        currentQuantity: 1,
      }),
      adjustStock: async () => {
        throw new Error("Stock must not be mutated with a changed unit");
      },
    },
  });
  await expect(service.consumeStock("meal-1")).rejects.toMatchObject({
    name: "InventiaUnitMismatchError",
    expectedUnit: "g",
    actualUnit: "kg",
  });
  expect(state.statuses).toEqual(["pending", "failed"]);
});

test("meal consumption refuses a fractional computed amount naming the unit", async () => {
  const [firstEntry, secondEntry] = recipe().ingredients;
  const [mealItem] = mealInput.items;
  if (!firstEntry || !secondEntry || !mealItem)
    throw new Error("Fractional stock fixture is incomplete");
  const fractionalDish: Dish = {
    ...dish,
    id: "dish-fractional",
    servings: 3,
    recipe: {
      ...recipe(),
      servings: 3,
      ingredients: [
        { ...firstEntry, amount: 100 },
        { ...secondEntry, amount: 1 },
      ],
    },
  };
  const state = fixture(ingredient(100, "inventia-tomato"), fractionalDish);
  await state.service.create({
    ...mealInput,
    items: [{ ...mealItem, dishId: fractionalDish.id }],
  });
  const service = createMealLogService({
    repository: {
      list: async () => [],
      getById: async () => state.service.get("meal-1"),
      create: async (value) => value,
      update: async () => null,
      delete: async () => null,
      setInventiaConsumptionStatus: async (_id, status) => {
        state.statuses.push(status);
        return true;
      },
    },
    dishRepository: { getById: async () => fractionalDish },
    ingredientRepository: { getById: async () => ingredient(100, "inventia-tomato") },
    providerId: "provider-7",
    inventiaClient: {
      getItem: async (id) => ({
        id,
        name: "Tomato",
        baseUnit: "g",
        baseDimension: "mass",
        currentQuantity: 1000,
      }),
      adjustStock: async () => {
        throw new Error("Stock must not be mutated with a fractional amount");
      },
    },
  });
  await expect(service.consumeStock("meal-1")).rejects.toMatchObject({
    name: "InventiaAmountError",
    unit: "g",
    amount: 101 / 3,
  });
  expect(state.statuses).toEqual(["pending", "failed"]);
});

test("meal price comes from current ingredient prices, not the cached dish cost", async () => {
  const priced = fixture(ingredient(100), { ...dish, totalCostYen: 999 });
  const meal = await priced.service.create({ ...mealInput, items: [{ ...mealInput.items[0] }] });
  expect(meal.items[0]?.priceYen).toBeCloseTo(50);
});

test("a partly priced dish gives the meal no price", async () => {
  const unpriced = fixture(ingredient(null), { ...dish, totalCostYen: 165.3, costMissingCount: 0 });
  const meal = await unpriced.service.create({
    ...mealInput,
    items: [{ ...mealInput.items[0] }],
  });
  expect(meal.items[0]?.priceYen).toBeNull();
});

test("meal totals add the priced items and the salt that is known", async () => {
  const state = fixture();
  const created = await state.service.create({
    ...mealInput,
    items: [
      { ...mealInput.items[0] },
      {
        id: "item-2",
        dishId: null,
        ingredientId: null,
        name: "Miso soup",
        servingsFactor: 1,
        priceYen: 80,
        nutrition: { ...facts, saltEquivalentG: null },
        ingredientCostBreakdown: [],
        estimationSource: "manual" as const,
        sortOrder: 1,
      },
      {
        id: "item-3",
        dishId: null,
        ingredientId: null,
        name: "Rice",
        servingsFactor: 1,
        priceYen: null,
        nutrition: { ...facts, saltEquivalentG: 0 },
        ingredientCostBreakdown: [],
        estimationSource: "manual" as const,
        sortOrder: 2,
      },
    ],
  });
  expect(created.totalPriceYen).toBe(130);
  expect(created.totalNutrition?.saltEquivalentG).toBeCloseTo(0.1);
  const cleared = await state.service.update("meal-1", { totalPriceYen: 999 });
  expect(cleared?.totalPriceYen).toBe(999);
  const restored = await state.service.update("meal-1", { totalPriceYen: null });
  expect(restored?.totalPriceYen).toBe(130);
});

test("recipe items take nutrition from the current ingredients, not a stale dish total", async () => {
  const stale: Dish = { ...dish, totalNutrition: { ...facts, saltEquivalentG: null } };
  const state = fixture(ingredient(100), stale);
  const created = await state.service.create(mealInput);
  // 50 g of tomato per serving at 0.2 g salt per 100 g
  expect(created.items[0]?.nutrition?.saltEquivalentG).toBeCloseTo(0.1);
  expect(created.totalNutrition?.saltEquivalentG).toBeCloseTo(0.1);
});
