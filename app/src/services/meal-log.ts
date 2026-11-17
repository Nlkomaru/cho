import {
  mealListSchema,
  mealLogSchema,
  type Dish,
  type Food,
  type Ingredient,
  type MealList,
  type MealLog,
  type MealLogItem,
  type MealPeriodTotals,
  type MealSummary,
} from "../domain/ingredient";
import {
  calculateDishNutrition,
  calculateFoodCost,
  calculateFoodNutrition,
  calculateIngredientCost,
  calculateIngredientNutrition,
} from "../domain/ingredient";
import { scaleNutritionFacts, sumNutritionFacts } from "../domain/nutrition";
import type { NutritionFacts } from "../domain/nutrition";

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
}
export interface MealDishRepository {
  getById(id: string): Promise<Dish | null>;
}
export interface MealIngredientRepository {
  getById(id: string): Promise<Ingredient | null>;
}
export interface MealFoodRepository {
  getById(id: string): Promise<Food | null>;
}
export interface MealLogServiceOptions {
  repository: MealLogRepository;
  dishRepository: MealDishRepository;
  ingredientRepository: MealIngredientRepository;
  foodRepository?: MealFoodRepository;
}
type MealInput = Omit<MealLog, "id" | "items"> & {
  id?: string;
  items: (Omit<MealLogItem, "id"> & { id?: string })[];
};
type MealChanges = Partial<Omit<MealLog, "id" | "items">> & {
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
  let fiberG: number | null = null;
  let saltEquivalentG: number | null = null;
  let nutritionComplete = true;
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
    // Fiber and salt are optional per meal; sum the meals that have them
    if (facts.fiberG !== null) fiberG = (fiberG ?? 0) + facts.fiberG;
    if (facts.saltEquivalentG !== null)
      saltEquivalentG = (saltEquivalentG ?? 0) + facts.saltEquivalentG;
  }
  return {
    priceYen,
    caloriesKcal: nutritionComplete ? caloriesKcal : null,
    proteinG: nutritionComplete ? proteinG : null,
    fatG: nutritionComplete ? fatG : null,
    carbohydrateG: nutritionComplete ? carbohydrateG : null,
    fiberG: nutritionComplete ? fiberG : null,
    saltEquivalentG: nutritionComplete ? saltEquivalentG : null,
  };
}

/** The meal price from its items: the priced items added up, or null when none has a price. */
export function sumItemPrices(items: readonly Pick<MealLogItem, "priceYen">[]): number | null {
  const prices = items
    .map((item) => item.priceYen)
    .filter((price): price is number => price !== null);
  return prices.length > 0 ? prices.reduce((sum, price) => sum + price, 0) : null;
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

export function createMealLogService({
  repository,
  dishRepository,
  ingredientRepository,
  foodRepository,
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
          const resolved = await Promise.all(
            dish.recipe.ingredients.map(async (entry) => {
              const ingredient = await ingredientRepository.getById(entry.ingredientId);
              if (!ingredient)
                throw new Error(
                  `Unknown ingredient ${entry.ingredientId} referenced by dish ${dish.id}`,
                );
              return { ingredient, amount: entry.amount };
            }),
          );
          // From the current ingredients, like the price; the stored dish total can predate them
          const nutrition =
            manual && item.nutrition
              ? item.nutrition
              : resolved.length > 0
                ? scaleNutritionFacts(
                    calculateDishNutrition(resolved, dish.servings),
                    item.servingsFactor,
                  )
                : dish.totalNutrition
                  ? scaleNutritionFacts(dish.totalNutrition, item.servingsFactor)
                  : null;
          const breakdown = resolved.map(({ ingredient, amount: entryAmount }) => {
            const amount = (entryAmount / dish.servings) * item.servingsFactor;
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
          });
          // Priced from current ingredient prices; like the dish cost, unpriced ingredients
          // are left out, and only a dish with no priced ingredient has no meal price.
          const priced = breakdown.filter((entry) => entry !== null);
          const priceYen =
            manual && item.priceYen !== null
              ? item.priceYen
              : priced.length === 0
                ? null
                : priced.reduce((sum, entry) => sum + entry.costYen, 0);
          return {
            ...item,
            // A meal item may be named differently from its recipe ("サバの塩焼き" for a fish recipe)
            name: item.name.trim() || dish.name,
            nutrition,
            priceYen,
            ingredientCostBreakdown: priced,
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
        if (item.foodId) {
          if (!foodRepository) throw new Error(`Unknown food: ${item.foodId}`);
          const food = await foodRepository.getById(item.foodId);
          if (!food) throw new Error(`Unknown food: ${item.foodId}`);
          const manual = item.estimationSource === "manual";
          return {
            ...item,
            name: item.name.trim() || food.name,
            nutrition:
              manual && item.nutrition
                ? item.nutrition
                : calculateFoodNutrition(food, item.servingsFactor),
            priceYen:
              manual && item.priceYen !== null
                ? item.priceYen
                : calculateFoodCost(food, item.servingsFactor),
            estimationSource: manual ? "manual" : "food",
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
      totalPriceYen: input.totalPriceYen ?? sumItemPrices(items),
      totalNutrition:
        input.totalNutrition ??
        (items.every((item) => item.nutrition !== null) ? sumNutritionFacts(nutritionItems) : null),
    });
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
    async update(id: string, changes: MealChanges): Promise<MealLog | null> {
      const current = await repository.getById(id);
      if (!current) return null;
      if (!changes.items) {
        return repository.update(id, {
          ...changes,
          items: current.items,
          // An explicit null drops a typed-in total and goes back to the item sum
          totalPriceYen:
            changes.totalPriceYen === null
              ? sumItemPrices(current.items)
              : (changes.totalPriceYen ?? current.totalPriceYen),
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
  };
}
