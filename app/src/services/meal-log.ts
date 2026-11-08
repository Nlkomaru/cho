import {
  mealLogSchema,
  type Dish,
  type Ingredient,
  type MealLog,
  type MealLogItem,
} from "../domain/ingredient";
import { calculateIngredientCost, calculateIngredientNutrition } from "../domain/ingredient";
import { scaleNutritionFacts, sumNutritionFacts } from "../domain/nutrition";
import type { NutritionFacts } from "../domain/nutrition";
import type { InventiaStockAdjustRequest, InventiaStockOperationResult } from "./inventia-client";

export interface MealLogRepository {
  list(filter?: {
    from?: string;
    to?: string;
    sourceType?: MealLog["sourceType"];
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
  return {
    list: (filter?: { from?: string; to?: string; sourceType?: MealLog["sourceType"] }) =>
      repository.list(filter),
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
    async consumeStock(logId: string): Promise<InventiaStockOperationResult[]> {
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
            const body: InventiaStockAdjustRequest = {
              delta: -Math.round((totalAmount / dish.servings) * item.servingsFactor),
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
    },
  };
}
