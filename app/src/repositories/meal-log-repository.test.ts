import { readdirSync, readFileSync } from "node:fs";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { describe, expect, test } from "vite-plus/test";
import { createDbClient } from "../db/client";
import {
  ingredientSchema,
  mealLogSchema,
  type Ingredient,
  type MealLog,
} from "../domain/ingredient";
import { createIngredientRepository } from "./ingredient-repository";
import { createMealLogRepository } from "./meal-log-repository";

type StatementRecord = {
  sql: string;
  parameterCount: number;
};

function createTestDatabase(options: { foreignKeys?: boolean } = {}) {
  const sqlite = new DatabaseSync(":memory:");
  if (options.foreignKeys !== false) {
    sqlite.exec("PRAGMA foreign_keys = ON;");
  }
  const migrations = new URL("../../migrations/", import.meta.url);
  for (const file of readdirSync(migrations)
    .filter((name) => name.endsWith(".sql"))
    .sort()) {
    sqlite.exec(readFileSync(new URL(file, migrations), "utf8"));
  }

  const executedStatements: StatementRecord[] = [];

  const binding = {
    prepare(sql: string) {
      return {
        bind(...parameters: SQLInputValue[]) {
          executedStatements.push({
            sql,
            parameterCount: parameters.length,
          });

          // Simulate Cloudflare D1 SQLITE_MAX_VARIABLE_NUMBER = 100 enforcement
          if (parameters.length > 100) {
            throw new Error(
              `D1_ERROR: too many SQL variables at offset 505 (${parameters.length} > 100)`,
            );
          }
          const statement = sqlite.prepare(sql);
          return {
            async run() {
              return statement.run(...parameters);
            },
            async all() {
              return { results: statement.all(...parameters) };
            },
            async raw() {
              return statement.all(...parameters).map((row) => Object.values(row));
            },
          };
        },
      };
    },
    async batch(statements: { run: () => Promise<unknown> }[]) {
      sqlite.exec("BEGIN");
      try {
        const results = [];
        for (const statement of statements) {
          const meta = await statement.run();
          results.push({ success: true, results: [], meta });
        }
        sqlite.exec("COMMIT");
        return results;
      } catch (error) {
        sqlite.exec("ROLLBACK");
        throw error;
      }
    },
  } as unknown as D1Database;

  const db = createDbClient(binding);
  return {
    sqlite,
    binding,
    db,
    executedStatements,
    clearStatements: () => {
      executedStatements.length = 0;
    },
  };
}

function createTestIngredient(id: string, name: string): Ingredient {
  return ingredientSchema.parse({
    id,
    name,
    normalizedName: name.toLowerCase(),
    baseDimension: "mass",
    baseUnit: "g",
    nutritionBasisAmount: 100,
    nutritionPerBasis: {
      caloriesKcal: 100,
      proteinG: 5,
      fatG: 2,
      carbohydrateG: 10,
      fiberG: 1,
      saltEquivalentG: 0.2,
      micronutrients: [],
    },
    gramPerUnit: null,
    inventiaItemId: null,
    latestUnitPriceYen: 150,
    latestPriceUpdatedAt: null,
    memo: null,
  });
}

function createTestMealLog(
  id: string,
  itemCount: number,
  options: {
    ingredientIdPrefix?: string | null;
    dishId?: string | null;
    duplicateItemIdAtIndex?: { index: number; duplicateWithIndex: number };
    imageIds?: string[];
  } = {},
): MealLog {
  const items = Array.from({ length: itemCount }, (_, i) => {
    let itemId = `item-${id}-${i + 1}`;
    if (options.duplicateItemIdAtIndex && options.duplicateItemIdAtIndex.index === i) {
      itemId = `item-${id}-${options.duplicateItemIdAtIndex.duplicateWithIndex + 1}`;
    }

    const ingredientId =
      options.ingredientIdPrefix === null
        ? null
        : `${options.ingredientIdPrefix ?? "ing-"}${i + 1}`;

    return {
      id: itemId,
      dishId: options.dishId ?? null,
      ingredientId,
      name: `Meal Item ${i + 1}`,
      servingsFactor: 1 + i * 0.1,
      priceYen: 100 + i * 10,
      nutrition: {
        caloriesKcal: 50 + i * 5,
        proteinG: 5,
        fatG: 2,
        carbohydrateG: 10,
        fiberG: 1,
        saltEquivalentG: 0.2,
      },
      ingredientCostBreakdown: [],
      estimationSource: "manual" as const,
      sortOrder: i,
    };
  });

  return mealLogSchema.parse({
    id,
    eatenAt: "2026-11-09T12:00:00.000Z",
    mealTiming: "lunch",
    sourceType: "self_cooked",
    placeName: "Kitchen",
    title: `Meal Log with ${itemCount} items`,
    totalPriceYen: itemCount * 100,
    totalNutrition: null,
    rating: 4,
    memo: `Adversarial test meal log with ${itemCount} items`,
    inventiaConsumptionStatus: null,
    imageIds: options.imageIds ?? [],
    items,
  });
}

describe("Empirical Challenger M1-2: Meal Log Repository & Rollback Adversarial Tests", () => {
  // --- Section 1: Edge Cases (0 items, 1 item, 8 items, 9 items) ---

  test("Edge Case 0 items: Schema correctly rejects 0 items at validation boundary (domain invariant items.min(1))", async () => {
    const { db, sqlite } = createTestDatabase();
    const mealLogRepo = createMealLogRepository(db);

    // Attempting to create a meal log with 0 items must be rejected by mealLogSchema
    const rawZeroLog = {
      id: "meal-0",
      eatenAt: "2026-11-09T12:00:00.000Z",
      mealTiming: "lunch",
      sourceType: "self_cooked",
      placeName: "Kitchen",
      title: "Zero Items Meal Log",
      totalPriceYen: 0,
      totalNutrition: null,
      rating: 4,
      memo: "Zero items",
      inventiaConsumptionStatus: null,
      imageIds: [],
      items: [],
    };

    await expect(mealLogRepo.create(rawZeroLog as unknown as MealLog)).rejects.toThrow(
      /Too small: expected array to have >=1 items/,
    );

    // Verify nothing was written to the database
    const logRow = sqlite.prepare("SELECT * FROM meal_logs WHERE id = ?").get("meal-0");
    expect(logRow).toBeUndefined();

    // Now test update with 0 items on an existing valid meal log
    const validLog = createTestMealLog("meal-valid", 1, { ingredientIdPrefix: null });
    await mealLogRepo.create(validLog);

    await expect(
      mealLogRepo.update("meal-valid", {
        items: [] as unknown as MealLog["items"],
      }),
    ).rejects.toThrow(/Too small: expected array to have >=1 items/);

    // Verify existing meal log remains intact with its 1 item
    const fetched = await mealLogRepo.getById("meal-valid");
    expect(fetched?.items).toHaveLength(1);
  });

  test("Edge Case 1 item: Minimum valid meal log creates and updates cleanly (1 chunk of 11 params)", async () => {
    const { db, sqlite, executedStatements, clearStatements } = createTestDatabase();
    const mealLogRepo = createMealLogRepository(db);

    const log1 = createTestMealLog("meal-1", 1, { ingredientIdPrefix: null });
    clearStatements();
    const created = await mealLogRepo.create(log1);

    expect(created.id).toBe("meal-1");
    expect(created.items).toHaveLength(1);

    const itemInserts = executedStatements.filter(
      (s) => s.sql.includes("meal_log_items") && s.sql.toLowerCase().includes("insert"),
    );
    expect(itemInserts).toHaveLength(1);
    expect(itemInserts[0].parameterCount).toBe(11);

    const count = sqlite
      .prepare("SELECT COUNT(*) as count FROM meal_log_items WHERE meal_log_id = ?")
      .get("meal-1") as { count: number };
    expect(count.count).toBe(1);

    const fetched = await mealLogRepo.getById("meal-1");
    expect(fetched?.items).toHaveLength(1);
  });

  test("Edge Case 8 items: Hits exact 1-chunk boundary (88 params <= 100)", async () => {
    const { db, sqlite, executedStatements, clearStatements } = createTestDatabase();
    const mealLogRepo = createMealLogRepository(db);

    const log8 = createTestMealLog("meal-8", 8, { ingredientIdPrefix: null });
    clearStatements();
    const created = await mealLogRepo.create(log8);

    expect(created.id).toBe("meal-8");
    expect(created.items).toHaveLength(8);

    // Filter statement records for meal_log_items inserts
    const itemInserts = executedStatements.filter(
      (s) => s.sql.includes("meal_log_items") && s.sql.toLowerCase().includes("insert"),
    );
    expect(itemInserts).toHaveLength(1);
    // 8 items * 11 columns = 88 parameters
    expect(itemInserts[0].parameterCount).toBe(88);
    expect(itemInserts[0].parameterCount).toBeLessThanOrEqual(100);

    const count = sqlite
      .prepare("SELECT COUNT(*) as count FROM meal_log_items WHERE meal_log_id = ?")
      .get("meal-8") as { count: number };
    expect(count.count).toBe(8);

    const fetched = await mealLogRepo.getById("meal-8");
    expect(fetched?.items).toHaveLength(8);
  });

  test("Edge Case 9 items: Cleanly splits into 2 chunks (8 + 1) without overflow", async () => {
    const { db, sqlite, executedStatements, clearStatements } = createTestDatabase();
    const mealLogRepo = createMealLogRepository(db);

    const log9 = createTestMealLog("meal-9", 9, { ingredientIdPrefix: null });
    clearStatements();
    const created = await mealLogRepo.create(log9);

    expect(created.id).toBe("meal-9");
    expect(created.items).toHaveLength(9);

    // Check chunking statements
    const itemInserts = executedStatements.filter(
      (s) => s.sql.includes("meal_log_items") && s.sql.toLowerCase().includes("insert"),
    );
    expect(itemInserts).toHaveLength(2);
    // Chunk 1: 8 rows * 11 columns = 88 params
    expect(itemInserts[0].parameterCount).toBe(88);
    // Chunk 2: 1 row * 11 columns = 11 params
    expect(itemInserts[1].parameterCount).toBe(11);

    const count = sqlite
      .prepare("SELECT COUNT(*) as count FROM meal_log_items WHERE meal_log_id = ?")
      .get("meal-9") as { count: number };
    expect(count.count).toBe(9);

    const fetched = await mealLogRepo.getById("meal-9");
    expect(fetched?.items).toHaveLength(9);
    expect(fetched?.items[0].name).toBe("Meal Item 1");
    expect(fetched?.items[8].name).toBe("Meal Item 9");
  });

  // --- Section 2: Large Arrays (12+, 25, 50, 100 items) ---

  test("Large Array 1: 12 items meal log (R1 error target: 132 params chunked to 88 + 44)", async () => {
    const { db, sqlite, executedStatements, clearStatements } = createTestDatabase();
    const mealLogRepo = createMealLogRepository(db);

    const log12 = createTestMealLog("meal-12", 12, { ingredientIdPrefix: null });
    clearStatements();
    const created = await mealLogRepo.create(log12);

    expect(created.id).toBe("meal-12");
    expect(created.items).toHaveLength(12);

    const itemInserts = executedStatements.filter(
      (s) => s.sql.includes("meal_log_items") && s.sql.toLowerCase().includes("insert"),
    );
    expect(itemInserts).toHaveLength(2);
    expect(itemInserts[0].parameterCount).toBe(88);
    expect(itemInserts[1].parameterCount).toBe(44);

    const count = sqlite
      .prepare("SELECT COUNT(*) as count FROM meal_log_items WHERE meal_log_id = ?")
      .get("meal-12") as { count: number };
    expect(count.count).toBe(12);

    const fetched = await mealLogRepo.getById("meal-12");
    expect(fetched?.items).toHaveLength(12);
    for (let i = 0; i < 12; i++) {
      expect(fetched?.items[i].name).toBe(`Meal Item ${i + 1}`);
      expect(fetched?.items[i].sortOrder).toBe(i);
    }
  });

  test("Large Array 2: 25 items meal log (275 params chunked into 4 statements)", async () => {
    const { db, sqlite, executedStatements, clearStatements } = createTestDatabase();
    const mealLogRepo = createMealLogRepository(db);

    const log25 = createTestMealLog("meal-25", 25, { ingredientIdPrefix: null });
    clearStatements();
    const created = await mealLogRepo.create(log25);

    expect(created.items).toHaveLength(25);

    const itemInserts = executedStatements.filter(
      (s) => s.sql.includes("meal_log_items") && s.sql.toLowerCase().includes("insert"),
    );
    // Math.ceil(25 / 8) = 4 chunks: 8, 8, 8, 1
    expect(itemInserts).toHaveLength(4);
    expect(itemInserts[0].parameterCount).toBe(88);
    expect(itemInserts[1].parameterCount).toBe(88);
    expect(itemInserts[2].parameterCount).toBe(88);
    expect(itemInserts[3].parameterCount).toBe(11);

    const count = sqlite
      .prepare("SELECT COUNT(*) as count FROM meal_log_items WHERE meal_log_id = ?")
      .get("meal-25") as { count: number };
    expect(count.count).toBe(25);
  });

  test("Large Array 3: 100 items meal log (1100 params chunked into 13 statements within atomic batch)", async () => {
    const { db, sqlite, executedStatements, clearStatements } = createTestDatabase();
    const mealLogRepo = createMealLogRepository(db);

    const log100 = createTestMealLog("meal-100", 100, { ingredientIdPrefix: null });
    clearStatements();
    const created = await mealLogRepo.create(log100);

    expect(created.items).toHaveLength(100);

    const itemInserts = executedStatements.filter(
      (s) => s.sql.includes("meal_log_items") && s.sql.toLowerCase().includes("insert"),
    );
    // Math.ceil(100 / 8) = 13 chunks (12 chunks of 8, 1 chunk of 4)
    expect(itemInserts).toHaveLength(13);
    for (let i = 0; i < 12; i++) {
      expect(itemInserts[i].parameterCount).toBe(88);
    }
    expect(itemInserts[12].parameterCount).toBe(44);

    const count = sqlite
      .prepare("SELECT COUNT(*) as count FROM meal_log_items WHERE meal_log_id = ?")
      .get("meal-100") as { count: number };
    expect(count.count).toBe(100);

    const fetched = await mealLogRepo.getById("meal-100");
    expect(fetched?.items).toHaveLength(100);
    expect(fetched?.items[99].name).toBe("Meal Item 100");
  });

  // --- Section 3: Dynamic Update Transitions Across Chunk Boundaries ---

  test("Update Transitions: 12 items -> 8 items -> 9 items -> 1 item -> 16 items", async () => {
    const { db, sqlite } = createTestDatabase();
    const mealLogRepo = createMealLogRepository(db);

    // 1. Initial creation with 12 items (2 chunks)
    const initialLog = createTestMealLog("meal-trans", 12, { ingredientIdPrefix: null });
    await mealLogRepo.create(initialLog);
    let count = sqlite
      .prepare("SELECT COUNT(*) as count FROM meal_log_items WHERE meal_log_id = ?")
      .get("meal-trans") as { count: number };
    expect(count.count).toBe(12);

    // 2. Update to 8 items (shrinks to 1 chunk)
    const log8 = createTestMealLog("meal-trans", 8, { ingredientIdPrefix: null });
    const updated8 = await mealLogRepo.update("meal-trans", { items: log8.items });
    expect(updated8?.items).toHaveLength(8);
    count = sqlite
      .prepare("SELECT COUNT(*) as count FROM meal_log_items WHERE meal_log_id = ?")
      .get("meal-trans") as { count: number };
    expect(count.count).toBe(8);

    // 3. Update to 9 items (expands to 2 chunks)
    const log9 = createTestMealLog("meal-trans", 9, { ingredientIdPrefix: null });
    const updated9 = await mealLogRepo.update("meal-trans", { items: log9.items });
    expect(updated9?.items).toHaveLength(9);
    count = sqlite
      .prepare("SELECT COUNT(*) as count FROM meal_log_items WHERE meal_log_id = ?")
      .get("meal-trans") as { count: number };
    expect(count.count).toBe(9);

    // 4. Update to 1 item (shrinks to minimal 1 chunk)
    const log1 = createTestMealLog("meal-trans", 1, { ingredientIdPrefix: null });
    const updated1 = await mealLogRepo.update("meal-trans", { items: log1.items });
    expect(updated1?.items).toHaveLength(1);
    count = sqlite
      .prepare("SELECT COUNT(*) as count FROM meal_log_items WHERE meal_log_id = ?")
      .get("meal-trans") as { count: number };
    expect(count.count).toBe(1);

    // 5. Update to 16 items (exactly 2 chunks of 8)
    const log16 = createTestMealLog("meal-trans", 16, { ingredientIdPrefix: null });
    const updated16 = await mealLogRepo.update("meal-trans", { items: log16.items });
    expect(updated16?.items).toHaveLength(16);
    count = sqlite
      .prepare("SELECT COUNT(*) as count FROM meal_log_items WHERE meal_log_id = ?")
      .get("meal-trans") as { count: number };
    expect(count.count).toBe(16);
  });

  // --- Section 4: Transactional Rollback Behavior ---

  test("Rollback on Create 1: Failure in Chunk 1 (foreign key constraint) rolls back meal log completely", async () => {
    const { db, sqlite } = createTestDatabase({ foreignKeys: true });
    const mealLogRepo = createMealLogRepository(db);

    // Try creating a meal log referencing nonexistent ingredient in Chunk 1 (item 1)
    const logInvalid = createTestMealLog("meal-fail-1", 4, {
      ingredientIdPrefix: "nonexistent-ing-",
    });

    await expect(mealLogRepo.create(logInvalid)).rejects.toThrow();

    // Verify atomic rollback: meal_logs row must NOT exist
    const logRow = sqlite.prepare("SELECT * FROM meal_logs WHERE id = ?").get("meal-fail-1");
    expect(logRow).toBeUndefined();

    // Verify meal_log_items has 0 rows
    const count = sqlite
      .prepare("SELECT COUNT(*) as count FROM meal_log_items WHERE meal_log_id = ?")
      .get("meal-fail-1") as { count: number };
    expect(count.count).toBe(0);
  });

  test("Rollback on Create 2: Failure in Chunk 2 across boundary (item 9 FK failure) rolls back Chunk 1 and meal log", async () => {
    const { db, sqlite } = createTestDatabase({ foreignKeys: true });
    const mealLogRepo = createMealLogRepository(db);
    const ingredientRepo = createIngredientRepository(db);

    // Seed 8 valid ingredients: items 1..8 in Chunk 1 will be valid
    for (let i = 1; i <= 8; i++) {
      await ingredientRepo.create(createTestIngredient(`ing-${i}`, `Ingredient ${i}`));
    }
    // ing-9 is NOT seeded! Item 9 in Chunk 2 will trigger a foreign key violation!

    const log9 = createTestMealLog("meal-fail-2", 9, { ingredientIdPrefix: "ing-" });

    await expect(mealLogRepo.create(log9)).rejects.toThrow();

    // Transaction rollback check:
    // 1. meal_logs row must be rolled back
    const logRow = sqlite.prepare("SELECT * FROM meal_logs WHERE id = ?").get("meal-fail-2");
    expect(logRow).toBeUndefined();

    // 2. All 8 items from Chunk 1 MUST be rolled back as well!
    const count = sqlite
      .prepare("SELECT COUNT(*) as count FROM meal_log_items WHERE meal_log_id = ?")
      .get("meal-fail-2") as { count: number };
    expect(count.count).toBe(0);
  });

  test("Rollback on Create 3: Unique constraint violation in Chunk 2 rolls back entire batch", async () => {
    const { db, sqlite } = createTestDatabase();
    const mealLogRepo = createMealLogRepository(db);

    // Create 12 items where item 10 has a duplicate primary key matching item 1
    const logDup = createTestMealLog("meal-dup", 12, {
      ingredientIdPrefix: null,
      duplicateItemIdAtIndex: { index: 9, duplicateWithIndex: 0 },
    });

    await expect(mealLogRepo.create(logDup)).rejects.toThrow();

    const logRow = sqlite.prepare("SELECT * FROM meal_logs WHERE id = ?").get("meal-dup");
    expect(logRow).toBeUndefined();

    const count = sqlite
      .prepare("SELECT COUNT(*) as count FROM meal_log_items WHERE meal_log_id = ?")
      .get("meal-dup") as { count: number };
    expect(count.count).toBe(0);
  });

  test("Rollback on Update: Failure in chunked insert rolls back deletion and update, preserving original state", async () => {
    const { db, sqlite } = createTestDatabase({ foreignKeys: true });
    const mealLogRepo = createMealLogRepository(db);
    const ingredientRepo = createIngredientRepository(db);

    // Seed 3 valid ingredients
    for (let i = 1; i <= 3; i++) {
      await ingredientRepo.create(createTestIngredient(`ing-${i}`, `Ingredient ${i}`));
    }

    // Create initial meal log with 3 items
    const initialLog = createTestMealLog("meal-up-roll", 3, { ingredientIdPrefix: "ing-" });
    await mealLogRepo.create(initialLog);

    const initialFetch = await mealLogRepo.getById("meal-up-roll");
    expect(initialFetch?.items).toHaveLength(3);
    expect(initialFetch?.title).toBe("Meal Log with 3 items");

    // Attempt to update to 10 items, but item 10 has an invalid ingredient FK
    const invalidLog = createTestMealLog("meal-up-roll", 10, {
      ingredientIdPrefix: "invalid-ing-",
    });

    await expect(
      mealLogRepo.update("meal-up-roll", {
        title: "Corrupted Update Title",
        items: invalidLog.items,
      }),
    ).rejects.toThrow();

    // Verify rollback of update:
    // 1. Title was NOT changed
    const fetched = await mealLogRepo.getById("meal-up-roll");
    expect(fetched?.title).toBe("Meal Log with 3 items");

    // 2. Original 3 items were NOT deleted and are still intact
    expect(fetched?.items).toHaveLength(3);
    expect(fetched?.items[0].name).toBe("Meal Item 1");
    expect(fetched?.items[2].name).toBe("Meal Item 3");

    // 3. Raw database table count is exactly 3
    const count = sqlite
      .prepare("SELECT COUNT(*) as count FROM meal_log_items WHERE meal_log_id = ?")
      .get("meal-up-roll") as { count: number };
    expect(count.count).toBe(3);
  });

  // --- Section 5: Media Images Integration & Rollback ---

  test("Media Images Integration: Chunked items and image assignments execute atomically with rollback on failure", async () => {
    const { db, sqlite } = createTestDatabase();
    const mealLogRepo = createMealLogRepository(db);

    // Insert 2 unassigned media images
    sqlite.exec(`
      INSERT INTO media_images (id, target_type, target_id, object_key, content_type, byte_size)
      VALUES
        ('img-1', 'unassigned', 'unassigned', 'key-1.jpg', 'image/jpeg', 1024),
        ('img-2', 'unassigned', 'unassigned', 'key-2.jpg', 'image/jpeg', 2048);
    `);

    // 1. Create a meal log with 10 items (2 chunks) and 2 images
    const logWithImages = createTestMealLog("meal-images", 10, {
      ingredientIdPrefix: null,
      imageIds: ["img-1", "img-2"],
    });

    const created = await mealLogRepo.create(logWithImages);
    expect(created.imageIds).toEqual(["img-1", "img-2"]);
    expect(created.items).toHaveLength(10);

    // Verify images in DB are now assigned to meal-images
    const assignedImgs = sqlite
      .prepare("SELECT id, target_type, target_id FROM media_images WHERE id IN ('img-1', 'img-2')")
      .all() as { id: string; target_type: string; target_id: string }[];
    expect(assignedImgs).toHaveLength(2);
    expect(assignedImgs[0].target_type).toBe("meal_log");
    expect(assignedImgs[0].target_id).toBe("meal-images");

    // 2. Test rollback with image attachment:
    // Insert another unassigned image 'img-3'
    sqlite.exec(`
      INSERT INTO media_images (id, target_type, target_id, object_key, content_type, byte_size)
      VALUES ('img-3', 'unassigned', 'unassigned', 'key-3.jpg', 'image/jpeg', 3072);
    `);

    // Attempt to update with 12 items where item 10 has duplicate ID, plus new image 'img-3'
    const failingLog = createTestMealLog("meal-images", 12, {
      ingredientIdPrefix: null,
      duplicateItemIdAtIndex: { index: 9, duplicateWithIndex: 0 },
      imageIds: ["img-1", "img-2", "img-3"],
    });

    await expect(
      mealLogRepo.update("meal-images", {
        items: failingLog.items,
        imageIds: failingLog.imageIds,
      }),
    ).rejects.toThrow();

    // Verify img-3 remains 'unassigned' and was rolled back!
    const img3 = sqlite
      .prepare("SELECT target_type, target_id FROM media_images WHERE id = 'img-3'")
      .get() as { target_type: string; target_id: string };
    expect(img3.target_type).toBe("unassigned");
    expect(img3.target_id).toBe("unassigned");

    // Existing meal-images still has original 10 items and 2 images
    const fetched = await mealLogRepo.getById("meal-images");
    expect(fetched?.items).toHaveLength(10);
    expect(fetched?.imageIds).toEqual(["img-1", "img-2"]);
  });

  // --- Section 6: list() Query Verification ---

  test("list() Query: Correctly gathers and groups items across multiple logs of varying chunk sizes", async () => {
    const { db } = createTestDatabase();
    const mealLogRepo = createMealLogRepository(db);

    await mealLogRepo.create(createTestMealLog("list-log-1", 1, { ingredientIdPrefix: null }));
    await mealLogRepo.create(createTestMealLog("list-log-8", 8, { ingredientIdPrefix: null }));
    await mealLogRepo.create(createTestMealLog("list-log-9", 9, { ingredientIdPrefix: null }));
    await mealLogRepo.create(createTestMealLog("list-log-15", 15, { ingredientIdPrefix: null }));

    const list = await mealLogRepo.list();
    expect(list).toHaveLength(4);

    const map = new Map(list.map((log) => [log.id, log]));
    expect(map.get("list-log-1")?.items).toHaveLength(1);
    expect(map.get("list-log-8")?.items).toHaveLength(8);
    expect(map.get("list-log-9")?.items).toHaveLength(9);
    expect(map.get("list-log-15")?.items).toHaveLength(15);
  });
});
