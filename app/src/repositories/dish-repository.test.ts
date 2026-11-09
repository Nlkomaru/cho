import { readdirSync, readFileSync } from "node:fs";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { describe, expect, test } from "vite-plus/test";
import { createDbClient } from "../db/client";
import { dishIngredients } from "../db/schema";
import {
  dishSchema,
  ingredientSchema,
  mealLogSchema,
  type Dish,
  type Ingredient,
  type MealLog,
} from "../domain/ingredient";
import { createDishRepository } from "./dish-repository";
import { createIngredientRepository } from "./ingredient-repository";
import { createMealLogRepository } from "./meal-log-repository";

type ExecutedStatement = {
  sql: string;
  paramCount: number;
  parameters: SQLInputValue[];
};

function createTestDatabase() {
  const sqlite = new DatabaseSync(":memory:");
  const migrations = new URL("../../migrations/", import.meta.url);
  for (const file of readdirSync(migrations)
    .filter((name) => name.endsWith(".sql"))
    .sort()) {
    sqlite.exec(readFileSync(new URL(file, migrations), "utf8"));
  }

  let statementCount = 0;
  const executedStatements: ExecutedStatement[] = [];
  const binding = {
    prepare(sql: string) {
      return {
        bind(...parameters: SQLInputValue[]) {
          statementCount++;
          executedStatements.push({ sql, paramCount: parameters.length, parameters });
          // Simulate Cloudflare D1's SQLITE_MAX_VARIABLE_NUMBER = 100 enforcement
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
    getStatementCount: () => statementCount,
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

function createTestDish(id: string, name: string, ingredientCount: number): Dish {
  const ingredients = Array.from({ length: ingredientCount }, (_, i) => ({
    id: `${id}-entry-${i + 1}`,
    ingredientId: `ing-${i + 1}`,
    name: `Ingredient ${i + 1}`,
    amount: (i + 1) * 10,
    unit: "g",
    displayAmount: `${(i + 1) * 10} g`,
    role: "main" as const,
    groupId: null,
    prepNote: null,
  }));

  return dishSchema.parse({
    id,
    name,
    category: "Main",
    servings: 2,
    recipe: {
      schemaVersion: "1.0",
      servings: 2,
      summary: `Test recipe with ${ingredientCount} ingredients`,
      equipment: ["pan"],
      ingredientGroups: [],
      ingredients,
      steps: [
        {
          id: "step-1",
          stepNumber: 1,
          phase: "cook",
          title: "Cook ingredients",
          instruction: "Combine and heat thoroughly.",
          executionMode: "active",
          timing: {
            activeDurationSec: 300,
            passiveDurationSec: 0,
            minTotalDurationSec: null,
            maxTotalDurationSec: null,
            scalingMode: "fixed",
            timerLabel: null,
          },
          dependsOnStepIds: [],
          resourceTags: [],
          heatLevel: "medium",
          targetTempCelsius: null,
          inputs: [],
          outputs: [],
          completionCue: null,
          cautions: [],
        },
      ],
      globalCautions: [],
    },
    totalNutrition: null,
    totalCostYen: null,
    coverImageId: null,
    notes: null,
  });
}

function createTestMealLog(id: string, itemCount: number): MealLog {
  const items = Array.from({ length: itemCount }, (_, i) => ({
    id: `${id}-item-${i + 1}`,
    dishId: null,
    ingredientId: `ing-${i + 1}`,
    name: `Item ${i + 1}`,
    servingsFactor: 1,
    priceYen: 100,
    nutrition: null,
    ingredientCostBreakdown: [],
    estimationSource: "manual" as const,
    sortOrder: i,
  }));

  return mealLogSchema.parse({
    id,
    eatenAt: new Date().toISOString(),
    mealTiming: "dinner",
    sourceType: "self_cooked",
    placeName: "Home",
    title: `Meal with ${itemCount} items`,
    totalPriceYen: itemCount * 100,
    totalNutrition: null,
    rating: 5,
    memo: "Delicious",
    inventiaConsumptionStatus: null,
    imageIds: [],
    items,
  });
}

describe("Empirical Reproduction: D1 SQL Variable Limit at Offset 505", () => {
  test("reproduces that a naive single INSERT of 12 ingredients fails with too many SQL variables at offset 505", async () => {
    const { db } = createTestDatabase();

    // 12 rows with 11 columns each = 132 bound parameters (> 100 limit)
    const rows = Array.from({ length: 12 }, (_, i) => ({
      id: `repro-entry-${i + 1}`,
      dishId: "dish-repro",
      ingredientId: `ing-${i + 1}`,
      recipeEntryId: `entry-${i + 1}`,
      amount: (i + 1) * 10,
      displayAmount: `${(i + 1) * 10} g`,
      role: "main" as const,
      groupSymbol: null,
      groupLabel: null,
      prepNote: null,
      sortOrder: i,
    }));

    // Naive unchunked insert (pre-fix logic)
    let caughtError: unknown = null;
    try {
      await db.insert(dishIngredients).values(rows);
    } catch (err) {
      caughtError = err;
    }

    expect(caughtError).not.toBeNull();
    const errorString =
      String(caughtError) + " " + String((caughtError as { cause?: unknown })?.cause);
    expect(errorString).toContain("D1_ERROR: too many SQL variables at offset 505 (132 > 100)");
  });
});

describe("Dish Repository D1 SQL Variable Limit Stress Tests", () => {
  test("creates and retrieves a dish with 1 ingredient (minimum boundary)", async () => {
    const { db, sqlite, executedStatements, clearStatements } = createTestDatabase();
    const dishRepo = createDishRepository(db);
    const ingredientRepo = createIngredientRepository(db);

    await ingredientRepo.create(createTestIngredient("ing-1", "Ingredient 1"));

    clearStatements();
    const dish1 = createTestDish("dish-1", "Single Ingredient Dish", 1);
    const created = await dishRepo.create(dish1);

    expect(created.id).toBe("dish-1");
    expect(created.recipe.ingredients).toHaveLength(1);

    for (const stmt of executedStatements) {
      expect(stmt.paramCount).toBeLessThanOrEqual(100);
    }

    const fetched = await dishRepo.getById("dish-1");
    expect(fetched).not.toBeNull();
    expect(fetched?.recipe.ingredients).toHaveLength(1);

    const rows = sqlite
      .prepare("SELECT COUNT(*) as count FROM dish_ingredients WHERE dish_id = ?")
      .get("dish-1") as { count: number };
    expect(rows.count).toBe(1);
  });

  test("creates a dish at the 8 and 9 ingredient chunk boundaries without exceeding limits", async () => {
    const { db, sqlite, executedStatements, clearStatements } = createTestDatabase();
    const dishRepo = createDishRepository(db);
    const ingredientRepo = createIngredientRepository(db);

    for (let i = 1; i <= 9; i++) {
      await ingredientRepo.create(createTestIngredient(`ing-${i}`, `Ingredient ${i}`));
    }

    // 8 ingredients: exactly 1 chunk of 8 rows (8 * 11 = 88 parameters)
    clearStatements();
    const dish8 = createTestDish("dish-8", "Eight Ingredient Dish", 8);
    const created8 = await dishRepo.create(dish8);
    expect(created8.recipe.ingredients).toHaveLength(8);

    const insert8 = executedStatements.filter(
      (s) => s.sql.includes("dish_ingredients") && s.sql.toLowerCase().includes("insert"),
    );
    expect(insert8).toHaveLength(1);
    expect(insert8[0].paramCount).toBe(88); // 8 * 11

    for (const stmt of executedStatements) {
      expect(stmt.paramCount).toBeLessThanOrEqual(100);
    }

    // 9 ingredients: 2 chunks (8 + 1 rows = 88 + 11 parameters)
    clearStatements();
    const dish9 = createTestDish("dish-9", "Nine Ingredient Dish", 9);
    const created9 = await dishRepo.create(dish9);
    expect(created9.recipe.ingredients).toHaveLength(9);

    const insert9 = executedStatements.filter(
      (s) => s.sql.includes("dish_ingredients") && s.sql.toLowerCase().includes("insert"),
    );
    expect(insert9).toHaveLength(2);
    expect(insert9[0].paramCount).toBe(88); // 8 * 11
    expect(insert9[1].paramCount).toBe(11); // 1 * 11

    for (const stmt of executedStatements) {
      expect(stmt.paramCount).toBeLessThanOrEqual(100);
    }

    const rows8 = sqlite
      .prepare("SELECT COUNT(*) as count FROM dish_ingredients WHERE dish_id = ?")
      .get("dish-8") as { count: number };
    expect(rows8.count).toBe(8);

    const rows9 = sqlite
      .prepare("SELECT COUNT(*) as count FROM dish_ingredients WHERE dish_id = ?")
      .get("dish-9") as { count: number };
    expect(rows9.count).toBe(9);
  });

  test("stress test: creates and retrieves a recipe with 12 ingredients (R1 target)", async () => {
    const { db, sqlite, executedStatements, clearStatements } = createTestDatabase();
    const dishRepo = createDishRepository(db);
    const ingredientRepo = createIngredientRepository(db);

    for (let i = 1; i <= 12; i++) {
      await ingredientRepo.create(createTestIngredient(`ing-${i}`, `Ingredient ${i}`));
    }

    clearStatements();
    const dish12 = createTestDish("dish-12", "Twelve Ingredient Dish", 12);
    const created = await dishRepo.create(dish12);

    expect(created.id).toBe("dish-12");
    expect(created.recipe.ingredients).toHaveLength(12);

    // Verify chunking: 12 rows -> 2 chunks: 8 rows (88 params) and 4 rows (44 params)
    const ingredientInserts = executedStatements.filter(
      (s) => s.sql.includes("dish_ingredients") && s.sql.toLowerCase().includes("insert"),
    );
    expect(ingredientInserts).toHaveLength(2);
    expect(ingredientInserts[0].paramCount).toBe(88);
    expect(ingredientInserts[1].paramCount).toBe(44);

    // Assert ALL query statements generated adhere to the strict 100 parameter limit
    for (const stmt of executedStatements) {
      expect(stmt.paramCount).toBeLessThanOrEqual(100);
    }

    // Verify row persistence via repository and direct SQLite query
    const fetched = await dishRepo.getById("dish-12");
    expect(fetched).not.toBeNull();
    expect(fetched?.recipe.ingredients).toHaveLength(12);
    for (let i = 0; i < 12; i++) {
      expect(fetched?.recipe.ingredients[i].ingredientId).toBe(`ing-${i + 1}`);
      expect(fetched?.recipe.ingredients[i].name).toBe(`Ingredient ${i + 1}`);
      expect(fetched?.recipe.ingredients[i].amount).toBe((i + 1) * 10);
    }

    const rows = sqlite
      .prepare("SELECT COUNT(*) as count FROM dish_ingredients WHERE dish_id = ?")
      .get("dish-12") as { count: number };
    expect(rows.count).toBe(12);
  });

  test("stress test: creates and retrieves a recipe with 24 ingredients", async () => {
    const { db, sqlite, executedStatements, clearStatements } = createTestDatabase();
    const dishRepo = createDishRepository(db);
    const ingredientRepo = createIngredientRepository(db);

    for (let i = 1; i <= 24; i++) {
      await ingredientRepo.create(createTestIngredient(`ing-${i}`, `Ingredient ${i}`));
    }

    clearStatements();
    const dish24 = createTestDish("dish-24", "Twenty-Four Ingredient Dish", 24);
    const created = await dishRepo.create(dish24);

    expect(created.id).toBe("dish-24");
    expect(created.recipe.ingredients).toHaveLength(24);

    // Verify chunking: 24 rows -> 3 chunks: 8, 8, 8 rows (88 params each)
    const ingredientInserts = executedStatements.filter(
      (s) => s.sql.includes("dish_ingredients") && s.sql.toLowerCase().includes("insert"),
    );
    expect(ingredientInserts).toHaveLength(3);
    for (const chunkStmt of ingredientInserts) {
      expect(chunkStmt.paramCount).toBe(88);
    }

    for (const stmt of executedStatements) {
      expect(stmt.paramCount).toBeLessThanOrEqual(100);
    }

    const fetched = await dishRepo.getById("dish-24");
    expect(fetched).not.toBeNull();
    expect(fetched?.recipe.ingredients).toHaveLength(24);

    const rows = sqlite
      .prepare("SELECT COUNT(*) as count FROM dish_ingredients WHERE dish_id = ?")
      .get("dish-24") as { count: number };
    expect(rows.count).toBe(24);
  });

  test("stress test: creates and retrieves a recipe with 50 ingredients", async () => {
    const { db, sqlite, executedStatements, clearStatements } = createTestDatabase();
    const dishRepo = createDishRepository(db);
    const ingredientRepo = createIngredientRepository(db);

    for (let i = 1; i <= 50; i++) {
      await ingredientRepo.create(createTestIngredient(`ing-${i}`, `Ingredient ${i}`));
    }

    clearStatements();
    const dish50 = createTestDish("dish-50", "Fifty Ingredient Dish", 50);
    const created = await dishRepo.create(dish50);

    expect(created.id).toBe("dish-50");
    expect(created.recipe.ingredients).toHaveLength(50);

    // Verify chunking: 50 rows -> 7 chunks: 6 x 8 rows (88 params) + 1 x 2 rows (22 params)
    const ingredientInserts = executedStatements.filter(
      (s) => s.sql.includes("dish_ingredients") && s.sql.toLowerCase().includes("insert"),
    );
    expect(ingredientInserts).toHaveLength(7);
    for (let c = 0; c < 6; c++) {
      expect(ingredientInserts[c].paramCount).toBe(88);
    }
    expect(ingredientInserts[6].paramCount).toBe(22); // 2 * 11

    for (const stmt of executedStatements) {
      expect(stmt.paramCount).toBeLessThanOrEqual(100);
    }

    const fetched = await dishRepo.getById("dish-50");
    expect(fetched).not.toBeNull();
    expect(fetched?.recipe.ingredients).toHaveLength(50);
    expect(fetched?.recipe.ingredients[0].name).toBe("Ingredient 1");
    expect(fetched?.recipe.ingredients[49].name).toBe("Ingredient 50");

    const rows = sqlite
      .prepare("SELECT COUNT(*) as count FROM dish_ingredients WHERE dish_id = ?")
      .get("dish-50") as { count: number };
    expect(rows.count).toBe(50);
  });

  test("stress test: creates and retrieves a maximum recipe with 100 ingredients", async () => {
    const { db, sqlite, executedStatements, clearStatements } = createTestDatabase();
    const dishRepo = createDishRepository(db);
    const ingredientRepo = createIngredientRepository(db);

    for (let i = 1; i <= 100; i++) {
      await ingredientRepo.create(createTestIngredient(`ing-${i}`, `Ingredient ${i}`));
    }

    clearStatements();
    const dish100 = createTestDish("dish-100", "Hundred Ingredient Dish", 100);
    const created = await dishRepo.create(dish100);

    expect(created.id).toBe("dish-100");
    expect(created.recipe.ingredients).toHaveLength(100);

    // Verify chunking: 100 rows -> 13 chunks: 12 x 8 rows (88 params) + 1 x 4 rows (44 params)
    const ingredientInserts = executedStatements.filter(
      (s) => s.sql.includes("dish_ingredients") && s.sql.toLowerCase().includes("insert"),
    );
    expect(ingredientInserts).toHaveLength(13);
    for (let c = 0; c < 12; c++) {
      expect(ingredientInserts[c].paramCount).toBe(88);
    }
    expect(ingredientInserts[12].paramCount).toBe(44);

    for (const stmt of executedStatements) {
      expect(stmt.paramCount).toBeLessThanOrEqual(100);
    }

    const fetched = await dishRepo.getById("dish-100");
    expect(fetched).not.toBeNull();
    expect(fetched?.recipe.ingredients).toHaveLength(100);
    expect(fetched?.recipe.ingredients[0].name).toBe("Ingredient 1");
    expect(fetched?.recipe.ingredients[99].name).toBe("Ingredient 100");

    const rows = sqlite
      .prepare("SELECT COUNT(*) as count FROM dish_ingredients WHERE dish_id = ?")
      .get("dish-100") as { count: number };
    expect(rows.count).toBe(100);
  });

  test("stress test: updates a recipe from 24 ingredients to 50 ingredients", async () => {
    const { db, sqlite, executedStatements, clearStatements } = createTestDatabase();
    const dishRepo = createDishRepository(db);
    const ingredientRepo = createIngredientRepository(db);

    for (let i = 1; i <= 50; i++) {
      await ingredientRepo.create(createTestIngredient(`ing-${i}`, `Ingredient ${i}`));
    }

    // Initial 24 ingredients
    const initialDish = createTestDish("dish-update-stress", "Initial 24 Dish", 24);
    await dishRepo.create(initialDish);

    // Update to 50 ingredients
    clearStatements();
    const updatedRecipeDish = createTestDish("dish-update-stress", "Updated 50 Dish", 50);
    const updated = await dishRepo.update("dish-update-stress", {
      name: "Updated 50 Dish",
      recipe: updatedRecipeDish.recipe,
    });

    expect(updated).not.toBeNull();
    expect(updated?.name).toBe("Updated 50 Dish");
    expect(updated?.recipe.ingredients).toHaveLength(50);

    for (const stmt of executedStatements) {
      expect(stmt.paramCount).toBeLessThanOrEqual(100);
    }

    const rows = sqlite
      .prepare("SELECT COUNT(*) as count FROM dish_ingredients WHERE dish_id = ?")
      .get("dish-update-stress") as { count: number };
    expect(rows.count).toBe(50);
  });
});

describe("Meal Log Repository D1 SQL Variable Limit Stress Tests", () => {
  test("creates and updates meal logs across 12, 24, 50, and 100 items without exceeding limits", async () => {
    const { db, sqlite, executedStatements, clearStatements } = createTestDatabase();
    const mealLogRepo = createMealLogRepository(db);
    const ingredientRepo = createIngredientRepository(db);

    for (let i = 1; i <= 100; i++) {
      await ingredientRepo.create(createTestIngredient(`ing-${i}`, `Ingredient ${i}`));
    }

    // 1. Create with 12 items (2 chunks: 8 + 4 = 88 + 44 params)
    clearStatements();
    const log12 = createTestMealLog("meal-12", 12);
    const created12 = await mealLogRepo.create(log12);
    expect(created12.items).toHaveLength(12);

    for (const stmt of executedStatements) {
      expect(stmt.paramCount).toBeLessThanOrEqual(100);
    }

    const fetched12 = await mealLogRepo.getById("meal-12");
    expect(fetched12?.items).toHaveLength(12);
    const rows12 = sqlite
      .prepare("SELECT COUNT(*) as count FROM meal_log_items WHERE meal_log_id = ?")
      .get("meal-12") as { count: number };
    expect(rows12.count).toBe(12);

    // 2. Create with 24 items (3 chunks: 8 + 8 + 8 = 88 + 88 + 88 params)
    clearStatements();
    const log24 = createTestMealLog("meal-24", 24);
    const created24 = await mealLogRepo.create(log24);
    expect(created24.items).toHaveLength(24);

    for (const stmt of executedStatements) {
      expect(stmt.paramCount).toBeLessThanOrEqual(100);
    }

    const fetched24 = await mealLogRepo.getById("meal-24");
    expect(fetched24?.items).toHaveLength(24);
    const rows24 = sqlite
      .prepare("SELECT COUNT(*) as count FROM meal_log_items WHERE meal_log_id = ?")
      .get("meal-24") as { count: number };
    expect(rows24.count).toBe(24);

    // 3. Create with 50 items (7 chunks: 6 * 8 + 2 = 88 * 6 + 22 params)
    clearStatements();
    const log50 = createTestMealLog("meal-50", 50);
    const created50 = await mealLogRepo.create(log50);
    expect(created50.items).toHaveLength(50);

    for (const stmt of executedStatements) {
      expect(stmt.paramCount).toBeLessThanOrEqual(100);
    }

    const fetched50 = await mealLogRepo.getById("meal-50");
    expect(fetched50?.items).toHaveLength(50);
    const rows50 = sqlite
      .prepare("SELECT COUNT(*) as count FROM meal_log_items WHERE meal_log_id = ?")
      .get("meal-50") as { count: number };
    expect(rows50.count).toBe(50);

    // 4. Update meal-12 to have 100 items (13 chunks: 12 * 8 + 4 = 88 * 12 + 44 params)
    clearStatements();
    const log100 = createTestMealLog("meal-12-updated", 100);
    const updated100 = await mealLogRepo.update("meal-12", {
      title: "Updated Meal 100 items",
      items: log100.items,
    });
    expect(updated100?.items).toHaveLength(100);

    for (const stmt of executedStatements) {
      expect(stmt.paramCount).toBeLessThanOrEqual(100);
    }

    const rows100 = sqlite
      .prepare("SELECT COUNT(*) as count FROM meal_log_items WHERE meal_log_id = ?")
      .get("meal-12") as { count: number };
    expect(rows100.count).toBe(100);
  });
});
