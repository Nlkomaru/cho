import {
  mealListSchema,
  mealLogSchema,
  type Dish,
  type Ingredient,
  type MealList,
  type MealLog,
  type MealLogItem,
  type MealPeriodTotals,
  type MealSummary,
} from "../domain/ingredient";
import { calculateIngredientCost, calculateIngredientNutrition } from "../domain/ingredient";
import { scaleNutritionFacts, sumNutritionFacts } from "../domain/nutrition";
import type { NutritionFacts } from "../domain/nutrition";
import {
  assertIntegerStockAmount,
  assertInventiaUnitMatch,
  InventiaItemNotFoundError,
  inventiaRequestErrorMessage,
  type InventiaItemDto,
  type InventiaStockAdjustRequest,
  type InventiaStockOperationResult,
} from "./inventia-client";

export interface MealLogRepository {
  list(filter?: {
    from?: string;
    to?: string;
    sourceType?: MealLog["sourceType"];
    mealTiming?: NonNullable<MealLog["mealTiming"]>;
    q?: string;
  }): Promise<MealLog[]>;
  getById(id: string): Promise<MealLog | null>;
  create(input: MealLog): Promise<MealLog>;
  update(id: string, changes: Partial<Omit<MealLog, "id">>): Promise<MealLog | null>;
  delete(id: string): Promise<MealLog | null>;
  setInventiaConsumptionStatus(
    id: string,
    status: NonNullable<MealLog["inventiaConsumptionStatus"]>,
  ): Promise<boolean>;
}
export interface MealDishRepository {
  getById(id: string): Promise<Dish | null>;
}
export interface MealIngredientRepository {
  getById(id: string): Promise<Ingredient | null>;
}
export interface MealInventiaClient {
  getItem(id: string): Promise<InventiaItemDto | null>;
  adjustStock(id: string, input: InventiaStockAdjustRequest): Promise<InventiaStockOperationResult>;
}
export interface MealLogServiceOptions {
  repository: MealLogRepository;
  dishRepository: MealDishRepository;
  ingredientRepository: MealIngredientRepository;
  inventiaClient?: MealInventiaClient;
  providerId?: string;
}
type MealInput = Omit<MealLog, "id" | "items" | "inventiaConsumptionStatus"> & {
  id?: string;
  items: (Omit<MealLogItem, "id"> & { id?: string })[];
};
type MealChanges = Partial<Omit<MealLog, "id" | "items" | "inventiaConsumptionStatus">> & {
  items?: MealInput["items"];
};
const newId = () => crypto.randomUUID();
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
type MealPeriod = keyof MealSummary;
export type MealListFilter = {
  from?: string;
  to?: string;
  sourceType?: MealLog["sourceType"];
  mealTiming?: NonNullable<MealLog["mealTiming"]>;
  q?: string;
  date?: string;
};

function jstDayRange(date: string): { from: string; to: string } {
  const start = Date.parse(`${date}T00:00:00+09:00`);
  if (!Number.isFinite(start)) throw new TypeError(`Invalid date filter: ${date}`);
  return { from: new Date(start).toISOString(), to: new Date(start + DAY_MS - 1).toISOString() };
}

function periodStart(period: MealPeriod, nowMs: number): number {
  const shifted = new Date(nowMs + JST_OFFSET_MS);
  const year = shifted.getUTCFullYear();
  const month = shifted.getUTCMonth();
  const day = shifted.getUTCDate();
  if (period === "day") return Date.UTC(year, month, day) - JST_OFFSET_MS;
  if (period === "week")
    return Date.UTC(year, month, day - ((shifted.getUTCDay() + 6) % 7)) - JST_OFFSET_MS;
  return Date.UTC(year, month, 1) - JST_OFFSET_MS;
}

export function summarizeMeals(
  meals: readonly MealLog[],
  period: MealPeriod,
  now: Date = new Date(),
): MealPeriodTotals {
  const nowMs = now.getTime();
  const start = periodStart(period, nowMs);
  let priceYen = 0;
  let caloriesKcal = 0;
  let proteinG = 0;
  let fatG = 0;
  let carbohydrateG = 0;
  let fiberG = 0;
  let saltEquivalentG = 0;
  let nutritionComplete = true;
  let fiberComplete = true;
  let saltComplete = true;
  for (const meal of meals) {
    const eaten = Date.parse(meal.eatenAt);
    if (!Number.isFinite(eaten) || eaten < start || eaten > nowMs) continue;
    priceYen += meal.totalPriceYen ?? 0;
    const facts = meal.totalNutrition;
    if (!facts) {
      nutritionComplete = false;
      continue;
    }
    caloriesKcal += facts.caloriesKcal;
    proteinG += facts.proteinG;
    fatG += facts.fatG;
    carbohydrateG += facts.carbohydrateG;
    if (facts.fiberG === null) fiberComplete = false;
    else fiberG += facts.fiberG;
    if (facts.saltEquivalentG === null) saltComplete = false;
    else saltEquivalentG += facts.saltEquivalentG;
  }
  return {
    priceYen,
    caloriesKcal: nutritionComplete ? caloriesKcal : null,
    proteinG: nutritionComplete ? proteinG : null,
    fatG: nutritionComplete ? fatG : null,
    carbohydrateG: nutritionComplete ? carbohydrateG : null,
    fiberG: nutritionComplete && fiberComplete ? fiberG : null,
    saltEquivalentG: nutritionComplete && saltComplete ? saltEquivalentG : null,
  };
}

function mergeRange(
  filter: MealListFilter,
  range: { from: string; to: string },
): { from?: string; to?: string } {
  return {
    from: filter.from && filter.from > range.from ? filter.from : range.from,
    to: filter.to && filter.to < range.to ? filter.to : range.to,
  };
}

export type MealCreationResult = {
  meal: MealLog;
  stockConsumption: {
    status: "succeeded" | "failed" | "skipped";
    results: InventiaStockOperationResult[];
    error: string | null;
  };
};

export function createMealLogService({
  repository,
  dishRepository,
  ingredientRepository,
  inventiaClient,
  providerId,
}: MealLogServiceOptions) {
  async function snapshotItems(items: MealInput["items"]): Promise<MealLogItem[]> {
    return Promise.all(
      items.map(async (raw, index) => {
        const item = {
          ...raw,
          id: raw.id ?? newId(),
          sortOrder: raw.sortOrder ?? index,
        } as MealLogItem;
        if (item.dishId) {
          const dish = await dishRepository.getById(item.dishId);
          if (!dish) throw new Error(`Unknown dish: ${item.dishId}`);
          const manual = item.estimationSource === "manual";
          const nutrition =
            manual && item.nutrition
              ? item.nutrition
              : dish.totalNutrition
                ? scaleNutritionFacts(dish.totalNutrition, item.servingsFactor)
                : null;
          const breakdown = await Promise.all(
            dish.recipe.ingredients.map(async (entry) => {
              const ingredient = await ingredientRepository.getById(entry.ingredientId);
              if (!ingredient)
                throw new Error(
                  `Unknown ingredient ${entry.ingredientId} referenced by dish ${dish.id}`,
                );
              const amount = (entry.amount / dish.servings) * item.servingsFactor;
              const cost = calculateIngredientCost(ingredient, amount);
              return cost === null
                ? null
                : {
                    ingredientId: ingredient.id,
                    name: ingredient.name,
                    amount,
                    unit: ingredient.baseUnit,
                    costYen: cost,
                  };
            }),
          );
          const priceYen =
            manual && item.priceYen !== null
              ? item.priceYen
              : dish.totalCostYen === null
                ? null
                : dish.totalCostYen * item.servingsFactor;
          return {
            ...item,
            name: dish.name,
            nutrition,
            priceYen,
            ingredientCostBreakdown: breakdown.filter(
              (entry): entry is NonNullable<typeof entry> => entry !== null,
            ),
          };
        }
        if (item.ingredientId) {
          const ingredient = await ingredientRepository.getById(item.ingredientId);
          if (!ingredient) throw new Error(`Unknown ingredient: ${item.ingredientId}`);
          const manual = item.estimationSource === "manual";
          return {
            ...item,
            name: ingredient.name,
            nutrition:
              manual && item.nutrition
                ? item.nutrition
                : calculateIngredientNutrition(
                    ingredient,
                    ingredient.nutritionBasisAmount * item.servingsFactor,
                  ),
            priceYen:
              manual && item.priceYen !== null
                ? item.priceYen
                : calculateIngredientCost(
                    ingredient,
                    ingredient.nutritionBasisAmount * item.servingsFactor,
                  ),
          };
        }
        return item;
      }),
    );
  }
  async function build(input: MealInput): Promise<MealLog> {
    const items = await snapshotItems(input.items);
    const nutritionItems = items
      .map((item) => item.nutrition)
      .filter((facts): facts is NutritionFacts => facts !== null);
    return mealLogSchema.parse({
      ...input,
      id: input.id ?? newId(),
      items,
      inventiaConsumptionStatus: null,
      totalPriceYen:
        input.totalPriceYen ??
        (items.every((item) => item.priceYen !== null)
          ? items.reduce((sum, item) => sum + (item.priceYen ?? 0), 0)
          : null),
      totalNutrition:
        input.totalNutrition ??
        (items.every((item) => item.nutrition !== null) ? sumNutritionFacts(nutritionItems) : null),
    });
  }
  async function consumeStock(logId: string): Promise<InventiaStockOperationResult[]> {
    if (!inventiaClient) throw new Error("Inventia client is not configured");
    if (!providerId) throw new Error("Inventia providerId is not configured");
    const log = await repository.getById(logId);
    if (!log) throw new Error(`Meal log not found: ${logId}`);
    if (log.sourceType !== "self_cooked") return [];
    if (!(await repository.setInventiaConsumptionStatus(logId, "pending")))
      throw new Error(`Meal log not found: ${logId}`);
    const results: InventiaStockOperationResult[] = [];
    try {
      for (const item of log.items) {
        if (!item.dishId) continue;
        const dish = await dishRepository.getById(item.dishId);
        if (!dish) throw new Error(`Unknown dish: ${item.dishId}`);
        const amountsByIngredient = new Map<string, number>();
        for (const entry of dish.recipe.ingredients)
          amountsByIngredient.set(
            entry.ingredientId,
            (amountsByIngredient.get(entry.ingredientId) ?? 0) + entry.amount,
          );
        for (const [ingredientId, totalAmount] of amountsByIngredient) {
          const ingredient = await ingredientRepository.getById(ingredientId);
          if (!ingredient) throw new Error(`Unknown ingredient: ${ingredientId}`);
          if (!ingredient.inventiaItemId) continue;
          const inventiaItem = await inventiaClient.getItem(ingredient.inventiaItemId);
          if (!inventiaItem) throw new InventiaItemNotFoundError();
          assertInventiaUnitMatch(ingredient, inventiaItem);
          const amount = (totalAmount / dish.servings) * item.servingsFactor;
          assertIntegerStockAmount(amount, inventiaItem.baseUnit);
          const body: InventiaStockAdjustRequest = {
            delta: -amount,
            reason: "consume",
            idempotencyKey: `cho:meal:${log.id}:item:${item.id}:ing:${ingredient.id}`,
            note: `Cho: ${dish.name}`,
            externalProviderId: providerId,
            externalId: log.id,
          };
          results.push(await inventiaClient.adjustStock(ingredient.inventiaItemId, body));
        }
      }
      await repository.setInventiaConsumptionStatus(logId, "succeeded");
      return results;
    } catch (error) {
      await repository.setInventiaConsumptionStatus(logId, "failed");
      throw error;
    }
  }
  async function createWithStock(input: MealInput): Promise<MealCreationResult> {
    const meal = await repository.create(await build(input));
    if (meal.sourceType !== "self_cooked")
      return { meal, stockConsumption: { status: "skipped", results: [], error: null } };
    if (!inventiaClient || !providerId)
      return {
        meal,
        stockConsumption: {
          status: "failed",
          results: [],
          error: "Inventia is not configured.",
        },
      };
    try {
      const results = await consumeStock(meal.id);
      const refreshed = (await repository.getById(meal.id)) ?? meal;
      return {
        meal: refreshed,
        stockConsumption: { status: "succeeded", results, error: null },
      };
    } catch (error) {
      const refreshed = (await repository.getById(meal.id)) ?? meal;
      return {
        meal: refreshed,
        stockConsumption: {
          status: "failed",
          results: [],
          error: inventiaRequestErrorMessage(error, "在庫消費に失敗しました。"),
        },
      };
    }
  }
  return {
    async list(filter: MealListFilter = {}, now = new Date()): Promise<MealList> {
      const { date, ...rest } = filter;
      const meals = await repository.list(
        date ? { ...rest, ...mergeRange(rest, jstDayRange(date)) } : rest,
      );
      return mealListSchema.parse({
        meals,
        summary: {
          day: summarizeMeals(meals, "day", now),
          week: summarizeMeals(meals, "week", now),
          month: summarizeMeals(meals, "month", now),
        },
      });
    },
    get: (id: string) => repository.getById(id),
    async create(input: MealInput) {
      return repository.create(await build(input));
    },
    createWithStock,
    async update(id: string, changes: MealChanges): Promise<MealLog | null> {
      const current = await repository.getById(id);
      if (!current) return null;
      if (!changes.items) {
        return repository.update(id, {
          ...changes,
          items: current.items,
          totalPriceYen: changes.totalPriceYen ?? current.totalPriceYen,
          totalNutrition: changes.totalNutrition ?? current.totalNutrition,
        });
      }
      const candidate = { ...current, ...changes, id, items: changes.items };
      const updated = await build(candidate);
      return repository.update(id, {
        ...updated,
        totalPriceYen: changes.totalPriceYen ?? updated.totalPriceYen,
        totalNutrition: changes.totalNutrition ?? updated.totalNutrition,
      });
    },
    delete: (id: string) => repository.delete(id),
    consumeStock,
  };
}
