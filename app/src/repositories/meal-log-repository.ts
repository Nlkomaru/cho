import { and, asc, desc, eq, gte, inArray, like, lte, or } from "drizzle-orm";
import { mealLogSchema, type MealLog } from "../domain/ingredient";
import type { createDbClient } from "../db/client";
import { mealLogItems, mealLogs, mediaImages } from "../db/schema";

type Database = ReturnType<typeof createDbClient>;
type MealLogChanges = Partial<Omit<MealLog, "id">>;
type MealLogFilter = {
  from?: string;
  to?: string;
  sourceType?: MealLog["sourceType"];
  mealTiming?: NonNullable<MealLog["mealTiming"]>;
  q?: string;
};
type InventiaConsumptionStatus = MealLog["inventiaConsumptionStatus"];

function parseJson(value: string | null): unknown {
  return value === null ? null : JSON.parse(value);
}

function serialize(value: unknown): string | null {
  return value === null ? null : JSON.stringify(value);
}

export function createMealLogRepository(db: Database) {
  async function getById(id: string): Promise<MealLog | null> {
    const [row] = await db.select().from(mealLogs).where(eq(mealLogs.id, id)).limit(1);
    if (!row) return null;
    const [items, images] = await Promise.all([
      db
        .select()
        .from(mealLogItems)
        .where(eq(mealLogItems.mealLogId, id))
        .orderBy(asc(mealLogItems.sortOrder), asc(mealLogItems.id)),
      db
        .select({ id: mediaImages.id })
        .from(mediaImages)
        .where(and(eq(mediaImages.targetType, "meal_log"), eq(mediaImages.targetId, id)))
        .orderBy(asc(mediaImages.sortOrder), asc(mediaImages.id)),
    ]);
    return mealLogSchema.parse({
      id: row.id,
      eatenAt: row.eatenAt,
      mealTiming: row.mealTiming,
      sourceType: row.sourceType,
      placeName: row.placeName,
      title: row.title,
      totalPriceYen: row.totalPriceYen,
      totalNutrition: parseJson(row.totalNutritionJson),
      rating: row.rating,
      memo: row.memo,
      inventiaConsumptionStatus: row.inventiaConsumptionStatus,
      imageIds: images.map((image) => image.id),
      items: items.map((item) => ({
        id: item.id,
        dishId: item.dishId,
        ingredientId: item.ingredientId,
        name: item.name,
        servingsFactor: item.servingsFactor,
        priceYen: item.priceYen,
        nutrition: parseJson(item.nutritionJson),
        ingredientCostBreakdown: parseJson(item.ingredientCostBreakdownJson) ?? [],
        estimationSource: item.estimationSource ?? "manual",
        sortOrder: item.sortOrder,
      })),
    });
  }

  function itemRows(log: MealLog) {
    return log.items.map((item) => ({
      id: item.id,
      mealLogId: log.id,
      dishId: item.dishId,
      ingredientId: item.ingredientId,
      name: item.name,
      servingsFactor: item.servingsFactor,
      priceYen: item.priceYen,
      nutritionJson: serialize(item.nutrition),
      ingredientCostBreakdownJson: serialize(item.ingredientCostBreakdown),
      estimationSource: item.estimationSource,
      sortOrder: item.sortOrder,
    }));
  }

  function imageUpdates(log: MealLog) {
    return log.imageIds.map((imageId, sortOrder) =>
      db
        .update(mediaImages)
        .set({ targetType: "meal_log", targetId: log.id, sortOrder })
        .where(eq(mediaImages.id, imageId)),
    );
  }

  function logValues(log: MealLog) {
    return {
      id: log.id,
      eatenAt: log.eatenAt,
      mealTiming: log.mealTiming,
      sourceType: log.sourceType,
      placeName: log.placeName,
      title: log.title,
      totalPriceYen: log.totalPriceYen,
      totalNutritionJson: serialize(log.totalNutrition),
      rating: log.rating,
      memo: log.memo,
      inventiaConsumptionStatus: log.inventiaConsumptionStatus,
    };
  }

  async function assertImages(imageIds: string[], mealLogId: string | null): Promise<void> {
    if (new Set(imageIds).size !== imageIds.length) throw new TypeError("imageIds must be unique");
    if (imageIds.length === 0) return;
    const rows = await db
      .select({
        id: mediaImages.id,
        targetType: mediaImages.targetType,
        targetId: mediaImages.targetId,
      })
      .from(mediaImages)
      .where(inArray(mediaImages.id, imageIds));
    if (rows.length !== imageIds.length) throw new TypeError("Every image must exist");
    for (const image of rows) {
      const isUnassigned = image.targetType === "unassigned" && image.targetId === "unassigned";
      const belongsToMeal =
        mealLogId !== null && image.targetType === "meal_log" && image.targetId === mealLogId;
      if (!isUnassigned && !belongsToMeal)
        throw new TypeError("Image is already attached to another target");
    }
  }

  return {
    async list(filter: MealLogFilter = {}): Promise<MealLog[]> {
      const conditions = [];
      if (filter.from) conditions.push(gte(mealLogs.eatenAt, filter.from));
      if (filter.to) conditions.push(lte(mealLogs.eatenAt, filter.to));
      if (filter.sourceType) conditions.push(eq(mealLogs.sourceType, filter.sourceType));
      if (filter.mealTiming) conditions.push(eq(mealLogs.mealTiming, filter.mealTiming));
      if (filter.q) {
        const pattern = `%${filter.q}%`;
        const text = or(like(mealLogs.title, pattern), like(mealLogs.placeName, pattern));
        if (text) conditions.push(text);
      }
      const rows = await db
        .select()
        .from(mealLogs)
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(desc(mealLogs.eatenAt), desc(mealLogs.id));
      const ids = rows.map((row) => row.id);
      if (ids.length === 0) return [];
      const [items, images] = await Promise.all([
        db
          .select()
          .from(mealLogItems)
          .where(inArray(mealLogItems.mealLogId, ids))
          .orderBy(asc(mealLogItems.sortOrder), asc(mealLogItems.id)),
        db
          .select({ id: mediaImages.id, targetId: mediaImages.targetId })
          .from(mediaImages)
          .where(and(eq(mediaImages.targetType, "meal_log"), inArray(mediaImages.targetId, ids)))
          .orderBy(asc(mediaImages.sortOrder), asc(mediaImages.id)),
      ]);
      const itemsByLog = new Map<string, typeof items>();
      for (const item of items) {
        const group = itemsByLog.get(item.mealLogId) ?? [];
        group.push(item);
        itemsByLog.set(item.mealLogId, group);
      }
      const imagesByLog = new Map<string, typeof images>();
      for (const image of images) {
        const group = imagesByLog.get(image.targetId) ?? [];
        group.push(image);
        imagesByLog.set(image.targetId, group);
      }
      return rows.map((row) =>
        mealLogSchema.parse({
          id: row.id,
          eatenAt: row.eatenAt,
          mealTiming: row.mealTiming,
          sourceType: row.sourceType,
          placeName: row.placeName,
          title: row.title,
          totalPriceYen: row.totalPriceYen,
          totalNutrition: parseJson(row.totalNutritionJson),
          rating: row.rating,
          memo: row.memo,
          inventiaConsumptionStatus: row.inventiaConsumptionStatus,
          imageIds: (imagesByLog.get(row.id) ?? []).map((image) => image.id),
          items: (itemsByLog.get(row.id) ?? []).map((item) => ({
            id: item.id,
            dishId: item.dishId,
            ingredientId: item.ingredientId,
            name: item.name,
            servingsFactor: item.servingsFactor,
            priceYen: item.priceYen,
            nutrition: parseJson(item.nutritionJson),
            ingredientCostBreakdown: parseJson(item.ingredientCostBreakdownJson) ?? [],
            estimationSource: item.estimationSource ?? "manual",
            sortOrder: item.sortOrder,
          })),
        }),
      );
    },
    getById,
    async create(input: MealLog): Promise<MealLog> {
      const log = mealLogSchema.parse(input);
      await assertImages(log.imageIds, null);
      await db.batch([
        db.insert(mealLogs).values(logValues(log)),
        db.insert(mealLogItems).values(itemRows(log)),
        ...imageUpdates(log),
      ]);
      const created = await getById(log.id);
      if (!created) throw new Error("Meal log insert completed without a readable row");
      return created;
    },
    async update(id: string, changes: MealLogChanges): Promise<MealLog | null> {
      const current = await getById(id);
      if (!current) return null;
      const log = mealLogSchema.parse({ ...current, ...changes, id });
      await assertImages(log.imageIds, id);
      const existingImages = await db
        .select({ id: mediaImages.id })
        .from(mediaImages)
        .where(and(eq(mediaImages.targetType, "meal_log"), eq(mediaImages.targetId, id)));
      const retainedImageIds = new Set(log.imageIds);
      const detachImageUpdates = existingImages
        .filter((image) => !retainedImageIds.has(image.id))
        .map((image) =>
          db
            .update(mediaImages)
            .set({ targetType: "unassigned", targetId: "unassigned" })
            .where(eq(mediaImages.id, image.id)),
        );
      const values = logValues(log);
      await db.batch([
        db
          .update(mealLogs)
          .set({
            eatenAt: values.eatenAt,
            mealTiming: values.mealTiming,
            sourceType: values.sourceType,
            placeName: values.placeName,
            title: values.title,
            totalPriceYen: values.totalPriceYen,
            totalNutritionJson: values.totalNutritionJson,
            rating: values.rating,
            memo: values.memo,
            inventiaConsumptionStatus: values.inventiaConsumptionStatus,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(mealLogs.id, id)),
        db.delete(mealLogItems).where(eq(mealLogItems.mealLogId, id)),
        db.insert(mealLogItems).values(itemRows(log)),
        ...detachImageUpdates,
        ...imageUpdates(log),
      ]);
      return getById(id);
    },
    async delete(id: string): Promise<MealLog | null> {
      const current = await getById(id);
      if (!current) return null;
      const images = await db
        .select({ id: mediaImages.id })
        .from(mediaImages)
        .where(and(eq(mediaImages.targetType, "meal_log"), eq(mediaImages.targetId, id)));
      await db.batch([
        ...images.map((image) =>
          db
            .update(mediaImages)
            .set({ targetType: "unassigned", targetId: "unassigned" })
            .where(eq(mediaImages.id, image.id)),
        ),
        db.delete(mealLogs).where(eq(mealLogs.id, id)),
      ]);
      return current;
    },
    async setInventiaConsumptionStatus(
      id: string,
      status: InventiaConsumptionStatus,
    ): Promise<boolean> {
      const rows = await db
        .update(mealLogs)
        .set({ inventiaConsumptionStatus: status, updatedAt: new Date().toISOString() })
        .where(eq(mealLogs.id, id))
        .returning({ id: mealLogs.id });
      return rows.length > 0;
    },
  };
}
