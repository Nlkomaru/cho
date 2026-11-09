import { and, asc, eq, inArray, or, sql } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { dishSchema, type Dish } from "../domain/ingredient";
import { MAX_DISH_IMAGES } from "../domain/recipe";
import type { createDbClient } from "../db/client";
import { dishIngredients, dishes, mediaImages } from "../db/schema";

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

/** A cover or step image that cannot be attached to the dish. The message is safe to show. */
export class DishImageError extends Error {
  override name = "DishImageError";
}

const DISH_IMAGE_TARGET = "dish";

/** Cover first, then step images in step order. Sort order follows this list. */
export function dishImageIds(dish: Pick<Dish, "coverImageId" | "recipe">): string[] {
  return [
    ...(dish.coverImageId ? [dish.coverImageId] : []),
    ...dish.recipe.steps.flatMap((step) => step.imageIds),
  ];
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
  function ownedImageIds(dishId: string) {
    return db
      .select({ id: mediaImages.id })
      .from(mediaImages)
      .where(and(eq(mediaImages.targetType, DISH_IMAGE_TARGET), eq(mediaImages.targetId, dishId)));
  }

  function detachImages(ids: readonly string[]) {
    return ids.length === 0
      ? []
      : [
          db
            .update(mediaImages)
            // created_at doubles as "unassigned since", so the 24 hour grace starts at release.
            .set({
              targetType: "unassigned",
              targetId: "unassigned",
              sortOrder: 0,
              createdAt: sql`CURRENT_TIMESTAMP`,
            })
            .where(inArray(mediaImages.id, [...ids])),
        ];
  }

  /**
   * Checks every referenced image and returns the statements that claim them for the dish
   * and release images the dish no longer uses. Run them in the same batch as the dish write.
   */
  async function imageStatements(dish: Dish, existing: boolean) {
    const ids = dishImageIds(dish);
    const seen = new Set<string>();
    for (const id of ids) {
      if (seen.has(id)) throw new DishImageError(`Image ${id} is used more than once.`);
      seen.add(id);
    }
    if (ids.length > MAX_DISH_IMAGES)
      throw new DishImageError(`A recipe can use at most ${MAX_DISH_IMAGES} images.`);
    const rows =
      ids.length === 0
        ? []
        : await db
            .select({
              id: mediaImages.id,
              targetType: mediaImages.targetType,
              targetId: mediaImages.targetId,
            })
            .from(mediaImages)
            .where(inArray(mediaImages.id, ids));
    const byId = new Map(rows.map((row) => [row.id, row]));
    for (const id of ids) {
      const row = byId.get(id);
      if (!row) throw new DishImageError(`Image not found: ${id}`);
      const unassigned = row.targetType === "unassigned" && row.targetId === "unassigned";
      const ownedHere = row.targetType === DISH_IMAGE_TARGET && row.targetId === dish.id;
      if (!unassigned && !ownedHere)
        throw new DishImageError(`Image ${id} is attached to another recipe or meal.`);
    }
    const owned = existing ? await ownedImageIds(dish.id) : [];
    // Claims only succeed while the image is still free or already ours; the guard below
    // aborts the whole batch when any claim lost a race with the purge or another save.
    const claims = ids.map((id, sortOrder) =>
      db
        .update(mediaImages)
        .set({ targetType: DISH_IMAGE_TARGET, targetId: dish.id, sortOrder })
        .where(
          and(
            eq(mediaImages.id, id),
            or(
              and(eq(mediaImages.targetType, "unassigned"), eq(mediaImages.targetId, "unassigned")),
              and(eq(mediaImages.targetType, DISH_IMAGE_TARGET), eq(mediaImages.targetId, dish.id)),
            ),
          ),
        ),
    );
    const guard =
      ids.length === 0
        ? []
        : [
            // json() raises on invalid input, which rolls the batch back.
            db
              .select({
                ok: sql<string>`json(CASE WHEN (
                SELECT count(*) FROM media_images
                WHERE id IN (${sql.join(
                  ids.map((id) => sql`${id}`),
                  sql`, `,
                )})
                AND target_type = ${DISH_IMAGE_TARGET} AND target_id = ${dish.id}
              ) = ${ids.length} THEN '1' ELSE '{' END)`,
              })
              // The dish row is written earlier in the same batch, so this always yields one row.
              .from(dishes)
              .where(eq(dishes.id, dish.id)),
          ];
    return [
      ...claims,
      ...guard,
      ...detachImages(owned.map((image) => image.id).filter((id) => !seen.has(id))),
    ];
  }

  /** Turns a rolled-back image claim into a readable error; rethrows anything else. */
  async function rethrowImageConflict(error: unknown, dish: Dish): Promise<never> {
    const ids = dishImageIds(dish);
    if (ids.length > 0) {
      const found = await db
        .select({ id: mediaImages.id })
        .from(mediaImages)
        .where(inArray(mediaImages.id, ids));
      const missing = ids.find((id) => !found.some((row) => row.id === id));
      if (missing) throw new DishImageError(`Image not found: ${missing}`);
      if (/malformed JSON/i.test(String(error) + String((error as Error)?.cause ?? "")))
        throw new DishImageError("An image is attached to another recipe or meal.");
    }
    throw error;
  }

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
      const images = await imageStatements(dish, false);
      const ingredientRows = dishIngredientValues(dish);
      const ingredientInserts =
        ingredientRows.length === 0
          ? []
          : chunkArray(ingredientRows, INGREDIENT_CHUNK_SIZE).map((chunk) =>
              db.insert(dishIngredients).values(chunk),
            );
      try {
        await db.batch([
          db.insert(dishes).values(dishValues(dish)),
          ...ingredientInserts,
          ...images,
        ] as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]]);
      } catch (error) {
        return rethrowImageConflict(error, dish);
      }
      const [row] = await db.select().from(dishes).where(eq(dishes.id, dish.id)).limit(1);
      if (!row) throw new Error("Dish insert completed without a readable row");
      return fromRow(row);
    },
    async update(id: string, changes: DishChanges): Promise<Dish | null> {
      const current = await this.getById(id);
      if (!current) return null;
      const dish = dishSchema.parse({ ...current, ...changes, id });
      const images = await imageStatements(dish, true);
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
      try {
        await db.batch([
          db
            .update(dishes)
            .set({ ...values, updatedAt: new Date().toISOString() })
            .where(eq(dishes.id, id)),
          db.delete(dishIngredients).where(eq(dishIngredients.dishId, id)),
          ...ingredientInserts,
          ...images,
        ] as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]]);
      } catch (error) {
        return rethrowImageConflict(error, dish);
      }
      return this.getById(id);
    },
    async delete(id: string): Promise<Dish | null> {
      const current = await this.getById(id);
      if (!current) return null;
      const owned = await ownedImageIds(id);
      // Released images become unassigned and are purged later with other unused uploads.
      await db.batch([
        db.delete(dishes).where(eq(dishes.id, id)),
        ...detachImages(owned.map((image) => image.id)),
      ]);
      return current;
    },
  };
}
