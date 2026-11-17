import { asc, eq } from "drizzle-orm";
import { foodSchema, type Food } from "../domain/ingredient";
import type { createDbClient } from "../db/client";
import { foods } from "../db/schema";

type Database = ReturnType<typeof createDbClient>;
type FoodChanges = Partial<Omit<Food, "id">>;

function fromRow(row: typeof foods.$inferSelect): Food {
  return foodSchema.parse({
    id: row.id,
    name: row.name,
    category: row.category,
    servingLabel: row.servingLabel,
    priceYen: row.priceYen,
    nutrition: JSON.parse(row.nutritionJson),
    memo: row.memo,
  });
}

function toValues(value: Food) {
  return {
    id: value.id,
    name: value.name,
    category: value.category,
    servingLabel: value.servingLabel,
    priceYen: value.priceYen,
    nutritionJson: JSON.stringify(value.nutrition),
    memo: value.memo,
  };
}

export function createFoodRepository(db: Database) {
  return {
    async list(): Promise<Food[]> {
      const rows = await db.select().from(foods).orderBy(asc(foods.name), asc(foods.id));
      return rows.map(fromRow);
    },
    async getById(id: string): Promise<Food | null> {
      const [row] = await db.select().from(foods).where(eq(foods.id, id)).limit(1);
      return row ? fromRow(row) : null;
    },
    async create(input: Food): Promise<Food> {
      const value = foodSchema.parse(input);
      const [row] = await db.insert(foods).values(toValues(value)).returning();
      if (!row) throw new Error("Food insert returned no row");
      return fromRow(row);
    },
    async update(id: string, changes: FoodChanges): Promise<Food | null> {
      const existing = await this.getById(id);
      if (!existing) return null;
      const value = foodSchema.parse({ ...existing, ...changes, id });
      const [row] = await db
        .update(foods)
        .set({ ...toValues(value), id: undefined, updatedAt: new Date().toISOString() })
        .where(eq(foods.id, id))
        .returning();
      return row ? fromRow(row) : null;
    },
    async delete(id: string): Promise<Food | null> {
      const [row] = await db.delete(foods).where(eq(foods.id, id)).returning();
      return row ? fromRow(row) : null;
    },
  };
}
