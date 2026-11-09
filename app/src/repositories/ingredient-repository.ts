import { asc, eq, inArray } from "drizzle-orm";
import { ingredientSchema, type Ingredient } from "../domain/ingredient";
import type { createDbClient } from "../db/client";
import { ingredients } from "../db/schema";

type Database = ReturnType<typeof createDbClient>;
type IngredientChanges = Partial<Omit<Ingredient, "id">>;

function fromRow(row: typeof ingredients.$inferSelect): Ingredient {
  return ingredientSchema.parse({
    id: row.id,
    name: row.name,
    normalizedName: row.normalizedName,
    baseDimension: row.baseDimension,
    baseUnit: row.baseUnit,
    nutritionBasisAmount: row.nutritionBasisAmount,
    nutritionPerBasis: JSON.parse(row.nutritionJson),
    gramPerUnit: row.gramPerUnit,
    inventiaItemId: row.inventiaItemId,
    latestUnitPriceYen: row.latestUnitPriceYen,
    latestPriceUpdatedAt: row.latestPriceUpdatedAt,
    memo: row.memo,
  });
}

function toValues(value: Ingredient) {
  return {
    id: value.id,
    name: value.name,
    normalizedName: value.normalizedName ?? value.name.trim().toLocaleLowerCase(),
    baseDimension: value.baseDimension,
    baseUnit: value.baseUnit,
    nutritionBasisAmount: value.nutritionBasisAmount,
    nutritionJson: JSON.stringify(value.nutritionPerBasis),
    gramPerUnit: value.gramPerUnit,
    inventiaItemId: value.inventiaItemId,
    latestUnitPriceYen: value.latestUnitPriceYen,
    latestPriceUpdatedAt: value.latestPriceUpdatedAt,
    memo: value.memo,
  };
}

export function createIngredientRepository(db: Database) {
  return {
    async list(): Promise<Ingredient[]> {
      const rows = await db
        .select()
        .from(ingredients)
        .orderBy(asc(ingredients.name), asc(ingredients.id));
      return rows.map(fromRow);
    },
    async getById(id: string): Promise<Ingredient | null> {
      const [row] = await db.select().from(ingredients).where(eq(ingredients.id, id)).limit(1);
      return row ? fromRow(row) : null;
    },
    async getByIds(ids: readonly string[]): Promise<Ingredient[]> {
      const found: Ingredient[] = [];
      // D1 allows at most 100 bound variables per statement.
      for (let index = 0; index < ids.length; index += 90) {
        const rows = await db
          .select()
          .from(ingredients)
          .where(inArray(ingredients.id, ids.slice(index, index + 90)));
        found.push(...rows.map(fromRow));
      }
      return found;
    },
    async create(input: Ingredient): Promise<Ingredient> {
      const value = ingredientSchema.parse(input);
      const [row] = await db.insert(ingredients).values(toValues(value)).returning();
      if (!row) throw new Error("Ingredient insert returned no row");
      return fromRow(row);
    },
    async update(id: string, changes: IngredientChanges): Promise<Ingredient | null> {
      const existing = await this.getById(id);
      if (!existing) return null;
      const value = ingredientSchema.parse({ ...existing, ...changes, id });
      const [row] = await db
        .update(ingredients)
        .set({ ...toValues(value), id: undefined, updatedAt: new Date().toISOString() })
        .where(eq(ingredients.id, id))
        .returning();
      return row ? fromRow(row) : null;
    },
    async delete(id: string): Promise<Ingredient | null> {
      const [row] = await db.delete(ingredients).where(eq(ingredients.id, id)).returning();
      return row ? fromRow(row) : null;
    },
  };
}
