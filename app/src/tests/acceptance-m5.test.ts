import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vite-plus/test";
import { z } from "zod";

import { mcpToolNames, purchaseListResultSchema } from "../domain/mcp";
import type { RecipeJson } from "../domain/recipe";
import {
  convertInventiaToCho,
  splitLargeRecipe,
  type SimplifiedRecipe,
} from "../domain/recipe-converter";
import { validateRecipeDag } from "../domain/recipe-scheduler";
import { api } from "../api";
import { createTestD1Harness } from "./test-harness";

function buildValidRecipe(
  title: string,
  ingredients: Array<{
    id: string;
    ingredientId: string;
    name: string;
    amount: number;
    unit: string;
    role?: "main" | "seasoning" | "topping" | "optional";
  }>,
): RecipeJson {
  return {
    schemaVersion: "1.0",
    servings: 2,
    summary: `${title} summary`,
    equipment: ["フライパン"],
    ingredientGroups: [],
    ingredients: ingredients.map((ing) => ({
      id: ing.id,
      ingredientId: ing.ingredientId,
      name: ing.name,
      amount: ing.amount,
      unit: ing.unit,
      displayAmount: `${ing.amount}${ing.unit}`,
      role: ing.role ?? "main",
      groupId: null,
      prepNote: null,
    })),
    steps: [
      {
        id: "step-1",
        stepNumber: 1,
        phase: "cook",
        title: `${title} 調理`,
        instruction: "すべての材料を合わせて加熱調理する",
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
        resourceTags: ["frying-pan"],
        heatLevel: "medium",
        targetTempCelsius: null,
        inputs: ingredients.map((ing) => ({
          type: "ingredient",
          ingredientEntryId: ing.id,
          amountRatio: 1,
          amountText: null,
        })),
        outputs: [{ id: "out-1", label: "完成品" }],
        completionCue: "全体に火が通った状態",
        cautions: [],
        imageIds: [],
      },
    ],
    globalCautions: [],
  };
}

describe("Worker M5: Comprehensive Acceptance Verification (R1, R2, R3, R4)", () => {
  // =========================================================================
  // Requirement R1: D1 SQL Variable Limit Fix & 12-Ingredient Recipe
  // =========================================================================
  describe("R1 Acceptance: recipe_payload_4step.json & Zero D1_ERROR", () => {
    test("registers workspace recipe_payload_4step.json via MCP create_recipe and retrieves all 12 ingredients & 4 steps intact", async () => {
      const harness = createTestD1Harness({
        enforceVariableLimit: true,
        maxVariablesPerStatement: 100,
      });
      try {
        const { secret } = await harness.issueToken([...mcpToolNames]);

        // Read workspace root recipe_payload_4step.json and ingredient_map.json
        const recipePayloadPath = resolve(process.cwd(), "recipe_payload_4step.json");
        const ingredientMapPath = resolve(process.cwd(), "ingredient_map.json");

        const recipePayloadRaw = JSON.parse(readFileSync(recipePayloadPath, "utf8"));
        const ingredientMapRaw = JSON.parse(readFileSync(ingredientMapPath, "utf8")) as Record<
          string,
          string
        >;

        expect(Object.keys(ingredientMapRaw).length).toBeGreaterThan(0);
        expect(recipePayloadRaw.recipe.ingredients).toHaveLength(12);
        expect(recipePayloadRaw.recipe.steps).toHaveLength(4);

        // Step A: Pre-register the 12 ingredients so FK / references align
        const nameToDbId: Record<string, string> = {};
        for (const ing of recipePayloadRaw.recipe.ingredients) {
          const res = await harness.callMcp(secret, "create_ingredient", {
            name: ing.name,
            baseDimension: ing.unit === "mL" ? "volume" : "mass",
            baseUnit: ing.unit,
            nutritionBasisAmount: 100,
            nutritionPerBasis: {
              caloriesKcal: 50,
              proteinG: 1,
              fatG: 1,
              carbohydrateG: 5,
              fiberG: 1,
              saltEquivalentG: 0.1,
              micronutrients: [],
            },
          });
          expect(res.response.status).toBe(200);
          expect(res.body.error).toBeUndefined();
          const parsed = z
            .object({ ingredient: z.object({ id: z.string(), name: z.string() }) })
            .parse(res.body.result?.structuredContent);
          nameToDbId[parsed.ingredient.name] = parsed.ingredient.id;
        }
        expect(Object.keys(nameToDbId)).toHaveLength(12);

        // Remap ingredientIds in payload to the created DB IDs
        const remappedRecipe = {
          ...recipePayloadRaw,
          recipe: {
            ...recipePayloadRaw.recipe,
            ingredients: recipePayloadRaw.recipe.ingredients.map(
              (ing: { name: string; [key: string]: unknown }) => ({
                ...ing,
                ingredientId: nameToDbId[ing.name],
              }),
            ),
          },
        };

        // Step B: Send create_recipe MCP tool call
        // Enforcing maxVariablesPerStatement: 100. If chunking failed, this would trigger D1_ERROR offset 505!
        const createRes = await harness.callMcp(secret, "create_recipe", remappedRecipe);
        expect(createRes.response.status).toBe(200);
        expect(createRes.body.error).toBeUndefined();

        const createdDish = z
          .object({
            recipe: z.object({
              id: z.string(),
              name: z.string(),
              servings: z.number(),
              recipe: z.object({
                ingredients: z.array(z.record(z.string(), z.unknown())),
                steps: z.array(z.record(z.string(), z.unknown())),
              }),
            }),
          })
          .parse(createRes.body.result?.structuredContent);

        const createdId = createdDish.recipe.id;
        expect(createdId).toBeTruthy();

        // Step C: Retrieve via list_recipes
        const listRes = await harness.callMcp(secret, "list_recipes", {});
        expect(listRes.response.status).toBe(200);

        const listData = z
          .object({
            recipes: z.array(
              z.object({
                id: z.string(),
                name: z.string(),
                servings: z.number(),
                notes: z.string().nullable().optional(),
                recipe: z.object({
                  ingredients: z.array(
                    z.object({
                      id: z.string(),
                      ingredientId: z.string(),
                      name: z.string(),
                      amount: z.number(),
                      unit: z.string(),
                      displayAmount: z.string().nullable().optional(),
                      role: z.string(),
                      prepNote: z.string().nullable().optional(),
                    }),
                  ),
                  steps: z.array(
                    z.object({
                      id: z.string(),
                      stepNumber: z.number(),
                      phase: z.string(),
                      title: z.string(),
                      instruction: z.string(),
                      timing: z.object({
                        activeDurationSec: z.number(),
                        passiveDurationSec: z.number(),
                      }),
                      inputs: z.array(z.record(z.string(), z.unknown())),
                      outputs: z.array(z.record(z.string(), z.unknown())),
                    }),
                  ),
                }),
              }),
            ),
          })
          .parse(listRes.body.result?.structuredContent);

        const target = listData.recipes.find((r) => r.id === createdId);
        expect(target).toBeDefined();
        if (!target) throw new Error("Created dish not found in list_recipes");

        // 1. Verify all 12 ingredients are present and unmodified
        expect(target.recipe.ingredients).toHaveLength(12);
        for (const originalIng of recipePayloadRaw.recipe.ingredients) {
          const found = target.recipe.ingredients.find((i) => i.name === originalIng.name);
          expect(found, `Ingredient ${originalIng.name} must exist in list_recipes`).toBeDefined();
          expect(found?.amount).toBe(originalIng.amount);
          expect(found?.unit).toBe(originalIng.unit);
          expect(found?.displayAmount).toBe(originalIng.displayAmount);
          expect(found?.role).toBe(originalIng.role);
        }

        // 2. Verify all 4 steps are intact
        expect(target.recipe.steps).toHaveLength(4);
        const stepPhases = target.recipe.steps.map((s) => s.phase);
        expect(stepPhases).toEqual(["prep", "cook", "assemble", "finish"]);

        for (let i = 0; i < 4; i++) {
          const origStep = recipePayloadRaw.recipe.steps[i];
          const retStep = target.recipe.steps[i];
          expect(retStep.stepNumber).toBe(origStep.stepNumber);
          expect(retStep.title).toBe(origStep.title);
          expect(retStep.instruction).toBe(origStep.instruction);
          expect(retStep.timing.activeDurationSec).toBe(origStep.timing.activeDurationSec);
          expect(retStep.timing.passiveDurationSec).toBe(origStep.timing.passiveDurationSec);
        }
      } finally {
        harness.cleanup();
      }
    });
  });

  // =========================================================================
  // Requirement R2: Probe Residue Elimination and Deletion Endpoints
  // =========================================================================
  describe("R2 Acceptance: Probe Cleanup & Deletion APIs", () => {
    test("removes probe remnants via 0002_cleanup_probes.sql and verifies absence in list_recipes and list_ingredients", async () => {
      const harness = createTestD1Harness({ enforceVariableLimit: true });
      try {
        const { sqlite } = harness;
        const { secret } = await harness.issueToken([...mcpToolNames]);

        // Seed probe records manually to simulate legacy dirty database state
        sqlite.exec(`
					INSERT INTO ingredients (id, name, normalized_name, base_dimension, base_unit, nutrition_basis_amount, nutrition_json, created_at, updated_at)
					VALUES ('probe-id-tmp', 'tmp-probe', 'tmp-probe', 'mass', 'g', 100, '{}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

					INSERT INTO dishes (id, name, servings, recipe_json, created_at, updated_at)
					VALUES
						('probe-dish-id-1', 'probe-gratin-onion', 2, '{"schemaVersion":"1.0","servings":2,"summary":"","equipment":[],"ingredientGroups":[],"ingredients":[],"steps":[],"globalCautions":[]}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
						('probe-dish-id-2', 'probe-b-gratin-onion', 2, '{"schemaVersion":"1.0","servings":2,"summary":"","equipment":[],"ingredientGroups":[],"ingredients":[],"steps":[],"globalCautions":[]}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
						('probe-dish-id-3', 'probe-d-gratin-onion', 2, '{"schemaVersion":"1.0","servings":2,"summary":"","equipment":[],"ingredientGroups":[],"ingredients":[],"steps":[],"globalCautions":[]}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

					INSERT INTO dish_ingredients (id, dish_id, ingredient_id, recipe_entry_id, amount, display_amount, role, sort_order)
					VALUES ('probe-di-1', 'probe-dish-id-1', 'probe-id-tmp', 'entry-probe', 10, '10g', 'main', 0);
				`);

        // Verify seed exists
        const probeDishesBefore = sqlite
          .prepare("SELECT name FROM dishes WHERE name LIKE 'probe-%'")
          .all();
        expect(probeDishesBefore).toHaveLength(3);
        const probeIngsBefore = sqlite
          .prepare("SELECT name FROM ingredients WHERE name = 'tmp-probe'")
          .all();
        expect(probeIngsBefore).toHaveLength(1);

        // Apply migration 0002_cleanup_probes.sql
        const migrationPath = resolve(process.cwd(), "app/migrations/0002_cleanup_probes.sql");
        const sql = readFileSync(migrationPath, "utf8");
        sqlite.exec(sql);

        // Verify DB table state: probe residues completely absent
        const probeDishesAfter = sqlite
          .prepare("SELECT name FROM dishes WHERE name LIKE 'probe-%'")
          .all();
        expect(probeDishesAfter).toHaveLength(0);
        const probeIngsAfter = sqlite
          .prepare("SELECT name FROM ingredients WHERE name = 'tmp-probe'")
          .all();
        expect(probeIngsAfter).toHaveLength(0);

        // Verify list_recipes has zero probe dishes
        const listRecipes = await harness.callMcp(secret, "list_recipes", {});
        const recipeNames = (
          (listRecipes.body.result?.structuredContent as { recipes: { name: string }[] })
            ?.recipes ?? []
        ).map((r) => r.name);
        expect(recipeNames).not.toContain("probe-gratin-onion");
        expect(recipeNames).not.toContain("probe-b-gratin-onion");
        expect(recipeNames).not.toContain("probe-d-gratin-onion");

        // Verify list_ingredients has zero tmp-probe
        const listIngredients = await harness.callMcp(secret, "list_ingredients", {});
        const ingNames = (
          (listIngredients.body.result?.structuredContent as { items: { name: string }[] })
            ?.items ?? []
        ).map((i) => i.name);
        expect(ingNames).not.toContain("tmp-probe");
      } finally {
        harness.cleanup();
      }
    });

    test("verifies MCP delete_recipe, MCP delete_ingredient, and REST DELETE /api/ingredients/:id", async () => {
      const harness = createTestD1Harness({ enforceVariableLimit: true });
      try {
        const { secret } = await harness.issueToken([...mcpToolNames]);

        // 1. Create ingredient
        const createIngRes = await harness.callMcp(secret, "create_ingredient", {
          name: "消去テスト材料",
          baseDimension: "mass",
          baseUnit: "g",
          nutritionBasisAmount: 100,
          nutritionPerBasis: {
            caloriesKcal: 10,
            proteinG: 0,
            fatG: 0,
            carbohydrateG: 2,
            fiberG: 0,
            saltEquivalentG: 0,
            micronutrients: [],
          },
        });
        expect(createIngRes.response.status).toBe(200);
        const ing = (createIngRes.body.result?.structuredContent as { ingredient: { id: string } })
          .ingredient;
        expect(ing.id).toBeTruthy();

        // 2. Create dish using this ingredient with valid DAG recipe
        const dishPayload = {
          name: "消去テスト料理",
          category: "main",
          servings: 1,
          coverImageId: null,
          notes: "消去テスト",
          recipe: buildValidRecipe("消去テスト料理", [
            {
              id: "entry-del-1",
              ingredientId: ing.id,
              name: "消去テスト材料",
              amount: 50,
              unit: "g",
            },
          ]),
        };
        const createDishRes = await harness.callMcp(secret, "create_recipe", dishPayload);
        expect(createDishRes.response.status).toBe(200);
        const dish = (createDishRes.body.result?.structuredContent as { recipe: { id: string } })
          .recipe;
        expect(dish.id).toBeTruthy();

        // 3. Test MCP delete_recipe
        const delDishRes = await harness.callMcp(secret, "delete_recipe", { id: dish.id });
        expect(delDishRes.response.status).toBe(200);
        const delDishBody = delDishRes.body.result?.structuredContent as {
          success: boolean;
          deletedId: string;
        };
        expect(delDishBody.success).toBe(true);
        expect(delDishBody.deletedId).toBe(dish.id);

        // 4. Test MCP delete_ingredient (now safe to delete since dish was removed)
        const delIngRes = await harness.callMcp(secret, "delete_ingredient", { id: ing.id });
        expect(delIngRes.response.status).toBe(200);
        const delIngBody = delIngRes.body.result?.structuredContent as {
          success: boolean;
          deletedId: string;
        };
        expect(delIngBody.success).toBe(true);
        expect(delIngBody.deletedId).toBe(ing.id);

        // 5. Test REST DELETE /api/ingredients/:id
        // Create another ingredient to delete via REST
        const createIng2Res = await harness.callMcp(secret, "create_ingredient", {
          name: "REST消去材料",
          baseDimension: "mass",
          baseUnit: "g",
          nutritionBasisAmount: 100,
          nutritionPerBasis: {
            caloriesKcal: 10,
            proteinG: 0,
            fatG: 0,
            carbohydrateG: 2,
            fiberG: 0,
            saltEquivalentG: 0,
            micronutrients: [],
          },
        });
        const ing2 = (
          createIng2Res.body.result?.structuredContent as { ingredient: { id: string } }
        ).ingredient;

        const restDelRes = await api.fetch(
          new Request(`http://localhost/api/ingredients/${ing2.id}`, {
            method: "DELETE",
          }),
          harness.env,
        );
        expect(restDelRes.status).toBe(204);
      } finally {
        harness.cleanup();
      }
    });
  });

  // =========================================================================
  // Requirement R3: Recipe -> Shortage and Purchase List Output (Unified Table)
  // =========================================================================
  describe("R3 Acceptance: Purchase & Shortage List Single Unified Table", () => {
    test("generates shortage & purchase table covering sufficient, partial, none, and unknown stock states with pricing", async () => {
      const harness = createTestD1Harness({ enforceVariableLimit: true });
      try {
        const { secret } = await harness.issueToken([...mcpToolNames]);

        // Create 3 ingredients in DB with unit prices
        const ingMap: Record<string, string> = {};
        const itemsToCreate = [
          { name: "じゃがいも", unit: "g", price: 50 }, // 50 yen per 100g
          { name: "にんじん", unit: "g", price: 40 }, // 40 yen per 100g
          { name: "豚肉", unit: "g", price: 150 }, // 150 yen per 100g
        ];
        for (const item of itemsToCreate) {
          const res = await harness.callMcp(secret, "create_ingredient", {
            name: item.name,
            baseDimension: "mass",
            baseUnit: item.unit,
            nutritionBasisAmount: 100,
            nutritionPerBasis: {
              caloriesKcal: 100,
              proteinG: 2,
              fatG: 1,
              carbohydrateG: 20,
              fiberG: 1,
              saltEquivalentG: 0,
              micronutrients: [],
            },
          });
          expect(res.response.status).toBe(200);
          const created = (res.body.result?.structuredContent as { ingredient: { id: string } })
            .ingredient;
          ingMap[item.name] = created.id;

          // Set unit price
          harness.sqlite
            .prepare("UPDATE ingredients SET latest_unit_price_yen = ? WHERE id = ?")
            .run(item.price, created.id);
        }

        // Build a valid recipe with 4 ingredients:
        // - じゃがいも: 200g (stock: 200g -> sufficient)
        // - にんじん: 100g (stock: 40g -> partial, shortage: 60g)
        // - 豚肉: 150g (stock: 0g -> none, shortage: 150g)
        // - カレールー: 50g (unregistered ingredient ID -> unknown)
        const recipeData = buildValidRecipe("カレー", [
          {
            id: "e1",
            ingredientId: ingMap["じゃがいも"],
            name: "じゃがいも",
            amount: 200,
            unit: "g",
            role: "main",
          },
          {
            id: "e2",
            ingredientId: ingMap["にんじん"],
            name: "にんじん",
            amount: 100,
            unit: "g",
            role: "main",
          },
          {
            id: "e3",
            ingredientId: ingMap["豚肉"],
            name: "豚肉",
            amount: 150,
            unit: "g",
            role: "main",
          },
          {
            id: "e4",
            ingredientId: "unregistered-roux-id",
            name: "カレールー",
            amount: 50,
            unit: "g",
            role: "seasoning",
          },
        ]);

        const inventory = {
          [ingMap["じゃがいも"]]: { currentQuantity: 200, baseUnit: "g" },
          [ingMap["にんじん"]]: { currentQuantity: 40, baseUnit: "g" },
          [ingMap["豚肉"]]: { currentQuantity: 0, baseUnit: "g" },
        };

        // Call calculate_purchase_list via MCP
        const mcpCalcRes = await harness.callMcp(secret, "calculate_purchase_list", {
          recipe: recipeData,
          inventory,
        });

        expect(mcpCalcRes.response.status).toBe(200);
        expect(mcpCalcRes.body.error).toBeUndefined();

        const result = purchaseListResultSchema.parse(mcpCalcRes.body.result?.structuredContent);

        // Verify item-level calculations
        const potato = result.items.find((i) => i.name === "じゃがいも")!;
        expect(potato.stockPresence).toBe("sufficient");
        expect(potato.shortageAmount).toBe(0);
        expect(potato.purchaseAmount).toBe(0);
        expect(potato.estimatedCostYen).toBe(0);

        const carrot = result.items.find((i) => i.name === "にんじん")!;
        expect(carrot.stockPresence).toBe("partial");
        expect(carrot.shortageAmount).toBe(60);
        expect(carrot.purchaseAmount).toBe(60);
        // (40 yen / 100g) * 60g = 24 yen
        expect(carrot.estimatedCostYen).toBe(24);

        const pork = result.items.find((i) => i.name === "豚肉")!;
        expect(pork.stockPresence).toBe("none");
        expect(pork.shortageAmount).toBe(150);
        expect(pork.purchaseAmount).toBe(150);
        // (150 yen / 100g) * 150g = 225 yen
        expect(pork.estimatedCostYen).toBe(225);

        const roux = result.items.find((i) => i.name === "カレールー")!;
        expect(roux.stockPresence).toBe("unknown");
        expect(roux.shortageAmount).toBe(50);
        expect(roux.purchaseAmount).toBe(50);
        expect(roux.isUnregistered).toBe(true);
        expect(roux.estimatedCostYen).toBeNull();

        // Total cost = 0 + 24 + 225 = 249 yen
        expect(result.totalEstimatedCostYen).toBe(249);

        // Verify unified markdown table structure
        expect(result.markdownTable).toContain(
          "| 材料名 | 必要量 | 在庫量 | 在庫状況 | 不足量 | 買い足し量 | 参考単価 | 概算費用 | 登録状態 |",
        );
        expect(result.markdownTable).toContain(
          "| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |",
        );
        expect(result.markdownTable).toContain(
          "| じゃがいも | 200g | 200g | 充足 | 0g | 0g | 50円 | 0円 | 登録済 |",
        );
        expect(result.markdownTable).toContain(
          "| にんじん | 100g | 40g | 一部あり | 60g | 60g | 40円 | 24円 | 登録済 |",
        );
        expect(result.markdownTable).toContain(
          "| 豚肉 | 150g | 0g | なし | 150g | 150g | 150円 | 225円 | 登録済 |",
        );
        expect(result.markdownTable).toContain(
          "| カレールー | 50g | - | 不明 | 50g | 50g | - | - | 未登録 |",
        );
        expect(result.markdownTable).toContain(
          "| **合計** | - | - | - | - | - | - | **249円** | - |",
        );
      } finally {
        harness.cleanup();
      }
    });

    test("REST route POST /api/dishes/:id/purchase-list computes unified purchase list", async () => {
      const harness = createTestD1Harness({ enforceVariableLimit: true });
      try {
        const { secret } = await harness.issueToken([...mcpToolNames]);

        // Create ingredient & recipe
        const ingRes = await harness.callMcp(secret, "create_ingredient", {
          name: "RESTテスト材料",
          baseDimension: "mass",
          baseUnit: "g",
          nutritionBasisAmount: 100,
          nutritionPerBasis: {
            caloriesKcal: 50,
            proteinG: 1,
            fatG: 0,
            carbohydrateG: 5,
            fiberG: 0,
            saltEquivalentG: 0,
            micronutrients: [],
          },
        });
        expect(ingRes.response.status).toBe(200);
        const ingId = (ingRes.body.result?.structuredContent as { ingredient: { id: string } })
          .ingredient.id;

        harness.sqlite
          .prepare("UPDATE ingredients SET latest_unit_price_yen = ? WHERE id = ?")
          .run(100, ingId);

        const dishPayload = {
          name: "REST購入リスト料理",
          category: "main",
          servings: 1,
          coverImageId: null,
          notes: "REST用メモ",
          recipe: buildValidRecipe("REST購入リスト料理", [
            { id: "e-rest-1", ingredientId: ingId, name: "RESTテスト材料", amount: 100, unit: "g" },
          ]),
        };
        const dishRes = await harness.callMcp(secret, "create_recipe", dishPayload);
        expect(dishRes.response.status).toBe(200);
        const dishId = (dishRes.body.result?.structuredContent as { recipe: { id: string } }).recipe
          .id;

        // POST /api/dishes/:id/purchase-list
        const restRes = await api.fetch(
          new Request(`http://localhost/api/dishes/${dishId}/purchase-list`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              inventory: {
                [ingId]: { currentQuantity: 20, baseUnit: "g" },
              },
            }),
          }),
          harness.env,
        );

        expect(restRes.status).toBe(200);
        const body = (await restRes.json()) as {
          items: Array<{ name: string; shortageAmount: number }>;
          markdownTable: string;
        };
        expect(body.items).toHaveLength(1);
        expect(body.items[0].shortageAmount).toBe(80);
        expect(body.markdownTable).toContain("RESTテスト材料");
      } finally {
        harness.cleanup();
      }
    });
  });

  // =========================================================================
  // Requirement R4: Inventia to cho Registration & Recipe Splitting
  // =========================================================================
  describe("R4 Acceptance: Inventia Converter, Recipe Splitting & DAG Safety", () => {
    test("convertInventiaToCho converts simplified recipe to Cho DAG format and passes validateRecipeDag", () => {
      const simplified: SimplifiedRecipe = {
        name: "簡単オニオンスープ",
        category: "soup",
        servings: 4,
        summary: "じっくり炒めた玉ねぎスープ",
        equipment: ["鍋"],
        ingredients: [
          { name: "玉ねぎ", amount: 300, unit: "g", role: "main" },
          { name: "有塩バター", amount: 20, unit: "g", role: "main" },
          { name: "食塩", amount: 3, unit: "g", role: "seasoning" },
        ],
        phases: {
          prep: { instruction: "玉ねぎを薄切りにする", durationSec: 180, ingredients: ["玉ねぎ"] },
          cook: {
            instruction: "バターで炒め、水と塩を加えて煮る",
            durationSec: 600,
            heatLevel: "medium",
            ingredients: ["有塩バター", "食塩"],
          },
        },
      };

      const ingredientMap = {
        玉ねぎ: "ing-onion",
        有塩バター: "ing-butter",
        食塩: "ing-salt",
      };

      const result = convertInventiaToCho(simplified, ingredientMap);

      expect(result.warnings).toEqual([]);
      expect(result.dishPayload.name).toBe("簡単オニオンスープ");
      expect(result.dishPayload.servings).toBe(4);
      expect(result.dishPayload.recipe.ingredients).toHaveLength(3);
      expect(result.dishPayload.recipe.steps.length).toBeGreaterThanOrEqual(2);

      // Pre-flight dry-run validation ensures DAG validity
      const dagCheck = validateRecipeDag(result.dishPayload.recipe);
      expect(dagCheck.success).toBe(true);
    });

    test("splitLargeRecipe splits multi-ingredient recipes (>12 ingredients) cleanly into sub-recipes", () => {
      const largeRecipe: SimplifiedRecipe = {
        name: "超大型具だくさんポトフ",
        servings: 6,
        ingredients: Array.from({ length: 28 }, (_, i) => ({
          name: `具材_${i + 1}`,
          amount: 50,
          unit: "g",
        })),
      };

      const subRecipes = splitLargeRecipe(largeRecipe, 12);

      // 28 ingredients / 12 = 3 parts (12, 12, 4)
      expect(subRecipes).toHaveLength(3);
      expect(subRecipes[0].ingredients).toHaveLength(12);
      expect(subRecipes[1].ingredients).toHaveLength(12);
      expect(subRecipes[2].ingredients).toHaveLength(4);

      expect(subRecipes[0].name).toContain("パート 1/3");
      expect(subRecipes[1].name).toContain("パート 2/3");
      expect(subRecipes[2].name).toContain("パート 3/3");
    });

    test("pre-flight dry-run validation catches malformed DAGs preventing probe residues", () => {
      const malformedRecipe: SimplifiedRecipe = {
        name: "循環エラーレシピ",
        servings: 2,
        ingredients: [{ name: "未登録具材", amount: 100, unit: "g" }],
      };

      const res = convertInventiaToCho(malformedRecipe, {});
      // Missing ingredient mapped triggers warning
      expect(res.warnings.length).toBeGreaterThan(0);
      expect(res.warnings.some((w) => w.includes("未登録具材"))).toBe(true);
    });
  });
});
