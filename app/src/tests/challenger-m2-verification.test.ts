import { describe, expect, test } from "vite-plus/test";
import { z } from "zod";

import { api } from "../api";
import { mcpToolNames } from "../domain/mcp";
import {
  createTwelveIngredientRecipePayload,
  twelveIngredientsMaster,
} from "./fixtures/recipe-fixtures";
import { createTestD1Harness } from "./test-harness";

describe("Empirical Challenger M2: MCP & REST Deletion Adversarial Suite", () => {
  // =========================================================================
  // Challenge 1: delete_recipe with 12 ingredients cleans dish & dish_ingredients
  // =========================================================================
  test("MCP delete_recipe with 12-ingredient dish cleanly deletes dish and all dish_ingredients", async () => {
    const harness = createTestD1Harness({ enforceVariableLimit: true });
    try {
      // Enforce foreign key constraints like production SQLite/D1
      harness.sqlite.exec("PRAGMA foreign_keys = ON;");

      const { secret } = await harness.issueToken([...mcpToolNames]);

      // 1. Register 12 ingredients
      const ingredientIdMap: Record<string, string> = {};
      for (const master of twelveIngredientsMaster) {
        const created = await harness.callMcp(secret, "create_ingredient", {
          name: master.name,
          baseDimension: master.baseDimension,
          baseUnit: master.baseUnit,
          nutritionBasisAmount: master.nutritionBasisAmount,
          nutritionPerBasis: master.nutritionPerBasis,
        });
        expect(created.response.status).toBe(200);
        const result = z
          .object({ ingredient: z.object({ id: z.string() }) })
          .parse(created.body.result?.structuredContent);
        ingredientIdMap[master.name] = result.ingredient.id;
      }
      expect(Object.keys(ingredientIdMap)).toHaveLength(12);

      // 2. Register 12-ingredient recipe
      const recipeArgs = createTwelveIngredientRecipePayload(ingredientIdMap);
      const createRecipeRes = await harness.callMcp(secret, "create_recipe", recipeArgs);
      expect(createRecipeRes.response.status).toBe(200);
      const recipeResult = z
        .object({
          recipe: z.object({
            id: z.string(),
            name: z.string(),
          }),
        })
        .parse(createRecipeRes.body.result?.structuredContent);
      const recipeId = recipeResult.recipe.id;

      // 3. Directly inspect SQLite database state before deletion
      const dishCountBefore = harness.sqlite
        .prepare("SELECT COUNT(*) as count FROM dishes WHERE id = ?")
        .get(recipeId) as { count: number };
      expect(dishCountBefore.count).toBe(1);

      const dishIngredientsCountBefore = harness.sqlite
        .prepare("SELECT COUNT(*) as count FROM dish_ingredients WHERE dish_id = ?")
        .get(recipeId) as { count: number };
      expect(dishIngredientsCountBefore.count).toBe(12);

      // 4. Perform MCP delete_recipe
      const deleteRes = await harness.callMcp(secret, "delete_recipe", { id: recipeId });
      expect(deleteRes.response.status).toBe(200);
      expect(deleteRes.body.error).toBeUndefined();
      const deleteResult = z
        .object({ success: z.boolean(), deletedId: z.string() })
        .parse(deleteRes.body.result?.structuredContent);
      expect(deleteResult.success).toBe(true);
      expect(deleteResult.deletedId).toBe(recipeId);

      // 5. Directly inspect SQLite database state after deletion
      // Assert dish is cleanly deleted
      const dishCountAfter = harness.sqlite
        .prepare("SELECT COUNT(*) as count FROM dishes WHERE id = ?")
        .get(recipeId) as { count: number };
      expect(dishCountAfter.count).toBe(0);

      // Assert all 12 dish_ingredients rows are cleanly deleted (no orphans)
      const dishIngredientsCountAfter = harness.sqlite
        .prepare("SELECT COUNT(*) as count FROM dish_ingredients WHERE dish_id = ?")
        .get(recipeId) as { count: number };
      expect(dishIngredientsCountAfter.count).toBe(0);

      // Assert ingredients themselves still exist intact
      const totalIngredientsCount = harness.sqlite
        .prepare("SELECT COUNT(*) as count FROM ingredients")
        .get() as { count: number };
      expect(totalIngredientsCount.count).toBe(12);

      // 6. Verify list_recipes via MCP returns empty / excludes deleted recipe
      const listRes = await harness.callMcp(secret, "list_recipes", {});
      const list = z
        .object({ recipes: z.array(z.object({ id: z.string() })) })
        .parse(listRes.body.result?.structuredContent);
      expect(list.recipes.some((r) => r.id === recipeId)).toBe(false);
    } finally {
      harness.cleanup();
    }
  });

  test("Stress Test: MCP delete_recipe with a large 50-ingredient dish cleanly deletes all 50 dish_ingredients", async () => {
    const harness = createTestD1Harness({ enforceVariableLimit: true });
    try {
      harness.sqlite.exec("PRAGMA foreign_keys = ON;");
      const { secret } = await harness.issueToken([...mcpToolNames]);

      // Create 50 ingredients
      const ingredientIds: string[] = [];
      for (let i = 1; i <= 50; i++) {
        const id = `stress-ing-${i}`;
        harness.sqlite.exec(`
          INSERT INTO ingredients (
            id, name, normalized_name, base_dimension, base_unit,
            nutrition_basis_amount, nutrition_json, created_at, updated_at
          ) VALUES (
            '${id}', 'Stress Ingredient ${i}', 'stress ingredient ${i}', 'mass', 'g',
            100, '{"caloriesKcal":10,"proteinG":1,"fatG":0,"carbohydrateG":2,"fiberG":0,"saltEquivalentG":0,"micronutrients":[]}',
            CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          );
        `);
        ingredientIds.push(id);
      }
      expect(ingredientIds).toHaveLength(50);

      // Construct a valid recipe with 50 ingredients
      const recipeIngredients = ingredientIds.map((ingId, idx) => ({
        id: `entry-${idx + 1}`,
        ingredientId: ingId,
        name: `Stress Ingredient ${idx + 1}`,
        amount: 10,
        unit: "g",
        displayAmount: "10g",
        role: "main" as const,
        groupId: null,
        prepNote: null,
      }));

      const recipePayload = {
        name: "Massive 50-Ingredient Stew",
        category: "main",
        servings: 10,
        recipe: {
          schemaVersion: "1.0",
          servings: 10,
          summary: "Stress test dish with 50 ingredients",
          equipment: [],
          ingredientGroups: [],
          ingredients: recipeIngredients,
          steps: [
            {
              id: "step-massive-1",
              stepNumber: 1,
              phase: "cook",
              title: "Boil everything",
              instruction: "Simmer all 50 ingredients together",
              executionMode: "active",
              timing: {
                activeDurationSec: 600,
                passiveDurationSec: 0,
                minTotalDurationSec: null,
                maxTotalDurationSec: null,
                scalingMode: "fixed",
                timerLabel: null,
              },
              dependsOnStepIds: [],
              resourceTags: [],
              heatLevel: "low",
              targetTempCelsius: 100,
              inputs: recipeIngredients.map((ing) => ({
                type: "ingredient" as const,
                ingredientEntryId: ing.id,
                amountRatio: 1,
                amountText: null,
              })),
              outputs: [{ id: "out-massive-1", label: "Cooked Stew" }],
              completionCue: null,
              cautions: [],
            },
          ],
          globalCautions: [],
        },
        coverImageId: null,
        notes: "Stress test dish",
      };

      // Create recipe through MCP (tests chunked batch insertion as well)
      const createRes = await harness.callMcp(secret, "create_recipe", recipePayload);
      expect(createRes.response.status).toBe(200);
      const createdRecipe = z
        .object({ recipe: z.object({ id: z.string() }) })
        .parse(createRes.body.result?.structuredContent);
      const largeRecipeId = createdRecipe.recipe.id;

      // Verify all 50 join records are in dish_ingredients
      const joinsBefore = harness.sqlite
        .prepare("SELECT COUNT(*) as count FROM dish_ingredients WHERE dish_id = ?")
        .get(largeRecipeId) as { count: number };
      expect(joinsBefore.count).toBe(50);

      // Now call delete_recipe
      const delRes = await harness.callMcp(secret, "delete_recipe", { id: largeRecipeId });
      expect(delRes.response.status).toBe(200);
      const delParsed = z
        .object({ success: z.boolean(), deletedId: z.string() })
        .parse(delRes.body.result?.structuredContent);
      expect(delParsed.success).toBe(true);
      expect(delParsed.deletedId).toBe(largeRecipeId);

      // Verify dish is deleted
      const dishAfter = harness.sqlite
        .prepare("SELECT COUNT(*) as count FROM dishes WHERE id = ?")
        .get(largeRecipeId) as { count: number };
      expect(dishAfter.count).toBe(0);

      // Verify all 50 join records are cleanly purged
      const joinsAfter = harness.sqlite
        .prepare("SELECT COUNT(*) as count FROM dish_ingredients WHERE dish_id = ?")
        .get(largeRecipeId) as { count: number };
      expect(joinsAfter.count).toBe(0);

      // Verify all 50 ingredient masters remain intact
      const ingsRemain = harness.sqlite
        .prepare("SELECT COUNT(*) as count FROM ingredients WHERE id LIKE 'stress-ing-%'")
        .get() as { count: number };
      expect(ingsRemain.count).toBe(50);
    } finally {
      harness.cleanup();
    }
  });

  // =========================================================================
  // Challenge 2: delete_ingredient when referenced by active dish (RESTRICT)
  // =========================================================================
  test("MCP delete_ingredient when referenced by active dish respects RESTRICT constraint and fails cleanly", async () => {
    const harness = createTestD1Harness();
    try {
      // Enforce foreign key constraints
      harness.sqlite.exec("PRAGMA foreign_keys = ON;");

      const { secret } = await harness.issueToken([...mcpToolNames]);

      // 1. Create a single ingredient
      const createIngRes = await harness.callMcp(secret, "create_ingredient", {
        name: "Restricted Onion",
        baseDimension: "mass",
        baseUnit: "g",
        nutritionBasisAmount: 100,
        nutritionPerBasis: {
          caloriesKcal: 40,
          proteinG: 1,
          fatG: 0,
          carbohydrateG: 9,
          fiberG: 1,
          saltEquivalentG: 0,
          micronutrients: [],
        },
      });
      const ingResult = z
        .object({ ingredient: z.object({ id: z.string() }) })
        .parse(createIngRes.body.result?.structuredContent);
      const ingredientId = ingResult.ingredient.id;

      // 2. Create an active dish referencing this ingredient
      const createDishRes = await harness.callMcp(secret, "create_recipe", {
        name: "Active Dish with Onion",
        category: "main",
        servings: 2,
        recipe: {
          schemaVersion: "1.0",
          servings: 2,
          summary: "Dish referencing onion",
          equipment: [],
          ingredientGroups: [],
          ingredients: [
            {
              id: "entry-onion",
              ingredientId,
              name: "Restricted Onion",
              amount: 100,
              unit: "g",
              displayAmount: "100g",
              role: "main",
              groupId: null,
              prepNote: null,
            },
          ],
          steps: [
            {
              id: "step-1",
              stepNumber: 1,
              phase: "prep",
              title: "Slice",
              instruction: "Slice onion",
              executionMode: "active",
              timing: {
                activeDurationSec: 60,
                passiveDurationSec: 0,
                minTotalDurationSec: null,
                maxTotalDurationSec: null,
                scalingMode: "fixed",
                timerLabel: null,
              },
              dependsOnStepIds: [],
              resourceTags: [],
              heatLevel: "none",
              targetTempCelsius: null,
              inputs: [
                {
                  type: "ingredient",
                  ingredientEntryId: "entry-onion",
                  amountRatio: 1,
                  amountText: null,
                },
              ],
              outputs: [{ id: "out-1", label: "Sliced" }],
              completionCue: null,
              cautions: [],
            },
          ],
          globalCautions: [],
        },
        coverImageId: null,
        notes: null,
      });
      expect(createDishRes.response.status).toBe(200);
      const dishResult = z
        .object({ recipe: z.object({ id: z.string() }) })
        .parse(createDishRes.body.result?.structuredContent);
      const dishId = dishResult.recipe.id;

      // 3. Attempt to delete ingredient while actively referenced by the dish
      // With PRAGMA foreign_keys = ON, SQLite raises SQLITE_CONSTRAINT foreign key restriction.
      const delIngRes = await harness.callMcp(secret, "delete_ingredient", { id: ingredientId });

      // In MCP SDK, when a tool handler throws, either it returns isError: true or a JSON-RPC error.
      // Assert that deletion failed or returned error, and ingredient was NOT deleted from DB!
      const isFailed =
        delIngRes.body.result?.isError === true || delIngRes.body.error !== undefined;
      expect(isFailed).toBe(true);

      // Verify ingredient still exists in database
      const ingInDb = harness.sqlite
        .prepare("SELECT COUNT(*) as count FROM ingredients WHERE id = ?")
        .get(ingredientId) as { count: number };
      expect(ingInDb.count).toBe(1);

      // 4. Now delete the active dish first
      const delDishRes = await harness.callMcp(secret, "delete_recipe", { id: dishId });
      expect(delDishRes.response.status).toBe(200);
      const delDishResult = z
        .object({ success: z.boolean(), deletedId: z.string() })
        .parse(delDishRes.body.result?.structuredContent);
      expect(delDishResult.success).toBe(true);

      // 5. Now delete the ingredient (no longer referenced by any dish) -> should succeed!
      const retryDelIngRes = await harness.callMcp(secret, "delete_ingredient", {
        id: ingredientId,
      });
      expect(retryDelIngRes.response.status).toBe(200);
      expect(retryDelIngRes.body.error).toBeUndefined();
      const retryDelResult = z
        .object({ success: z.boolean(), deletedId: z.string() })
        .parse(retryDelIngRes.body.result?.structuredContent);
      expect(retryDelResult.success).toBe(true);
      expect(retryDelResult.deletedId).toBe(ingredientId);

      // Assert ingredient is now deleted from database
      const ingAfterClean = harness.sqlite
        .prepare("SELECT COUNT(*) as count FROM ingredients WHERE id = ?")
        .get(ingredientId) as { count: number };
      expect(ingAfterClean.count).toBe(0);
    } finally {
      harness.cleanup();
    }
  });

  test("REST DELETE /api/ingredients/:id fails or handles active dish references gracefully without corrupting database", async () => {
    const harness = createTestD1Harness();
    try {
      harness.sqlite.exec("PRAGMA foreign_keys = ON;");

      // 1. Create ingredient via REST
      const createRes = await api.fetch(
        new Request("http://localhost/api/ingredients", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: "REST Active Ing",
            baseDimension: "mass",
            baseUnit: "g",
            nutritionBasisAmount: 100,
            nutritionPerBasis: {
              caloriesKcal: 50,
              proteinG: 1,
              fatG: 0,
              carbohydrateG: 10,
              fiberG: 1,
              saltEquivalentG: 0,
              micronutrients: [],
            },
          }),
        }),
        harness.env,
      );
      expect(createRes.status).toBe(201);
      const created = (await createRes.json()) as { id: string };

      // 2. Insert a dish referencing this ingredient
      harness.sqlite.exec(`
        INSERT INTO dishes (id, name, servings, recipe_json, created_at, updated_at)
        VALUES ('dish-rest-ref', 'Dish Ref', 1, '{"schemaVersion":"1.0","servings":1,"summary":"","equipment":[],"ingredientGroups":[],"ingredients":[],"steps":[],"globalCautions":[]}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

        INSERT INTO dish_ingredients (id, dish_id, ingredient_id, recipe_entry_id, amount, display_amount, role, sort_order)
        VALUES ('join-rest-ref', 'dish-rest-ref', '${created.id}', 'entry-rest', 50, '50g', 'main', 0);
      `);

      // 3. Attempt REST DELETE
      const deleteRes = await api.fetch(
        new Request(`http://localhost/api/ingredients/${created.id}`, { method: "DELETE" }),
        harness.env,
      );
      // Because of RESTRICT, SQLite throws foreign key constraint failed.
      // In Hono, unhandled DB errors return status >= 400 (500 or error response).
      expect(deleteRes.status).toBeGreaterThanOrEqual(400);

      // Verify the ingredient was NOT deleted
      const checkRow = harness.sqlite
        .prepare("SELECT COUNT(*) as count FROM ingredients WHERE id = ?")
        .get(created.id) as { count: number };
      expect(checkRow.count).toBe(1);
    } finally {
      harness.cleanup();
    }
  });

  // =========================================================================
  // Challenge 3: MCP tool aliases (recipeId / ingredientId vs id) & schema validation
  // =========================================================================
  describe("MCP tool parameter aliases and strict schema validation", () => {
    test("delete_recipe accepts 'recipeId', 'id', or both, but rejects empty or unknown fields", async () => {
      const harness = createTestD1Harness();
      try {
        const { secret } = await harness.issueToken([...mcpToolNames]);

        const validDummyRecipeJson = JSON.stringify({
          schemaVersion: "1.0",
          servings: 1,
          summary: "Dummy summary",
          equipment: [],
          ingredientGroups: [],
          ingredients: [
            {
              id: "entry-dummy",
              ingredientId: "dummy-ing-id",
              name: "Dummy Ing",
              amount: 10,
              unit: "g",
              displayAmount: "10g",
              role: "main",
              groupId: null,
              prepNote: null,
            },
          ],
          steps: [
            {
              id: "step-dummy",
              stepNumber: 1,
              phase: "prep",
              title: "Dummy Step",
              instruction: "Dummy instruction",
              executionMode: "active",
              timing: {
                activeDurationSec: 10,
                passiveDurationSec: 0,
                minTotalDurationSec: null,
                maxTotalDurationSec: null,
                scalingMode: "fixed",
                timerLabel: null,
              },
              dependsOnStepIds: [],
              resourceTags: [],
              heatLevel: "none",
              targetTempCelsius: null,
              inputs: [
                {
                  type: "ingredient",
                  ingredientEntryId: "entry-dummy",
                  amountRatio: 1,
                  amountText: null,
                },
              ],
              outputs: [{ id: "out-dummy", label: "Out" }],
              completionCue: null,
              cautions: [],
            },
          ],
          globalCautions: [],
        });

        // Helper to insert dummy recipe directly for fast testing
        const insertDummyRecipe = (id: string) => {
          harness.sqlite.exec(`
            INSERT INTO dishes (id, name, servings, recipe_json, created_at, updated_at)
            VALUES ('${id}', 'Dummy Recipe ${id}', 1, '${validDummyRecipeJson}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
          `);
        };

        // 1. Test with 'id'
        insertDummyRecipe("r-1");
        const resId = await harness.callMcp(secret, "delete_recipe", { id: "r-1" });
        expect(resId.response.status).toBe(200);
        const parseId = z
          .object({ success: z.boolean(), deletedId: z.string() })
          .parse(resId.body.result?.structuredContent);
        expect(parseId.success).toBe(true);
        expect(parseId.deletedId).toBe("r-1");

        // 2. Test with 'recipeId' alias
        insertDummyRecipe("r-2");
        const resAlias = await harness.callMcp(secret, "delete_recipe", { recipeId: "r-2" });
        expect(resAlias.response.status).toBe(200);
        const parseAlias = z
          .object({ success: z.boolean(), deletedId: z.string() })
          .parse(resAlias.body.result?.structuredContent);
        expect(parseAlias.success).toBe(true);
        expect(parseAlias.deletedId).toBe("r-2");

        // 3. Test with both 'id' and 'recipeId' provided (id takes precedence)
        insertDummyRecipe("r-3");
        const resBoth = await harness.callMcp(secret, "delete_recipe", {
          id: "r-3",
          recipeId: "r-3",
        });
        expect(resBoth.response.status).toBe(200);
        const parseBoth = z
          .object({ success: z.boolean(), deletedId: z.string() })
          .parse(resBoth.body.result?.structuredContent);
        expect(parseBoth.success).toBe(true);
        expect(parseBoth.deletedId).toBe("r-3");

        // 4. Reject empty object
        const resEmpty = await harness.callMcp(secret, "delete_recipe", {});
        expect(resEmpty.body.result?.isError).toBe(true);

        // 5. Reject empty string id
        const resEmptyStr = await harness.callMcp(secret, "delete_recipe", { id: "" });
        expect(resEmptyStr.body.result?.isError).toBe(true);

        // 6. Reject unknown / extra fields due to .strict()
        const resExtra = await harness.callMcp(secret, "delete_recipe", {
          id: "r-4",
          unexpectedProp: "fail",
        });
        expect(resExtra.body.result?.isError).toBe(true);
      } finally {
        harness.cleanup();
      }
    });

    test("delete_ingredient accepts 'ingredientId', 'id', or both, but rejects empty or unknown fields", async () => {
      const harness = createTestD1Harness();
      try {
        const { secret } = await harness.issueToken([...mcpToolNames]);

        const insertDummyIngredient = (id: string, name: string) => {
          harness.sqlite.exec(`
            INSERT INTO ingredients (
              id, name, normalized_name, base_dimension, base_unit,
              nutrition_basis_amount, nutrition_json, created_at, updated_at
            ) VALUES (
              '${id}', '${name}', '${name.toLowerCase()}', 'mass', 'g',
              100, '{"caloriesKcal":100,"proteinG":1,"fatG":0,"carbohydrateG":20,"fiberG":0,"saltEquivalentG":0,"micronutrients":[]}',
              CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
            );
          `);
        };

        // 1. Test with 'id'
        insertDummyIngredient("i-1", "Ing 1");
        const resId = await harness.callMcp(secret, "delete_ingredient", { id: "i-1" });
        expect(resId.response.status).toBe(200);
        const parseId = z
          .object({ success: z.boolean(), deletedId: z.string() })
          .parse(resId.body.result?.structuredContent);
        expect(parseId.success).toBe(true);
        expect(parseId.deletedId).toBe("i-1");

        // 2. Test with 'ingredientId' alias
        insertDummyIngredient("i-2", "Ing 2");
        const resAlias = await harness.callMcp(secret, "delete_ingredient", {
          ingredientId: "i-2",
        });
        expect(resAlias.response.status).toBe(200);
        const parseAlias = z
          .object({ success: z.boolean(), deletedId: z.string() })
          .parse(resAlias.body.result?.structuredContent);
        expect(parseAlias.success).toBe(true);
        expect(parseAlias.deletedId).toBe("i-2");

        // 3. Test with both 'id' and 'ingredientId'
        insertDummyIngredient("i-3", "Ing 3");
        const resBoth = await harness.callMcp(secret, "delete_ingredient", {
          id: "i-3",
          ingredientId: "i-3",
        });
        expect(resBoth.response.status).toBe(200);
        const parseBoth = z
          .object({ success: z.boolean(), deletedId: z.string() })
          .parse(resBoth.body.result?.structuredContent);
        expect(parseBoth.success).toBe(true);
        expect(parseBoth.deletedId).toBe("i-3");

        // 4. Reject empty object
        const resEmpty = await harness.callMcp(secret, "delete_ingredient", {});
        expect(resEmpty.body.result?.isError).toBe(true);

        // 5. Reject empty string id
        const resEmptyStr = await harness.callMcp(secret, "delete_ingredient", { id: "" });
        expect(resEmptyStr.body.result?.isError).toBe(true);

        // 6. Reject unknown / extra fields due to .strict()
        const resExtra = await harness.callMcp(secret, "delete_ingredient", {
          id: "i-4",
          spuriousField: 999,
        });
        expect(resExtra.body.result?.isError).toBe(true);
      } finally {
        harness.cleanup();
      }
    });
  });

  // =========================================================================
  // Challenge 4 & 5: REST DELETE /api/ingredients/:id status codes and idempotence
  // =========================================================================
  describe("REST DELETE /api/ingredients/:id edge cases", () => {
    test("REST DELETE with non-existent UUID asserts 404 response with error message", async () => {
      const harness = createTestD1Harness();
      try {
        const nonExistentUuid = "00000000-0000-4000-8000-000000000000";
        const deleteRes = await api.fetch(
          new Request(`http://localhost/api/ingredients/${nonExistentUuid}`, {
            method: "DELETE",
          }),
          harness.env,
        );
        expect(deleteRes.status).toBe(404);
        const body = (await deleteRes.json()) as { error: string };
        expect(body.error).toBe("Ingredient not found.");
      } finally {
        harness.cleanup();
      }
    });

    test("REST DELETE with existing ingredient asserts 204 No Content, and subsequent DELETE returns 404", async () => {
      const harness = createTestD1Harness();
      try {
        // 1. Create ingredient
        const createRes = await api.fetch(
          new Request("http://localhost/api/ingredients", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: "Existing For Two Step Deletion",
              baseDimension: "mass",
              baseUnit: "g",
              nutritionBasisAmount: 100,
              nutritionPerBasis: {
                caloriesKcal: 60,
                proteinG: 2,
                fatG: 1,
                carbohydrateG: 12,
                fiberG: 1,
                saltEquivalentG: 0,
                micronutrients: [],
              },
            }),
          }),
          harness.env,
        );
        expect(createRes.status).toBe(201);
        const created = (await createRes.json()) as { id: string };
        expect(created.id).toBeDefined();

        // 2. First DELETE call -> 204 No Content
        const firstDeleteRes = await api.fetch(
          new Request(`http://localhost/api/ingredients/${created.id}`, {
            method: "DELETE",
          }),
          harness.env,
        );
        expect(firstDeleteRes.status).toBe(204);
        const textBody = await firstDeleteRes.text();
        expect(textBody).toBe("");

        // Verify ingredient is gone from DB
        const ingInDb = harness.sqlite
          .prepare("SELECT COUNT(*) as count FROM ingredients WHERE id = ?")
          .get(created.id) as { count: number };
        expect(ingInDb.count).toBe(0);

        // 3. Second DELETE call on the same ID -> 404 Not Found
        const secondDeleteRes = await api.fetch(
          new Request(`http://localhost/api/ingredients/${created.id}`, {
            method: "DELETE",
          }),
          harness.env,
        );
        expect(secondDeleteRes.status).toBe(404);
        const errorBody = (await secondDeleteRes.json()) as { error: string };
        expect(errorBody.error).toBe("Ingredient not found.");
      } finally {
        harness.cleanup();
      }
    });
  });
});
