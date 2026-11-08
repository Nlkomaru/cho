import { asc, eq } from "drizzle-orm";
import { dishSchema, type Dish } from "../domain/ingredient";
import type { createDbClient } from "../db/client";
import { dishIngredients, dishes } from "../db/schema";

type Database = ReturnType<typeof createDbClient>;
type DishChanges = Partial<Omit<Dish, "id">>;

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
      await db.batch([
        db.insert(dishes).values(dishValues(dish)),
        db.insert(dishIngredients).values(dishIngredientValues(dish)),
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
      await db.batch([
        db
          .update(dishes)
          .set({ ...values, updatedAt: new Date().toISOString() })
          .where(eq(dishes.id, id)),
        db.delete(dishIngredients).where(eq(dishIngredients.dishId, id)),
        db.insert(dishIngredients).values(dishIngredientValues(dish)),
      ]);
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
