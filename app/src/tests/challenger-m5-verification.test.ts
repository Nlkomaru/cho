import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vite-plus/test";
import { z } from "zod";

import { api } from "../api";
import { mcpToolNames } from "../domain/mcp";
import type { RecipeJson } from "../domain/recipe";
import { createDishRepository } from "../repositories/dish-repository";
import { createMealLogRepository } from "../repositories/meal-log-repository";
import {
  createTwelveIngredientRecipePayload,
  twelveIngredientsMaster,
} from "./fixtures/recipe-fixtures";
import { createTestD1Harness } from "./test-harness";

function generateNIngredientsMaster(prefix: string, count: number) {
  const items = [];
  for (let i = 0; i < count; i++) {
    items.push({
      name: `${prefix} Ing ${i + 1}`,
      baseDimension: "mass" as const,
      baseUnit: "g",
      nutritionBasisAmount: 100,
      nutritionPerBasis: {
        caloriesKcal: 50 + (i % 20),
        proteinG: 2,
        fatG: 1,
        carbohydrateG: 8,
        fiberG: 1,
        saltEquivalentG: 0.1,
        micronutrients: [],
      },
    });
  }
  return items;
}

function buildAdversarialRecipe(
  title: string,
  ingredients: Array<{
    id: string;
    ingredientId: string;
    name: string;
    amount: number;
    unit: string;
  }>,
): RecipeJson {
  return {
    schemaVersion: "1.0",
    servings: 2,
    summary: `${title} summary`,
    equipment: ["大鍋"],
    ingredientGroups: [],
    ingredients: ingredients.map((ing) => ({
      id: ing.id,
      ingredientId: ing.ingredientId,
      name: ing.name,
      amount: ing.amount,
      unit: ing.unit,
      displayAmount: `${ing.amount}${ing.unit}`,
      role: "main",
      groupId: null,
      prepNote: null,
    })),
    steps: [
      {
        id: "step-1",
        stepNumber: 1,
        phase: "cook",
        title: `${title} 調理`,
        instruction: "すべての材料を大鍋に入れて加熱する",
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
        resourceTags: ["pot"],
        heatLevel: "medium",
        targetTempCelsius: null,
        inputs: ingredients.map((ing) => ({
          type: "ingredient",
          ingredientEntryId: ing.id,
          amountRatio: 1,
          amountText: null,
        })),
        outputs: [{ id: "out-1", label: "完成料理" }],
        completionCue: "煮込み完了",
        cautions: [],
        imageIds: [],
      },
    ],
    globalCautions: [],
  };
}

describe("Empirical Challenger M5: Adversarial Stress Test Suite for R1 & R2", () => {
  // =========================================================================
  // Challenge Area 1: D1 Variable Limit & Batch Chunking (R1)
  // =========================================================================
  describe("R1 Stress: D1 Parameter Limits & Batch Chunking", () => {
    test("1.1: 12-ingredient workspace recipe_payload_4step.json inserts cleanly under 100-variable limit", async () => {
      const harness = createTestD1Harness({
        enforceVariableLimit: true,
        maxVariablesPerStatement: 100,
      });
      try {
        const { secret } = await harness.issueToken([...mcpToolNames]);

        // Load root recipe_payload_4step.json
        const payloadPath = resolve(process.cwd(), "recipe_payload_4step.json");
        const rawPayload = JSON.parse(readFileSync(payloadPath, "utf8"));

        expect(rawPayload.recipe.ingredients).toHaveLength(12);
        expect(rawPayload.recipe.steps).toHaveLength(4);

        // Pre-register ingredients
        const nameToId: Record<string, string> = {};
        for (const ing of rawPayload.recipe.ingredients) {
          const res = await harness.callMcp(secret, "create_ingredient", {
            name: ing.name,
            baseDimension: ing.unit === "mL" ? "volume" : "mass",
            baseUnit: ing.unit,
            nutritionBasisAmount: 100,
            nutritionPerBasis: {
              caloriesKcal: 40,
              proteinG: 1,
              fatG: 1,
              carbohydrateG: 5,
              fiberG: 1,
              saltEquivalentG: 0,
              micronutrients: [],
            },
          });
          expect(res.response.status).toBe(200);
          const body = z
            .object({ ingredient: z.object({ id: z.string(), name: z.string() }) })
            .parse(res.body.result?.structuredContent);
          nameToId[body.ingredient.name] = body.ingredient.id;
        }

        const mappedPayload = {
          ...rawPayload,
          recipe: {
            ...rawPayload.recipe,
            ingredients: rawPayload.recipe.ingredients.map(
              (ing: { name: string; [k: string]: unknown }) => ({
                ...ing,
                ingredientId: nameToId[ing.name],
              }),
            ),
          },
        };

        const createRes = await harness.callMcp(secret, "create_recipe", mappedPayload);
        expect(createRes.response.status).toBe(200);
        expect(createRes.body.error).toBeUndefined();

        const createdDish = z
          .object({ recipe: z.object({ id: z.string() }) })
          .parse(createRes.body.result?.structuredContent);

        // Direct SQL check
        const rows = harness.sqlite
          .prepare("SELECT COUNT(*) as count FROM dish_ingredients WHERE dish_id = ?")
          .get(createdDish.recipe.id) as { count: number };
        expect(rows.count).toBe(12);

        // list_recipes check
        const listRes = await harness.callMcp(secret, "list_recipes", {});
        const list = z
          .object({
            recipes: z.array(
              z.object({
                id: z.string(),
                name: z.string(),
                recipe: z.object({
                  ingredients: z.array(z.object({ name: z.string(), amount: z.number() })),
                  steps: z.array(z.object({ stepNumber: z.number(), phase: z.string() })),
                }),
              }),
            ),
          })
          .parse(listRes.body.result?.structuredContent);

        const found = list.recipes.find((r) => r.id === createdDish.recipe.id);
        expect(found).toBeDefined();
        expect(found?.recipe.ingredients).toHaveLength(12);
        expect(found?.recipe.steps).toHaveLength(4);
      } finally {
        harness.cleanup();
      }
    });

    test("1.2: Beyond 12 ingredients stress test: 13, 25, and 40 ingredients under strict 100-variable limit", async () => {
      const harness = createTestD1Harness({
        enforceVariableLimit: true,
        maxVariablesPerStatement: 100,
      });
      try {
        const { secret } = await harness.issueToken([...mcpToolNames]);

        for (const count of [13, 25, 40]) {
          const ingMasters = generateNIngredientsMaster(`Batch${count}`, count);
          const registeredIngs: Array<{
            id: string;
            ingredientId: string;
            name: string;
            amount: number;
            unit: string;
          }> = [];

          for (let i = 0; i < ingMasters.length; i++) {
            const master = ingMasters[i];
            const res = await harness.callMcp(secret, "create_ingredient", master);
            expect(res.response.status).toBe(200);
            const ingId = (res.body.result?.structuredContent as { ingredient: { id: string } })
              .ingredient.id;
            registeredIngs.push({
              id: `entry-${count}-${i + 1}`,
              ingredientId: ingId,
              name: master.name,
              amount: 10 + i,
              unit: master.baseUnit,
            });
          }

          const recipeJson = buildAdversarialRecipe(`Stress Recipe ${count} Ings`, registeredIngs);
          const payload = {
            name: `Stress Recipe ${count} Ings`,
            category: "main",
            servings: 2,
            coverImageId: null,
            notes: `Adversarial test with ${count} ingredients`,
            recipe: recipeJson,
          };

          const createRes = await harness.callMcp(secret, "create_recipe", payload);
          expect(createRes.response.status).toBe(200);
          expect(createRes.body.error).toBeUndefined();

          const createdId = (createRes.body.result?.structuredContent as { recipe: { id: string } })
            .recipe.id;
          const directCount = harness.sqlite
            .prepare("SELECT COUNT(*) as count FROM dish_ingredients WHERE dish_id = ?")
            .get(createdId) as { count: number };
          expect(directCount.count).toBe(count);
        }
      } finally {
        harness.cleanup();
      }
    });

    test("1.3: Empirical exact parameter limit boundary test: maxVariablesPerStatement 88 vs 87", async () => {
      // 8 rows * 11 columns = exactly 88 bound parameters per chunk.
      // With maxVariablesPerStatement = 88, a multi-chunk insert MUST pass.
      const harnessPass = createTestD1Harness({
        enforceVariableLimit: true,
        maxVariablesPerStatement: 88,
      });
      try {
        const { secret } = await harnessPass.issueToken([...mcpToolNames]);
        const ingMasters = generateNIngredientsMaster("Bound88", 16);
        const registeredIngs: Array<{
          id: string;
          ingredientId: string;
          name: string;
          amount: number;
          unit: string;
        }> = [];

        for (let i = 0; i < ingMasters.length; i++) {
          const res = await harnessPass.callMcp(secret, "create_ingredient", ingMasters[i]);
          const ingId = (res.body.result?.structuredContent as { ingredient: { id: string } })
            .ingredient.id;
          registeredIngs.push({
            id: `entry-boundary-${i + 1}`,
            ingredientId: ingId,
            name: ingMasters[i].name,
            amount: 10,
            unit: "g",
          });
        }

        const recipeJson = buildAdversarialRecipe("Boundary Test 88 Vars", registeredIngs);
        const payload = {
          name: "Boundary Test 88 Vars",
          category: "main",
          servings: 2,
          coverImageId: null,
          notes: "Testing at exactly 88 bound params",
          recipe: recipeJson,
        };

        const resPass = await harnessPass.callMcp(secret, "create_recipe", payload);
        expect(resPass.response.status).toBe(200);
        expect(resPass.body.error).toBeUndefined();
      } finally {
        harnessPass.cleanup();
      }

      // With maxVariablesPerStatement = 87, the 88-parameter statement MUST fail!
      const harnessFail = createTestD1Harness({
        enforceVariableLimit: true,
        maxVariablesPerStatement: 87,
      });
      try {
        const { secret } = await harnessFail.issueToken([...mcpToolNames]);
        const ingMasters = generateNIngredientsMaster("Bound87", 10);
        const registeredIngs: Array<{
          id: string;
          ingredientId: string;
          name: string;
          amount: number;
          unit: string;
        }> = [];

        for (let i = 0; i < ingMasters.length; i++) {
          const res = await harnessFail.callMcp(secret, "create_ingredient", ingMasters[i]);
          const ingId = (res.body.result?.structuredContent as { ingredient: { id: string } })
            .ingredient.id;
          registeredIngs.push({
            id: `entry-boundary-fail-${i + 1}`,
            ingredientId: ingId,
            name: ingMasters[i].name,
            amount: 10,
            unit: "g",
          });
        }

        const recipeJson = buildAdversarialRecipe("Boundary Test 87 Vars", registeredIngs);
        const payload = {
          name: "Boundary Test 87 Vars",
          category: "main",
          servings: 2,
          coverImageId: null,
          notes: "Testing at 87 limit to prove 88 is the actual chunk parameter count",
          recipe: recipeJson,
        };

        const resFail = await harnessFail.callMcp(secret, "create_recipe", payload);
        const isFailed = resFail.body.result?.isError === true || resFail.body.error !== undefined;
        expect(isFailed).toBe(true);

        const errorPayload = JSON.stringify(resFail.body);
        expect(errorPayload).toContain("D1_ERROR: too many SQL variables");
        expect(errorPayload).toContain("statement has 88 bound variables (limit is 87)");
      } finally {
        harnessFail.cleanup();
      }
    });

    test("1.4: dishRepository.update chunking test with 24 ingredients under 100-variable limit", async () => {
      const harness = createTestD1Harness({
        enforceVariableLimit: true,
        maxVariablesPerStatement: 100,
      });
      try {
        const dishRepo = createDishRepository(harness.db);
        const { secret } = await harness.issueToken([...mcpToolNames]);

        // Create 24 ingredients
        const ingMasters = generateNIngredientsMaster("Update24", 24);
        const registeredIngs: Array<{
          id: string;
          ingredientId: string;
          name: string;
          amount: number;
          unit: string;
        }> = [];

        for (let i = 0; i < ingMasters.length; i++) {
          const res = await harness.callMcp(secret, "create_ingredient", ingMasters[i]);
          const ingId = (res.body.result?.structuredContent as { ingredient: { id: string } })
            .ingredient.id;
          registeredIngs.push({
            id: `entry-update-${i + 1}`,
            ingredientId: ingId,
            name: ingMasters[i].name,
            amount: 10,
            unit: "g",
          });
        }

        // Initial create with 3 ingredients
        const initRecipe = buildAdversarialRecipe(
          "Update Test Initial",
          registeredIngs.slice(0, 3),
        );
        const created = await dishRepo.create({
          id: crypto.randomUUID(),
          name: "Update Test Initial",
          category: "main",
          servings: 2,
          recipe: initRecipe,
          totalNutrition: null,
          totalCostYen: null,
          coverImageId: null,
          notes: "Initial",
        });

        const countBefore = harness.sqlite
          .prepare("SELECT COUNT(*) as count FROM dish_ingredients WHERE dish_id = ?")
          .get(created.id) as { count: number };
        expect(countBefore.count).toBe(3);

        // Update to 24 ingredients (triggers chunked update batch)
        const updatedRecipe = buildAdversarialRecipe("Update Test 24 Ings", registeredIngs);
        const updated = await dishRepo.update(created.id, {
          name: "Update Test 24 Ings",
          recipe: updatedRecipe,
        });

        expect(updated).not.toBeNull();
        expect(updated?.recipe.ingredients).toHaveLength(24);

        const countAfter = harness.sqlite
          .prepare("SELECT COUNT(*) as count FROM dish_ingredients WHERE dish_id = ?")
          .get(created.id) as { count: number };
        expect(countAfter.count).toBe(24);
      } finally {
        harness.cleanup();
      }
    });

    test("1.5: mealLogRepository item chunking test with 20 items under 100-variable limit", async () => {
      const harness = createTestD1Harness({
        enforceVariableLimit: true,
        maxVariablesPerStatement: 100,
      });
      try {
        const mealRepo = createMealLogRepository(harness.db);

        const items = [];
        for (let i = 0; i < 20; i++) {
          items.push({
            id: crypto.randomUUID(),
            dishId: null,
            ingredientId: null,
            name: `Meal Item ${i + 1}`,
            servingsFactor: 1,
            priceYen: 100,
            nutrition: null,
            ingredientCostBreakdown: [],
            estimationSource: "manual" as const,
            sortOrder: i,
          });
        }

        const mealLog = {
          id: crypto.randomUUID(),
          eatenAt: new Date().toISOString(),
          mealTiming: "dinner" as const,
          sourceType: "self_cooked" as const,
          placeName: "Home",
          title: "Meal Log with 20 items",
          totalPriceYen: 2000,
          totalNutrition: null,
          rating: 5,
          memo: "Chunk test",
          inventiaConsumptionStatus: null,
          imageIds: [],
          items,
        };

        const created = await mealRepo.create(mealLog);
        expect(created.items).toHaveLength(20);

        const directItems = harness.sqlite
          .prepare("SELECT COUNT(*) as count FROM meal_log_items WHERE meal_log_id = ?")
          .get(mealLog.id) as { count: number };
        expect(directItems.count).toBe(20);
      } finally {
        harness.cleanup();
      }
    });
  });

  // =========================================================================
  // Challenge Area 2: Probe Residue Cleanup & Deletion Endpoints (R2)
  // =========================================================================
  describe("R2 Stress: Cascade Deletion, Probe Cleanup & Edge Cases", () => {
    test("2.1: Probe migration cleans legacy probes and leaves regular recipes untouched (idempotent)", async () => {
      const harness = createTestD1Harness();
      try {
        const { sqlite } = harness;
        const { secret } = await harness.issueToken([...mcpToolNames]);

        // Create a legitimate ingredient and dish via MCP first to guarantee full schema/DAG validity
        const cleanIngRes = await harness.callMcp(secret, "create_ingredient", {
          name: "clean-ingredient",
          baseDimension: "mass",
          baseUnit: "g",
          nutritionBasisAmount: 100,
          nutritionPerBasis: {
            caloriesKcal: 50,
            proteinG: 1,
            fatG: 0,
            carbohydrateG: 5,
            fiberG: 1,
            saltEquivalentG: 0,
            micronutrients: [],
          },
        });
        const cleanIngId = (
          cleanIngRes.body.result?.structuredContent as { ingredient: { id: string } }
        ).ingredient.id;

        const cleanDishPayload = {
          name: "clean-curry",
          category: "main",
          servings: 2,
          coverImageId: null,
          notes: "clean recipe",
          recipe: buildAdversarialRecipe("clean-curry", [
            {
              id: "clean-entry-1",
              ingredientId: cleanIngId,
              name: "clean-ingredient",
              amount: 100,
              unit: "g",
            },
          ]),
        };
        const cleanDishRes = await harness.callMcp(secret, "create_recipe", cleanDishPayload);
        expect(cleanDishRes.response.status).toBe(200);
        const cleanDishId = (
          cleanDishRes.body.result?.structuredContent as { recipe: { id: string } }
        ).recipe.id;

        // Now seed dirty probe records directly into SQLite
        sqlite.exec(`
          INSERT INTO ingredients (id, name, normalized_name, base_dimension, base_unit, nutrition_basis_amount, nutrition_json, created_at, updated_at)
          VALUES
            ('tmp-probe-id', 'tmp-probe', 'tmp-probe', 'mass', 'g', 100, '{}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

          INSERT INTO dishes (id, name, servings, recipe_json, created_at, updated_at)
          VALUES
            ('probe-d1', 'probe-gratin-onion', 2, '{"schemaVersion":"1.0","servings":2,"summary":"","equipment":[],"ingredientGroups":[],"ingredients":[],"steps":[],"globalCautions":[]}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
            ('probe-d2', 'probe-b-gratin-onion', 2, '{"schemaVersion":"1.0","servings":2,"summary":"","equipment":[],"ingredientGroups":[],"ingredients":[],"steps":[],"globalCautions":[]}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
            ('probe-d3', 'probe-d-gratin-onion', 2, '{"schemaVersion":"1.0","servings":2,"summary":"","equipment":[],"ingredientGroups":[],"ingredients":[],"steps":[],"globalCautions":[]}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

          INSERT INTO dish_ingredients (id, dish_id, ingredient_id, recipe_entry_id, amount, display_amount, role, sort_order)
          VALUES
            ('di-p1', 'probe-d1', '${cleanIngId}', 'ent-1', 10, '10g', 'main', 0),
            ('di-p2', 'probe-d2', 'tmp-probe-id', 'ent-2', 20, '20g', 'main', 0),
            ('di-p3', '${cleanDishId}', 'tmp-probe-id', 'ent-3', 30, '30g', 'main', 0);
        `);

        // Execute migration 0002_cleanup_probes.sql
        const migrationPath = resolve(process.cwd(), "app/migrations/0002_cleanup_probes.sql");
        const sql = readFileSync(migrationPath, "utf8");
        sqlite.exec(sql);

        // Verify probe dishes deleted
        const probeDishes = sqlite
          .prepare("SELECT name FROM dishes WHERE name LIKE 'probe-%'")
          .all();
        expect(probeDishes).toHaveLength(0);

        // Verify tmp-probe deleted
        const tmpProbeIng = sqlite
          .prepare("SELECT name FROM ingredients WHERE name = 'tmp-probe'")
          .all();
        expect(tmpProbeIng).toHaveLength(0);

        // Verify clean dish and clean ingredient still exist
        const cleanDish = sqlite
          .prepare("SELECT name FROM dishes WHERE name = 'clean-curry'")
          .all();
        expect(cleanDish).toHaveLength(1);
        const cleanIng = sqlite
          .prepare("SELECT name FROM ingredients WHERE name = 'clean-ingredient'")
          .all();
        expect(cleanIng).toHaveLength(1);

        // Verify zero orphaned dish_ingredients in DB
        const orphans = sqlite
          .prepare(`
          SELECT di.id FROM dish_ingredients di
          LEFT JOIN dishes d ON di.dish_id = d.id
          LEFT JOIN ingredients i ON di.ingredient_id = i.id
          WHERE d.id IS NULL OR i.id IS NULL
        `)
          .all();
        expect(orphans).toHaveLength(0);

        // Verify MCP tools list zero probe leftovers
        const listRecipes = await harness.callMcp(secret, "list_recipes", {});
        const recipeNames = (
          (listRecipes.body.result?.structuredContent as { recipes: { name: string }[] })
            ?.recipes ?? []
        ).map((r) => r.name);
        expect(recipeNames).not.toContain("probe-gratin-onion");
        expect(recipeNames).not.toContain("probe-b-gratin-onion");
        expect(recipeNames).not.toContain("probe-d-gratin-onion");
        expect(recipeNames).toContain("clean-curry");

        const listIngs = await harness.callMcp(secret, "list_ingredients", {});
        const ingNames = (
          (listIngs.body.result?.structuredContent as { items: { name: string }[] })?.items ?? []
        ).map((i) => i.name);
        expect(ingNames).not.toContain("tmp-probe");
        expect(ingNames).toContain("clean-ingredient");

        // Test Idempotency: execute migration a second time
        expect(() => sqlite.exec(sql)).not.toThrow();
      } finally {
        harness.cleanup();
      }
    });

    test("2.2: Foreign keys enabled: delete_recipe cascades dish_ingredients and leaves ingredients intact", async () => {
      const harness = createTestD1Harness();
      try {
        harness.sqlite.exec("PRAGMA foreign_keys = ON;");
        const { secret } = await harness.issueToken([...mcpToolNames]);

        // Register 12 master ingredients
        const idMap: Record<string, string> = {};
        for (const master of twelveIngredientsMaster) {
          const res = await harness.callMcp(secret, "create_ingredient", {
            name: master.name,
            baseDimension: master.baseDimension,
            baseUnit: master.baseUnit,
            nutritionBasisAmount: master.nutritionBasisAmount,
            nutritionPerBasis: master.nutritionPerBasis,
          });
          const id = (res.body.result?.structuredContent as { ingredient: { id: string } })
            .ingredient.id;
          idMap[master.name] = id;
        }

        // Register 12-ingredient recipe
        const payload = createTwelveIngredientRecipePayload(idMap);
        const createDishRes = await harness.callMcp(secret, "create_recipe", payload);
        const dishId = (createDishRes.body.result?.structuredContent as { recipe: { id: string } })
          .recipe.id;

        expect(
          harness.sqlite
            .prepare("SELECT COUNT(*) as c FROM dish_ingredients WHERE dish_id = ?")
            .get(dishId),
        ).toEqual({ c: 12 });

        // Delete recipe via MCP
        const delRes = await harness.callMcp(secret, "delete_recipe", { id: dishId });
        expect(delRes.response.status).toBe(200);
        const delBody = delRes.body.result?.structuredContent as {
          success: boolean;
          deletedId: string;
        };
        expect(delBody.success).toBe(true);
        expect(delBody.deletedId).toBe(dishId);

        // Verify dish deleted
        expect(
          harness.sqlite.prepare("SELECT COUNT(*) as c FROM dishes WHERE id = ?").get(dishId),
        ).toEqual({ c: 0 });
        // Verify dish_ingredients cascade deleted
        expect(
          harness.sqlite
            .prepare("SELECT COUNT(*) as c FROM dish_ingredients WHERE dish_id = ?")
            .get(dishId),
        ).toEqual({ c: 0 });
        // Verify ingredients still exist
        expect(harness.sqlite.prepare("SELECT COUNT(*) as c FROM ingredients").get()).toEqual({
          c: 12,
        });
      } finally {
        harness.cleanup();
      }
    });

    test("2.3: Deleting non-existent IDs returns graceful false / 404", async () => {
      const harness = createTestD1Harness();
      try {
        const { secret } = await harness.issueToken([...mcpToolNames]);
        const nonExistentId = "00000000-0000-0000-0000-000000000000";

        // MCP delete_recipe
        const delRecipeRes = await harness.callMcp(secret, "delete_recipe", { id: nonExistentId });
        expect(delRecipeRes.response.status).toBe(200);
        const recipeBody = delRecipeRes.body.result?.structuredContent as {
          success: boolean;
          deletedId: string;
        };
        expect(recipeBody.success).toBe(false);
        expect(recipeBody.deletedId).toBe(nonExistentId);

        // MCP delete_ingredient
        const delIngRes = await harness.callMcp(secret, "delete_ingredient", { id: nonExistentId });
        expect(delIngRes.response.status).toBe(200);
        const ingBody = delIngRes.body.result?.structuredContent as {
          success: boolean;
          deletedId: string;
        };
        expect(ingBody.success).toBe(false);
        expect(ingBody.deletedId).toBe(nonExistentId);

        // REST DELETE /api/ingredients/:id
        const restDelRes = await api.fetch(
          new Request(`http://localhost/api/ingredients/${nonExistentId}`, { method: "DELETE" }),
          harness.env,
        );
        expect(restDelRes.status).toBe(404);
        const restBody = (await restDelRes.json()) as { error: string };
        expect(restBody.error).toBe("Ingredient not found.");
      } finally {
        harness.cleanup();
      }
    });

    test("2.4: Deleting ingredient with active dish reference triggers RESTRICT protection without DB corruption", async () => {
      const harness = createTestD1Harness();
      try {
        harness.sqlite.exec("PRAGMA foreign_keys = ON;");
        const { secret } = await harness.issueToken([...mcpToolNames]);

        // 1. Create ingredient
        const createIngRes = await harness.callMcp(secret, "create_ingredient", {
          name: "Active Referenced Ing",
          baseDimension: "mass",
          baseUnit: "g",
          nutritionBasisAmount: 100,
          nutritionPerBasis: {
            caloriesKcal: 50,
            proteinG: 1,
            fatG: 0,
            carbohydrateG: 5,
            fiberG: 1,
            saltEquivalentG: 0,
            micronutrients: [],
          },
        });
        const ingId = (
          createIngRes.body.result?.structuredContent as { ingredient: { id: string } }
        ).ingredient.id;

        // 2. Create dish referencing it
        const dishPayload = {
          name: "Dish with Active Ing",
          category: "main",
          servings: 1,
          coverImageId: null,
          notes: "",
          recipe: buildAdversarialRecipe("Dish with Active Ing", [
            {
              id: "entry-active-1",
              ingredientId: ingId,
              name: "Active Referenced Ing",
              amount: 50,
              unit: "g",
            },
          ]),
        };
        const createDishRes = await harness.callMcp(secret, "create_recipe", dishPayload);
        const dishId = (createDishRes.body.result?.structuredContent as { recipe: { id: string } })
          .recipe.id;

        // 3. Attempt REST DELETE /api/ingredients/:id
        const restDelRes = await api.fetch(
          new Request(`http://localhost/api/ingredients/${ingId}`, { method: "DELETE" }),
          harness.env,
        );
        // Foreign key failure returns >= 400
        expect(restDelRes.status).toBeGreaterThanOrEqual(400);

        // Verify ingredient is still in DB
        expect(
          harness.sqlite.prepare("SELECT COUNT(*) as c FROM ingredients WHERE id = ?").get(ingId),
        ).toEqual({ c: 1 });

        // 4. Attempt MCP delete_ingredient
        const mcpDelRes = await harness.callMcp(secret, "delete_ingredient", { id: ingId });
        const isMcpFailed =
          mcpDelRes.body.result?.isError === true || mcpDelRes.body.error !== undefined;
        expect(isMcpFailed).toBe(true);

        // Verify DB integrity
        expect(
          harness.sqlite.prepare("SELECT COUNT(*) as c FROM ingredients WHERE id = ?").get(ingId),
        ).toEqual({ c: 1 });
        expect(
          harness.sqlite.prepare("SELECT COUNT(*) as c FROM dishes WHERE id = ?").get(dishId),
        ).toEqual({ c: 1 });

        // 5. Delete dish first, then delete ingredient
        const delDishRes = await harness.callMcp(secret, "delete_recipe", { id: dishId });
        expect((delDishRes.body.result?.structuredContent as { success: boolean }).success).toBe(
          true,
        );

        const delIngRes = await harness.callMcp(secret, "delete_ingredient", { id: ingId });
        expect((delIngRes.body.result?.structuredContent as { success: boolean }).success).toBe(
          true,
        );

        expect(
          harness.sqlite.prepare("SELECT COUNT(*) as c FROM ingredients WHERE id = ?").get(ingId),
        ).toEqual({ c: 0 });
      } finally {
        harness.cleanup();
      }
    });

    test("2.5: Recipe deletion when referenced by meal log sets meal_log_items.dish_id to NULL (ON DELETE SET NULL)", async () => {
      const harness = createTestD1Harness();
      try {
        harness.sqlite.exec("PRAGMA foreign_keys = ON;");
        const { secret } = await harness.issueToken([...mcpToolNames]);

        // 1. Create ingredient
        const ingRes = await harness.callMcp(secret, "create_ingredient", {
          name: "Meal Dish Ing",
          baseDimension: "mass",
          baseUnit: "g",
          nutritionBasisAmount: 100,
          nutritionPerBasis: {
            caloriesKcal: 50,
            proteinG: 1,
            fatG: 0,
            carbohydrateG: 5,
            fiberG: 1,
            saltEquivalentG: 0,
            micronutrients: [],
          },
        });
        const ingId = (ingRes.body.result?.structuredContent as { ingredient: { id: string } })
          .ingredient.id;

        // 2. Create dish
        const dishRes = await harness.callMcp(secret, "create_recipe", {
          name: "Meal Dish",
          category: "main",
          servings: 1,
          coverImageId: null,
          notes: "",
          recipe: buildAdversarialRecipe("Meal Dish", [
            { id: "e1", ingredientId: ingId, name: "Meal Dish Ing", amount: 50, unit: "g" },
          ]),
        });
        const dishId = (dishRes.body.result?.structuredContent as { recipe: { id: string } }).recipe
          .id;

        // 3. Create meal log referencing dish
        const mealRepo = createMealLogRepository(harness.db);
        const mealLogId = crypto.randomUUID();
        const itemId = crypto.randomUUID();
        await mealRepo.create({
          id: mealLogId,
          eatenAt: new Date().toISOString(),
          mealTiming: "lunch",
          sourceType: "self_cooked",
          placeName: "Home",
          title: "Lunch with Meal Dish",
          totalPriceYen: 500,
          totalNutrition: null,
          rating: 4,
          memo: "",
          inventiaConsumptionStatus: null,
          imageIds: [],
          items: [
            {
              id: itemId,
              dishId: dishId,
              ingredientId: null,
              name: "Meal Dish item",
              servingsFactor: 1,
              priceYen: 500,
              nutrition: null,
              ingredientCostBreakdown: [],
              estimationSource: "manual",
              sortOrder: 0,
            },
          ],
        });

        // Verify dishId is linked
        const rowBefore = harness.sqlite
          .prepare("SELECT dish_id FROM meal_log_items WHERE id = ?")
          .get(itemId) as { dish_id: string | null };
        expect(rowBefore.dish_id).toBe(dishId);

        // 4. Delete the dish via MCP delete_recipe
        const delRes = await harness.callMcp(secret, "delete_recipe", { id: dishId });
        expect((delRes.body.result?.structuredContent as { success: boolean }).success).toBe(true);

        // 5. Verify dish is deleted
        expect(
          harness.sqlite.prepare("SELECT COUNT(*) as c FROM dishes WHERE id = ?").get(dishId),
        ).toEqual({ c: 0 });

        // 6. Verify meal_log_items.dish_id is now NULL (set null constraint)
        const rowAfter = harness.sqlite
          .prepare("SELECT dish_id FROM meal_log_items WHERE id = ?")
          .get(itemId) as { dish_id: string | null };
        expect(rowAfter.dish_id).toBeNull();

        // 7. Verify meal log still exists intact
        const mealRow = harness.sqlite
          .prepare("SELECT COUNT(*) as c FROM meal_logs WHERE id = ?")
          .get(mealLogId) as { c: number };
        expect(mealRow.c).toBe(1);
      } finally {
        harness.cleanup();
      }
    });
  });
});
