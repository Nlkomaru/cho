import { readFileSync } from "node:fs";
import { describe, expect, test } from "vite-plus/test";
import { z } from "zod";

import { api } from "./index";
import { mcpToolNames } from "../domain/mcp";
import { createTestD1Harness } from "../tests/test-harness";

describe("Milestone M2 Deletion & Probe Cleanup Capabilities", () => {
  describe("REST DELETE /api/ingredients/:id", () => {
    test("successfully deletes an existing ingredient and returns 204 No Content", async () => {
      const harness = createTestD1Harness();
      try {
        const createRes = await api.fetch(
          new Request("http://localhost/api/ingredients", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: "ToDeleteIng",
              baseDimension: "mass",
              baseUnit: "g",
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
            }),
          }),
          harness.env,
        );
        expect(createRes.status).toBe(201);
        const created = (await createRes.json()) as { id: string };
        expect(created.id).toBeDefined();

        // Perform DELETE
        const deleteRes = await api.fetch(
          new Request(`http://localhost/api/ingredients/${created.id}`, {
            method: "DELETE",
          }),
          harness.env,
        );
        expect(deleteRes.status).toBe(204);

        // Verify ingredient is no longer returned in list
        const listRes = await api.fetch(
          new Request("http://localhost/api/ingredients", { method: "GET" }),
          harness.env,
        );
        expect(listRes.status).toBe(200);
        const list = (await listRes.json()) as { id: string }[];
        expect(list.some((item) => item.id === created.id)).toBe(false);
      } finally {
        harness.cleanup();
      }
    });

    test("returns 404 when attempting to delete a non-existent ingredient", async () => {
      const harness = createTestD1Harness();
      try {
        const deleteRes = await api.fetch(
          new Request("http://localhost/api/ingredients/non-existent-id", {
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
  });

  describe("MCP delete_ingredient tool", () => {
    test("deletes an ingredient using 'id' input parameter", async () => {
      const harness = createTestD1Harness();
      try {
        const { secret } = await harness.issueToken([...mcpToolNames]);
        const createRes = await harness.callMcp(secret, "create_ingredient", {
          name: "MCP Id Delete Test",
          baseDimension: "mass",
          baseUnit: "g",
          nutritionBasisAmount: 100,
          nutritionPerBasis: {
            caloriesKcal: 50,
            proteinG: 1,
            fatG: 0,
            carbohydrateG: 10,
            fiberG: 0,
            saltEquivalentG: 0,
            micronutrients: [],
          },
        });
        const created = z
          .object({ ingredient: z.object({ id: z.string() }) })
          .parse(createRes.body.result?.structuredContent);
        const targetId = created.ingredient.id;

        const delRes = await harness.callMcp(secret, "delete_ingredient", { id: targetId });
        expect(delRes.response.status).toBe(200);
        expect(delRes.body.error).toBeUndefined();
        const delResult = z
          .object({ success: z.boolean(), deletedId: z.string() })
          .parse(delRes.body.result?.structuredContent);
        expect(delResult.success).toBe(true);
        expect(delResult.deletedId).toBe(targetId);

        // Verify ingredient is no longer in list_ingredients
        const listRes = await harness.callMcp(secret, "list_ingredients", {});
        const list = z
          .object({ items: z.array(z.object({ id: z.string() })) })
          .parse(listRes.body.result?.structuredContent);
        expect(list.items.some((i) => i.id === targetId)).toBe(false);
      } finally {
        harness.cleanup();
      }
    });

    test("deletes an ingredient using 'ingredientId' input alias", async () => {
      const harness = createTestD1Harness();
      try {
        const { secret } = await harness.issueToken([...mcpToolNames]);
        const createRes = await harness.callMcp(secret, "create_ingredient", {
          name: "MCP Alias Delete Test",
          baseDimension: "volume",
          baseUnit: "mL",
          nutritionBasisAmount: 100,
          nutritionPerBasis: {
            caloriesKcal: 40,
            proteinG: 0,
            fatG: 0,
            carbohydrateG: 10,
            fiberG: 0,
            saltEquivalentG: 0,
            micronutrients: [],
          },
        });
        const created = z
          .object({ ingredient: z.object({ id: z.string() }) })
          .parse(createRes.body.result?.structuredContent);
        const targetId = created.ingredient.id;

        const delRes = await harness.callMcp(secret, "delete_ingredient", {
          ingredientId: targetId,
        });
        expect(delRes.response.status).toBe(200);
        expect(delRes.body.error).toBeUndefined();
        const delResult = z
          .object({ success: z.boolean(), deletedId: z.string() })
          .parse(delRes.body.result?.structuredContent);
        expect(delResult.success).toBe(true);
        expect(delResult.deletedId).toBe(targetId);
      } finally {
        harness.cleanup();
      }
    });

    test("returns success: false when deleting non-existent ingredient", async () => {
      const harness = createTestD1Harness();
      try {
        const { secret } = await harness.issueToken([...mcpToolNames]);
        const delRes = await harness.callMcp(secret, "delete_ingredient", {
          id: "does-not-exist",
        });
        expect(delRes.response.status).toBe(200);
        const delResult = z
          .object({ success: z.boolean(), deletedId: z.string() })
          .parse(delRes.body.result?.structuredContent);
        expect(delResult.success).toBe(false);
        expect(delResult.deletedId).toBe("does-not-exist");
      } finally {
        harness.cleanup();
      }
    });

    test("fails when neither id nor ingredientId is provided", async () => {
      const harness = createTestD1Harness();
      try {
        const { secret } = await harness.issueToken([...mcpToolNames]);
        const delRes = await harness.callMcp(secret, "delete_ingredient", {});
        expect(delRes.body.result?.isError).toBe(true);
      } finally {
        harness.cleanup();
      }
    });
  });

  describe("MCP delete_recipe tool", () => {
    const validRecipeJson = JSON.stringify({
      schemaVersion: "1.0",
      servings: 2,
      summary: "Test",
      equipment: [],
      ingredientGroups: [],
      ingredients: [
        {
          id: "entry-1",
          ingredientId: "ing-dummy",
          name: "Dummy Ing",
          amount: 50,
          unit: "g",
          displayAmount: "50g",
          role: "main",
          groupId: null,
          prepNote: null,
        },
      ],
      steps: [
        {
          id: "step-1",
          stepNumber: 1,
          phase: "cook",
          title: "Step 1",
          instruction: "Cook",
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
              ingredientEntryId: "entry-1",
              amountRatio: 1,
              amountText: null,
            },
          ],
          outputs: [{ id: "out-1", label: "Done" }],
          completionCue: null,
          cautions: [],
        },
      ],
      globalCautions: [],
    });

    test("deletes a recipe using 'id' parameter", async () => {
      const harness = createTestD1Harness();
      try {
        const { sqlite } = harness;
        const recipeId = "recipe-del-id-1";
        sqlite.exec(`
          INSERT INTO dishes (
            id, name, servings, recipe_json, created_at, updated_at
          ) VALUES (
            '${recipeId}', 'Recipe To Delete 1', 2,
            '${validRecipeJson}',
            CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          );
        `);

        const { secret } = await harness.issueToken([...mcpToolNames]);
        const delRes = await harness.callMcp(secret, "delete_recipe", { id: recipeId });
        expect(delRes.response.status).toBe(200);
        expect(delRes.body.error).toBeUndefined();
        const delResult = z
          .object({ success: z.boolean(), deletedId: z.string() })
          .parse(delRes.body.result?.structuredContent);
        expect(delResult.success).toBe(true);
        expect(delResult.deletedId).toBe(recipeId);

        // Verify recipe no longer exists in list_recipes
        const listRes = await harness.callMcp(secret, "list_recipes", {});
        const list = z
          .object({ recipes: z.array(z.object({ id: z.string() })) })
          .parse(listRes.body.result?.structuredContent);
        expect(list.recipes.some((r) => r.id === recipeId)).toBe(false);
      } finally {
        harness.cleanup();
      }
    });

    test("deletes a recipe using 'recipeId' alias", async () => {
      const harness = createTestD1Harness();
      try {
        const { sqlite } = harness;
        const recipeId = "recipe-del-alias-2";
        sqlite.exec(`
          INSERT INTO dishes (
            id, name, servings, recipe_json, created_at, updated_at
          ) VALUES (
            '${recipeId}', 'Recipe To Delete 2', 1,
            '${validRecipeJson}',
            CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          );
        `);

        const { secret } = await harness.issueToken([...mcpToolNames]);
        const delRes = await harness.callMcp(secret, "delete_recipe", { recipeId });
        expect(delRes.response.status).toBe(200);
        const delResult = z
          .object({ success: z.boolean(), deletedId: z.string() })
          .parse(delRes.body.result?.structuredContent);
        expect(delResult.success).toBe(true);
        expect(delResult.deletedId).toBe(recipeId);
      } finally {
        harness.cleanup();
      }
    });

    test("returns success: false when deleting a non-existent recipe", async () => {
      const harness = createTestD1Harness();
      try {
        const { secret } = await harness.issueToken([...mcpToolNames]);
        const delRes = await harness.callMcp(secret, "delete_recipe", {
          id: "no-such-recipe",
        });
        expect(delRes.response.status).toBe(200);
        const delResult = z
          .object({ success: z.boolean(), deletedId: z.string() })
          .parse(delRes.body.result?.structuredContent);
        expect(delResult.success).toBe(false);
        expect(delResult.deletedId).toBe("no-such-recipe");
      } finally {
        harness.cleanup();
      }
    });

    test("fails when neither id nor recipeId is provided", async () => {
      const harness = createTestD1Harness();
      try {
        const { secret } = await harness.issueToken([...mcpToolNames]);
        const delRes = await harness.callMcp(secret, "delete_recipe", {});
        expect(delRes.body.result?.isError).toBe(true);
      } finally {
        harness.cleanup();
      }
    });
  });

  describe("Migration 0002_cleanup_probes.sql idempotent cleanup", () => {
    test("removes probe remnants in proper foreign key order", async () => {
      const harness = createTestD1Harness();
      try {
        const { sqlite } = harness;
        // Seed probe remnants into database
        sqlite.exec(`
          INSERT INTO ingredients (
            id, name, normalized_name, base_dimension, base_unit,
            nutrition_basis_amount, nutrition_json, created_at, updated_at
          ) VALUES (
            'test-probe-ing-id', 'tmp-probe', 'tmp-probe', 'mass', 'g',
            100, '{"caloriesKcal":100,"proteinG":1,"fatG":0,"carbohydrateG":20,"fiberG":0,"saltEquivalentG":0,"micronutrients":[]}',
            CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          );

          INSERT INTO dishes (
            id, name, servings, recipe_json, created_at, updated_at
          ) VALUES
            ('probe-dish-a', 'probe-gratin-onion', 2, '{"schemaVersion":"1.0","servings":2,"summary":"","equipment":[],"ingredientGroups":[],"ingredients":[],"steps":[],"globalCautions":[]}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
            ('probe-dish-b', 'probe-b-gratin-onion', 2, '{"schemaVersion":"1.0","servings":2,"summary":"","equipment":[],"ingredientGroups":[],"ingredients":[],"steps":[],"globalCautions":[]}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
            ('probe-dish-d', 'probe-d-gratin-onion', 2, '{"schemaVersion":"1.0","servings":2,"summary":"","equipment":[],"ingredientGroups":[],"ingredients":[],"steps":[],"globalCautions":[]}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

          INSERT INTO dish_ingredients (
            id, dish_id, ingredient_id, recipe_entry_id, amount, display_amount, role, sort_order
          ) VALUES (
            'probe-join-a', 'probe-dish-a', 'test-probe-ing-id', 'entry-tmp', 50, '50g', 'main', 0
          );
        `);

        // Execute migration file
        const migrationSql = readFileSync(
          new URL("../../migrations/0002_cleanup_probes.sql", import.meta.url),
          "utf8",
        );
        sqlite.exec(migrationSql);

        // Verify dishes are removed
        const dishes = sqlite
          .prepare(
            "SELECT name FROM dishes WHERE name IN ('probe-gratin-onion', 'probe-b-gratin-onion', 'probe-d-gratin-onion')",
          )
          .all();
        expect(dishes).toHaveLength(0);

        // Verify ingredient is removed
        const ings = sqlite.prepare("SELECT name FROM ingredients WHERE name = 'tmp-probe'").all();
        expect(ings).toHaveLength(0);

        // Verify join records are removed
        const joins = sqlite
          .prepare("SELECT id FROM dish_ingredients WHERE dish_id = 'probe-dish-a'")
          .all();
        expect(joins).toHaveLength(0);

        // Idempotent run: execute again with zero errors
        expect(() => sqlite.exec(migrationSql)).not.toThrow();
      } finally {
        harness.cleanup();
      }
    });
  });
});
