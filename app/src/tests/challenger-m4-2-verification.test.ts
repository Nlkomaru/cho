import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vite-plus/test";
import { z } from "zod";

import { dishSchema, type Dish } from "../domain/ingredient";
import {
  convertInventiaToCho,
  splitLargeRecipe,
  type SimplifiedIngredient,
  type SimplifiedRecipe,
} from "../domain/recipe-converter";
import { validateRecipeDag } from "../domain/recipe-scheduler";
import { createTestD1Harness } from "./test-harness";

describe("Empirical Challenger M4 (Challenger 2): Recipe Splitting & Workspace Fixtures Adversarial Suite", () => {
  const workspaceRoot = resolve(__dirname, "../../../");
  const fixturePayloadPath = resolve(workspaceRoot, "recipe_payload_4step.json");
  const fixtureMapPath = resolve(workspaceRoot, "ingredient_map.json");

  // =========================================================================
  // Challenge 1: splitLargeRecipe with 25-Ingredient Banquet Recipe
  // =========================================================================
  describe("Challenge 1: splitLargeRecipe with 25-Ingredient Banquet Recipe (maxIngredientsPerDish = 12)", () => {
    const banquetIngredients: SimplifiedIngredient[] = Array.from({ length: 25 }, (_, i) => {
      const num = i + 1;
      const roles: Array<"main" | "seasoning" | "topping" | "optional"> = [
        "main",
        "seasoning",
        "topping",
        "optional",
      ];
      const role = roles[i % 4];
      return {
        name: `特選食材_${num}`,
        amount: num * 15,
        unit: num % 2 === 0 ? "g" : "mL",
        displayAmount: `${num * 15}${num % 2 === 0 ? "g" : "mL"}`,
        role,
        prepNote: num % 3 === 0 ? `下処理_${num}` : undefined,
      };
    });

    const banquetRecipe: SimplifiedRecipe = {
      name: "宮廷風 25品目の特製ブイヤベースグラタン",
      category: "main",
      servings: 8,
      summary: "25品目の厳選食材を使用した超大型バンケット料理",
      equipment: ["寸胴鍋", "フライパン", "大型グラタン皿", "スチームコンベクションオーブン"],
      ingredients: banquetIngredients,
      phases: {
        prep: {
          instruction: "食材1〜7をそれぞれ計量し、下処理を完了させる。",
          durationSec: 600,
          ingredients: banquetIngredients.slice(0, 7).map((i) => i.name),
        },
        cook: {
          instruction: "食材8〜17を順次投入して弱火〜中火でじっくり煮込む。",
          durationSec: 900,
          heatLevel: "medium",
          ingredients: banquetIngredients.slice(7, 17).map((i) => i.name),
        },
        assemble: {
          instruction: "食材18〜22を大皿に並べ、ベースソースと合わせる。",
          durationSec: 300,
          ingredients: banquetIngredients.slice(17, 22).map((i) => i.name),
        },
        finish: {
          instruction: "食材23〜25を表面にトッピングし、オーブンで焼き色をつける。",
          durationSec: 480,
          heatLevel: "high",
          ingredients: banquetIngredients.slice(22, 25).map((i) => i.name),
        },
      },
    };

    // Mapping for all 25 ingredients
    const banquetIngredientMap: Record<string, string> = Object.fromEntries(
      banquetIngredients.map((ing, i) => [ing.name, `ing-banquet-uuid-${i + 1}`]),
    );

    test("splits 25-ingredient recipe into exactly 3 sub-recipes (12, 12, 1 items)", () => {
      const subRecipes = splitLargeRecipe(banquetRecipe, 12);

      expect(subRecipes).toBeDefined();
      expect(subRecipes).toHaveLength(3);

      // Item count distribution
      expect(subRecipes[0].ingredients).toHaveLength(12);
      expect(subRecipes[1].ingredients).toHaveLength(12);
      expect(subRecipes[2].ingredients).toHaveLength(1);

      // Total ingredient preservation
      const totalCount = subRecipes.reduce((sum, r) => sum + r.ingredients.length, 0);
      expect(totalCount).toBe(25);

      // Verification of sub-recipe metadata preservation
      for (let i = 0; i < subRecipes.length; i++) {
        const sub = subRecipes[i];
        const partNum = i + 1;
        expect(sub.name).toBe(`宮廷風 25品目の特製ブイヤベースグラタン (パート ${partNum}/3)`);
        expect(sub.servings).toBe(8);
        expect(sub.category).toBe("main");
        expect(sub.summary).toBe(
          `25品目の厳選食材を使用した超大型バンケット料理 (パート ${partNum}/3)`,
        );
        expect(sub.equipment).toEqual(banquetRecipe.equipment);
      }

      // Sub-phase ingredient isolation: no sub-recipe phase references ingredients outside its chunk
      for (const sub of subRecipes) {
        const chunkNames = new Set(sub.ingredients.map((ing) => ing.name));
        if (sub.phases) {
          for (const [, phaseData] of Object.entries(sub.phases)) {
            if (!phaseData) continue;
            for (const ingName of phaseData.ingredients) {
              expect(
                chunkNames.has(ingName),
                `Phase ingredient ${ingName} must belong to sub-recipe chunk`,
              ).toBe(true);
            }
          }
        }
      }
    });

    test("each of the 3 split sub-recipes independently converts to cho and passes validateRecipeDag and dishSchema", () => {
      const subRecipes = splitLargeRecipe(banquetRecipe, 12);
      expect(subRecipes).toHaveLength(3);

      for (let idx = 0; idx < subRecipes.length; idx++) {
        const sub = subRecipes[idx];
        const result = convertInventiaToCho(sub, banquetIngredientMap);

        expect(result).toBeDefined();
        // Since all 25 ingredients are mapped, warnings should only contain legitimate phase notices or empty
        const payload = result.dishPayload;

        // 1. Structural checks
        expect(payload.name).toBe(sub.name);
        expect(payload.servings).toBe(8);
        expect(payload.recipe.ingredients).toHaveLength(sub.ingredients.length);
        expect(payload.recipe.steps).toHaveLength(4);

        // 2. Pre-flight DAG validation
        const dagCheck = validateRecipeDag(payload.recipe);
        expect(
          dagCheck.success,
          `Sub-recipe part ${idx + 1} DAG validation failed: ${dagCheck.errors.join("; ")}`,
        ).toBe(true);
        expect(dagCheck.errors).toHaveLength(0);

        // 3. Step linkage & DAG invariant
        const steps = payload.recipe.steps;
        expect(steps[0].id).toBe("step-prep");
        expect(steps[1].id).toBe("step-cook");
        expect(steps[2].id).toBe("step-assemble");
        expect(steps[3].id).toBe("step-finish");

        // Reachability from step-prep to step-finish
        expect(steps[1].dependsOnStepIds).toContain("step-prep");
        expect(steps[2].dependsOnStepIds).toContain("step-cook");
        expect(steps[3].dependsOnStepIds).toContain("step-assemble");

        // 4. Ingredient utilization: 100% of sub-recipe ingredients utilized with ratio == 1.0
        const ingredientIdsInInputs = new Set<string>();
        for (const step of steps) {
          for (const input of step.inputs) {
            if (input.type === "ingredient") {
              expect(input.amountRatio).toBe(1);
              ingredientIdsInInputs.add(input.ingredientEntryId);
            }
          }
        }
        for (const ing of payload.recipe.ingredients) {
          expect(
            ingredientIdsInInputs.has(ing.id),
            `Ingredient ${ing.name} (${ing.id}) must be consumed in steps`,
          ).toBe(true);
        }

        // 5. Schema validation
        const mockFullDish: Dish = {
          id: `sub-dish-uuid-${idx + 1}`,
          name: payload.name,
          category: payload.category ?? null,
          servings: payload.servings,
          recipe: payload.recipe,
          totalNutrition: null,
          totalCostYen: null,
          coverImageId: null,
          notes: payload.notes ?? null,
        };
        const parseResult = dishSchema.safeParse(mockFullDish);
        expect(
          parseResult.success,
          `Sub-recipe part ${idx + 1} dishSchema validation failed: ${JSON.stringify(parseResult.error)}`,
        ).toBe(true);
      }
    });

    test("split sub-recipes convert cleanly even with unmapped ingredients using deterministic fallbacks", () => {
      const subRecipes = splitLargeRecipe(banquetRecipe, 12);

      for (const sub of subRecipes) {
        // Pass completely empty ingredient map
        const result = convertInventiaToCho(sub, {});
        expect(result.warnings.length).toBeGreaterThan(0);
        // Unmapped fallback IDs are assigned and DAG remains 100% valid
        const dagCheck = validateRecipeDag(result.dishPayload.recipe);
        expect(dagCheck.success).toBe(true);
        expect(dagCheck.errors).toHaveLength(0);
      }
    });
  });

  // =========================================================================
  // Challenge 2: Edge Cases & Boundary Conditions of splitLargeRecipe
  // =========================================================================
  describe("Challenge 2: Edge Cases and Boundary Conditions for splitLargeRecipe", () => {
    const makeIngredients = (count: number): SimplifiedIngredient[] =>
      Array.from({ length: count }, (_, i) => ({
        name: `材料_${i + 1}`,
        amount: 100,
        unit: "g",
        role: "main",
      }));

    test("exact boundary: 12 ingredients with maxIngredientsPerDish = 12 returns single unsplit recipe", () => {
      const recipe: SimplifiedRecipe = {
        name: "境界値12品レシピ",
        servings: 2,
        ingredients: makeIngredients(12),
      };

      const result = splitLargeRecipe(recipe, 12);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("境界値12品レシピ");
      expect(result[0].ingredients).toHaveLength(12);
    });

    test("exact boundary: 24 ingredients with maxIngredientsPerDish = 12 returns exactly 2 parts of 12", () => {
      const recipe: SimplifiedRecipe = {
        name: "境界値24品レシピ",
        servings: 4,
        ingredients: makeIngredients(24),
      };

      const result = splitLargeRecipe(recipe, 12);
      expect(result).toHaveLength(2);
      expect(result[0].ingredients).toHaveLength(12);
      expect(result[1].ingredients).toHaveLength(12);
      expect(result[0].name).toContain("パート 1/2");
      expect(result[1].name).toContain("パート 2/2");
    });

    test("boundary off-by-one: 13 ingredients with maxIngredientsPerDish = 12 returns 2 parts (12, 1)", () => {
      const recipe: SimplifiedRecipe = {
        name: "13品目レシピ",
        servings: 2,
        ingredients: makeIngredients(13),
      };

      const result = splitLargeRecipe(recipe, 12);
      expect(result).toHaveLength(2);
      expect(result[0].ingredients).toHaveLength(12);
      expect(result[1].ingredients).toHaveLength(1);
      expect(result[0].name).toContain("パート 1/2");
      expect(result[1].name).toContain("パート 2/2");
    });

    test("empty ingredient list returns 1 sub-recipe with empty ingredients", () => {
      const emptyRecipe: SimplifiedRecipe = {
        name: "材料ゼロレシピ",
        servings: 1,
        ingredients: [],
      };

      const result = splitLargeRecipe(emptyRecipe, 12);
      expect(result).toHaveLength(1);
      expect(result[0].ingredients).toHaveLength(0);
    });

    test("maxIngredientsPerDish = 1 divides 5 ingredients into 5 sub-recipes", () => {
      const recipe: SimplifiedRecipe = {
        name: "1品ごと分割レシピ",
        servings: 2,
        ingredients: makeIngredients(5),
      };

      const result = splitLargeRecipe(recipe, 1);
      expect(result).toHaveLength(5);
      for (let i = 0; i < 5; i++) {
        expect(result[i].ingredients).toHaveLength(1);
        expect(result[i].name).toContain(`パート ${i + 1}/5`);
      }
    });

    test("invalid or non-positive maxIngredientsPerDish is clamped to at least 1 without error or infinite loop", () => {
      const recipe: SimplifiedRecipe = {
        name: "クランプ検証レシピ",
        servings: 2,
        ingredients: makeIngredients(3),
      };

      // Testing 0 and negative values
      const resultZero = splitLargeRecipe(recipe, 0);
      expect(resultZero).toHaveLength(3);

      const resultNegative = splitLargeRecipe(recipe, -5);
      expect(resultNegative).toHaveLength(3);
    });

    test("large recipe with 100 ingredients with limit 12 produces 9 sub-recipes all passing DAG", () => {
      const hugeRecipe: SimplifiedRecipe = {
        name: "超特大100品目コース",
        servings: 10,
        ingredients: makeIngredients(100),
      };

      const parts = splitLargeRecipe(hugeRecipe, 12);
      expect(parts).toHaveLength(9); // 8 * 12 = 96, 9th has 4
      expect(parts[8].ingredients).toHaveLength(4);

      // All 9 parts convert and satisfy DAG
      for (const part of parts) {
        const converted = convertInventiaToCho(part, {});
        const dag = validateRecipeDag(converted.dishPayload.recipe);
        expect(dag.success).toBe(true);
      }
    });

    test("recipe with completely undefined phases retains undefined phases in split sub-recipes", () => {
      const recipe: SimplifiedRecipe = {
        name: "フェーズ未定義レシピ",
        servings: 2,
        ingredients: makeIngredients(15),
      };

      const parts = splitLargeRecipe(recipe, 10);
      expect(parts).toHaveLength(2);
      expect(parts[0].phases).toBeUndefined();
      expect(parts[1].phases).toBeUndefined();

      // Auto-generation still activates upon conversion
      const conv1 = convertInventiaToCho(parts[0], {});
      const conv2 = convertInventiaToCho(parts[1], {});
      expect(conv1.dishPayload.recipe.steps).toHaveLength(4);
      expect(conv2.dishPayload.recipe.steps).toHaveLength(4);
      expect(validateRecipeDag(conv1.dishPayload.recipe).success).toBe(true);
      expect(validateRecipeDag(conv2.dishPayload.recipe).success).toBe(true);
    });
  });

  // =========================================================================
  // Challenge 3: Workspace Fixtures Inspection & Deep Validation
  // =========================================================================
  describe("Challenge 3: Workspace Fixtures Inspection (recipe_payload_4step.json & ingredient_map.json)", () => {
    test("fixture files physically exist at workspace root", () => {
      expect(
        existsSync(fixturePayloadPath),
        `Fixture recipe_payload_4step.json must exist at ${fixturePayloadPath}`,
      ).toBe(true);
      expect(
        existsSync(fixtureMapPath),
        `Fixture ingredient_map.json must exist at ${fixtureMapPath}`,
      ).toBe(true);
    });

    test("ingredient_map.json is structurally valid, has exactly 12 non-empty string mappings", () => {
      const rawMap = readFileSync(fixtureMapPath, "utf8");
      const parsed = JSON.parse(rawMap);

      expect(typeof parsed).toBe("object");
      expect(parsed).not.toBeNull();
      const entries = Object.entries(parsed);
      expect(entries).toHaveLength(12);

      const expectedNames = [
        "玉ねぎ",
        "マカロニ",
        "牛乳",
        "有塩バター",
        "ピザ用チーズ",
        "小麦粉",
        "顆粒コンソメ",
        "食塩",
        "黒こしょう",
        "ナツメグ",
        "オリーブオイル",
        "パセリ",
      ];

      for (const name of expectedNames) {
        expect(parsed[name], `Missing ingredient "${name}" in ingredient_map.json`).toBeDefined();
        expect(typeof parsed[name]).toBe("string");
        expect(parsed[name].trim().length).toBeGreaterThan(0);
      }
    });

    test("recipe_payload_4step.json strictly conforms to dishSchema and validateRecipeDag with 0 errors", () => {
      const rawPayload = readFileSync(fixturePayloadPath, "utf8");
      const payload = JSON.parse(rawPayload);

      // Basic attributes
      expect(payload.name).toBe("オニオングラタン 4-step");
      expect(payload.category).toBe("main");
      expect(payload.servings).toBe(2);
      expect(payload.recipe).toBeDefined();

      // 12 ingredients
      expect(payload.recipe.ingredients).toHaveLength(12);

      // 4 steps
      expect(payload.recipe.steps).toHaveLength(4);
      const stepIds = payload.recipe.steps.map((s: { id: string }) => s.id);
      expect(stepIds).toEqual(["step-prep", "step-cook", "step-assemble", "step-finish"]);

      // DAG validation
      const dagCheck = validateRecipeDag(payload.recipe);
      expect(
        dagCheck.success,
        `recipe_payload_4step.json DAG errors: ${dagCheck.errors.join(", ")}`,
      ).toBe(true);
      expect(dagCheck.errors).toHaveLength(0);

      // dishSchema validation (assigning synthetic UUID for top-level dish)
      const mockDish = {
        id: "fixture-validation-uuid",
        ...payload,
        totalNutrition: null,
        totalCostYen: null,
        coverImageId: null,
        notes: payload.notes ?? null,
      };
      const schemaResult = dishSchema.safeParse(mockDish);
      expect(
        schemaResult.success,
        `dishSchema validation failed: ${JSON.stringify(schemaResult.error)}`,
      ).toBe(true);
    });

    test("bijective cross-mapping: 100% agreement between recipe_payload_4step.json and ingredient_map.json", () => {
      const rawPayload = readFileSync(fixturePayloadPath, "utf8");
      const payload = JSON.parse(rawPayload);
      const rawMap = readFileSync(fixtureMapPath, "utf8");
      const map = JSON.parse(rawMap) as Record<string, string>;

      const recipeIngredients = payload.recipe.ingredients as Array<{
        id: string;
        ingredientId: string;
        name: string;
        amount: number;
        unit: string;
      }>;

      expect(recipeIngredients).toHaveLength(12);
      expect(Object.keys(map)).toHaveLength(12);

      // Check 1: Every recipe ingredient matches map entry
      for (const ing of recipeIngredients) {
        const mappedId = map[ing.name];
        expect(mappedId, `Ingredient "${ing.name}" in recipe must exist in map`).toBeDefined();
        expect(
          mappedId,
          `Ingredient ID mismatch for "${ing.name}": expected ${mappedId}, got ${ing.ingredientId}`,
        ).toBe(ing.ingredientId);
      }

      // Check 2: Every map entry is represented in recipe ingredients
      const recipeNames = new Set(recipeIngredients.map((i) => i.name));
      for (const mapName of Object.keys(map)) {
        expect(
          recipeNames.has(mapName),
          `Map key "${mapName}" must exist in recipe ingredients`,
        ).toBe(true);
      }
    });

    test("intermediate pipeline integrity in recipe_payload_4step.json", () => {
      const rawPayload = readFileSync(fixturePayloadPath, "utf8");
      const payload = JSON.parse(rawPayload);
      const steps = payload.recipe.steps;

      // Step 1: prep -> outputs "out-prep-done"
      expect(steps[0].id).toBe("step-prep");
      expect(steps[0].outputs[0].id).toBe("out-prep-done");

      // Step 2: cook -> takes "out-prep-done" from "step-prep", outputs "out-sauce-done"
      expect(steps[1].id).toBe("step-cook");
      const step2Intermediates = steps[1].inputs.filter(
        (i: { type: string }) => i.type === "intermediate",
      );
      expect(step2Intermediates).toHaveLength(1);
      expect(step2Intermediates[0].fromStepId).toBe("step-prep");
      expect(step2Intermediates[0].outputId).toBe("out-prep-done");
      expect(steps[1].outputs[0].id).toBe("out-sauce-done");

      // Step 3: assemble -> takes "out-sauce-done" from "step-cook", outputs "out-assembled"
      expect(steps[2].id).toBe("step-assemble");
      const step3Intermediates = steps[2].inputs.filter(
        (i: { type: string }) => i.type === "intermediate",
      );
      expect(step3Intermediates).toHaveLength(1);
      expect(step3Intermediates[0].fromStepId).toBe("step-cook");
      expect(step3Intermediates[0].outputId).toBe("out-sauce-done");
      expect(steps[2].outputs[0].id).toBe("out-assembled");

      // Step 4: finish -> takes "out-assembled" from "step-assemble", outputs "out-finished"
      expect(steps[3].id).toBe("step-finish");
      const step4Intermediates = steps[3].inputs.filter(
        (i: { type: string }) => i.type === "intermediate",
      );
      expect(step4Intermediates).toHaveLength(1);
      expect(step4Intermediates[0].fromStepId).toBe("step-assemble");
      expect(step4Intermediates[0].outputId).toBe("out-assembled");
      expect(steps[3].outputs[0].id).toBe("out-finished");
    });

    test("ingredient ratio conservation: each of 12 ingredients has total consumption ratio sum == 1.0", () => {
      const rawPayload = readFileSync(fixturePayloadPath, "utf8");
      const payload = JSON.parse(rawPayload);

      const ratioTotals: Record<string, number> = {};
      for (const ing of payload.recipe.ingredients) {
        ratioTotals[ing.id] = 0;
      }

      for (const step of payload.recipe.steps) {
        for (const input of step.inputs) {
          if (input.type === "ingredient") {
            expect(ratioTotals[input.ingredientEntryId]).toBeDefined();
            ratioTotals[input.ingredientEntryId] += input.amountRatio;
          }
        }
      }

      for (const [entryId, total] of Object.entries(ratioTotals)) {
        expect(total, `Ingredient entry ${entryId} ratio sum must be exactly 1.0`).toBe(1);
      }
    });
  });

  // =========================================================================
  // Challenge 4: End-to-End D1 Submission of Workspace Fixture
  // =========================================================================
  describe("Challenge 4: End-to-End Fixture D1 Registration with enforceVariableLimit: true", () => {
    test("recipe_payload_4step.json inserts cleanly via MCP create_recipe without D1 variable limit overflow", async () => {
      const harness = createTestD1Harness({ enforceVariableLimit: true });
      try {
        const { secret } = await harness.issueToken();

        // Load workspace fixtures
        const rawPayload = readFileSync(fixturePayloadPath, "utf8");
        const payload = JSON.parse(rawPayload);
        const rawMap = readFileSync(fixtureMapPath, "utf8");
        const map = JSON.parse(rawMap) as Record<string, string>;

        // 1. Seed the 12 ingredients into SQLite D1 database matching the IDs in ingredient_map.json
        const validNutritionJson = JSON.stringify({
          caloriesKcal: 100,
          proteinG: 2,
          fatG: 1,
          carbohydrateG: 15,
          fiberG: 1,
          saltEquivalentG: 0.1,
          micronutrients: [],
        });

        for (const [name, id] of Object.entries(map)) {
          harness.sqlite.exec(`
						INSERT INTO ingredients (
							id, name, normalized_name, base_dimension, base_unit,
							nutrition_basis_amount, nutrition_json, gram_per_unit, memo,
							created_at, updated_at
						) VALUES (
							'${id}', '${name}', '${name.toLowerCase()}', 'mass', 'g',
							100, '${validNutritionJson}', 1.0, 'fixture seed',
							datetime('now'), datetime('now')
						)
					`);
        }

        // 2. Submit recipe_payload_4step.json directly to MCP create_recipe
        const createRes = await harness.callMcp(secret, "create_recipe", payload);

        expect(
          createRes.response.status,
          `create_recipe failed with status ${createRes.response.status}: ${JSON.stringify(createRes.body)}`,
        ).toBe(200);
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

        expect(createdDish.recipe.name).toBe("オニオングラタン 4-step");
        expect(createdDish.recipe.recipe.ingredients).toHaveLength(12);
        expect(createdDish.recipe.recipe.steps).toHaveLength(4);

        // 3. Verify retrieval via list_recipes
        const listRes = await harness.callMcp(secret, "list_recipes", {});
        expect(listRes.response.status).toBe(200);
        const listData = z
          .object({
            recipes: z.array(
              z.object({
                id: z.string(),
                name: z.string(),
                recipe: z.object({
                  ingredients: z.array(z.record(z.string(), z.unknown())),
                  steps: z.array(z.record(z.string(), z.unknown())),
                }),
              }),
            ),
          })
          .parse(listRes.body.result?.structuredContent);

        const found = listData.recipes.find((r) => r.id === createdDish.recipe.id);
        expect(found).toBeDefined();
        expect(found?.name).toBe("オニオングラタン 4-step");
        expect(found?.recipe.ingredients).toHaveLength(12);
        expect(found?.recipe.steps).toHaveLength(4);
      } finally {
        harness.cleanup();
      }
    });
  });
});
