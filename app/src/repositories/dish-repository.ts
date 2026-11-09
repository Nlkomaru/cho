import { asc, eq } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { dishSchema, type Dish } from "../domain/ingredient";
import type { createDbClient } from "../db/client";
import { dishIngredients, dishes } from "../db/schema";

type Database = ReturnType<typeof createDbClient>;
type DishChanges = Partial<Omit<Dish, "id">>;

const INGREDIENT_CHUNK_SIZE = 8;

function chunkArray<T>(items: readonly T[], size: number): T[][] {
  if (size <= 0) throw new RangeError("Chunk size must be positive");
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function fromRow(row: typeof dishes.$inferSelect): Dish {
  return dishSchema.parse({
    id: row.id,
    name: row.name,
    category: row.category,
    servings: row.servings,
    recipe: JSON.parse(row.recipeJson),
    totalNutrition:
      row.cachedTotalNutritionJson === null ? null : JSON.parse(row.cachedTotalNutritionJson),
    totalCostYen: row.cachedTotalCostYen,
    coverImageId: row.coverImageId,
    notes: row.notes,
  });
}

function dishValues(dish: Dish) {
  return {
    id: dish.id,
    name: dish.name,
    category: dish.category,
    servings: dish.servings,
    recipeJson: JSON.stringify(dish.recipe),
    cachedTotalNutritionJson:
      dish.totalNutrition === null ? null : JSON.stringify(dish.totalNutrition),
    cachedTotalCostYen: dish.totalCostYen,
    coverImageId: dish.coverImageId,
    notes: dish.notes,
  };
}

function dishIngredientValues(dish: Dish) {
  return dish.recipe.ingredients.map((entry, sortOrder) => {
    const group =
      entry.groupId === null
        ? undefined
        : dish.recipe.ingredientGroups.find((candidate) => candidate.id === entry.groupId);
    return {
      id: crypto.randomUUID(),
      dishId: dish.id,
      ingredientId: entry.ingredientId,
      recipeEntryId: entry.id,
      amount: entry.amount,
      displayAmount: entry.displayAmount,
      role: entry.role,
      groupSymbol: group?.symbol ?? null,
      groupLabel: group?.label ?? null,
      prepNote: entry.prepNote,
      sortOrder,
    };
  });
}

export function createDishRepository(db: Database) {
  return {
    async list(): Promise<Dish[]> {
      const rows = await db.select().from(dishes).orderBy(asc(dishes.name), asc(dishes.id));
      return rows.map(fromRow);
    },
    async getById(id: string): Promise<Dish | null> {
      const [row] = await db.select().from(dishes).where(eq(dishes.id, id)).limit(1);
      return row ? fromRow(row) : null;
    },
    async create(input: Dish): Promise<Dish> {
      const dish = dishSchema.parse(input);
      const ingredientRows = dishIngredientValues(dish);
      const ingredientInserts =
        ingredientRows.length === 0
          ? []
          : chunkArray(ingredientRows, INGREDIENT_CHUNK_SIZE).map((chunk) =>
              db.insert(dishIngredients).values(chunk),
            );
      await db.batch([db.insert(dishes).values(dishValues(dish)), ...ingredientInserts] as [
        BatchItem<"sqlite">,
        ...BatchItem<"sqlite">[],
      ]);
      const [row] = await db.select().from(dishes).where(eq(dishes.id, dish.id)).limit(1);
      if (!row) throw new Error("Dish insert completed without a readable row");
      return fromRow(row);
    },
    async update(id: string, changes: DishChanges): Promise<Dish | null> {
      const current = await this.getById(id);
      if (!current) return null;
      const dish = dishSchema.parse({ ...current, ...changes, id });
      const updateValues = dishValues(dish);
      const values = {
        name: updateValues.name,
        category: updateValues.category,
        servings: updateValues.servings,
        recipeJson: updateValues.recipeJson,
        cachedTotalNutritionJson: updateValues.cachedTotalNutritionJson,
        cachedTotalCostYen: updateValues.cachedTotalCostYen,
        coverImageId: updateValues.coverImageId,
        notes: updateValues.notes,
      };
      const ingredientRows = dishIngredientValues(dish);
      const ingredientInserts =
        ingredientRows.length === 0
          ? []
          : chunkArray(ingredientRows, INGREDIENT_CHUNK_SIZE).map((chunk) =>
              db.insert(dishIngredients).values(chunk),
            );
      await db.batch([
        db
          .update(dishes)
          .set({ ...values, updatedAt: new Date().toISOString() })
          .where(eq(dishes.id, id)),
        db.delete(dishIngredients).where(eq(dishIngredients.dishId, id)),
        ...ingredientInserts,
      ] as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]]);
      return this.getById(id);
    },
    async delete(id: string): Promise<Dish | null> {
      const current = await this.getById(id);
      if (!current) return null;
      await db.delete(dishes).where(eq(dishes.id, id));
      return current;
    },
  };
}
