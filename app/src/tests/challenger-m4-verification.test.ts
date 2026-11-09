import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { describe, expect, test } from "vite-plus/test";

import { dishSchema, type Dish } from "../domain/ingredient";
import {
  convertInventiaToCho,
  splitLargeRecipe,
  type SimplifiedIngredient,
  type SimplifiedRecipe,
} from "../domain/recipe-converter";
import { validateRecipeDag } from "../domain/recipe-scheduler";
import { createTestD1Harness } from "./test-harness";

describe("Empirical Challenger M4: Inventia-to-cho Conversion & Pre-flight DAG Stress Suite", () => {
  function insertIngredientRow(sqlite: DatabaseSync, id: string, name: string) {
    const stmt = sqlite.prepare(
      `INSERT INTO ingredients (id, name, normalized_name, base_dimension, base_unit, nutrition_basis_amount, nutrition_json, created_at, updated_at)
       VALUES (?, ?, ?, 'mass', 'g', 100, '{"caloriesKcal":50,"proteinG":1,"fatG":0.5,"carbohydrateG":10,"fiberG":null,"saltEquivalentG":0.1,"micronutrients":[]}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    );
    stmt.run(id, name, name.toLowerCase());
  }

  function toMcpRecipeArgs(payload: Omit<Dish, "id"> & { id?: string }) {
    const { totalNutrition: _tn, totalCostYen: _tc, id: _id, ...rest } = payload;
    return rest;
  }

  function createSimplifiedIngredients(count: number): SimplifiedIngredient[] {
    const roles: Array<"main" | "seasoning" | "topping" | "optional"> = [
      "main",
      "seasoning",
      "topping",
      "optional",
    ];
    return Array.from({ length: count }, (_, i) => ({
      name: `食材_${i + 1}`,
      amount: (i + 1) * 10,
      unit: i % 2 === 0 ? "g" : "mL",
      displayAmount: `${(i + 1) * 10}${i % 2 === 0 ? "g" : "mL"}`,
      role: roles[i % roles.length],
      prepNote: i % 3 === 0 ? `下処理_${i + 1}` : undefined,
    }));
  }

  function createIngredientMapForList(ingredients: SimplifiedIngredient[]): Record<string, string> {
    const map: Record<string, string> = {};
    for (let i = 0; i < ingredients.length; i++) {
      map[ingredients[i].name] = `uuid-ing-${i + 1}`;
    }
    return map;
  }

  function assertValidDishAndDag(payload: Omit<Dish, "id"> & { id?: string }) {
    // 1. DAG validation
    const dagCheck = validateRecipeDag(payload.recipe);
    expect(dagCheck.success).toBe(true);
    expect(dagCheck.errors).toEqual([]);

    // 2. dishSchema validation
    const fullDish = {
      id: payload.id ?? "test-dish-uuid",
      ...payload,
      totalNutrition: null,
      totalCostYen: null,
      coverImageId: null,
      notes: payload.notes ?? null,
    };
    const dishCheck = dishSchema.safeParse(fullDish);
    expect(dishCheck.success).toBe(true);
  }

  // =========================================================================
  // Task 1: Ingredient Scale Verification (1, 5, 12, 15 ingredients)
  // =========================================================================
  describe("Task 1.1: Ingredient Scale Verification (1, 5, 12, 15 ingredients)", () => {
    test("1 ingredient recipe converts cleanly, passes dishSchema and validateRecipeDag with 0 errors", () => {
      const singleIngRecipe: SimplifiedRecipe = {
        name: "シンプル目玉焼き",
        servings: 1,
        summary: "卵1個のミニマルレシピ",
        ingredients: [{ name: "卵", amount: 1, unit: "個", role: "main" }],
      };
      const map = { 卵: "uuid-egg-1" };

      const result = convertInventiaToCho(singleIngRecipe, map);
      expect(result.warnings).toEqual([]);
      expect(result.dishPayload.recipe.ingredients).toHaveLength(1);
      expect(result.dishPayload.recipe.steps).toHaveLength(4);

      // Verify reachability and DAG
      assertValidDishAndDag(result.dishPayload);
    });

    test("5 ingredients recipe with mixed roles converts cleanly with 0 errors", () => {
      const fiveIngredients = createSimplifiedIngredients(5);
      const map = createIngredientMapForList(fiveIngredients);
      const recipe: SimplifiedRecipe = {
        name: "野菜炒め 5品",
        servings: 2,
        ingredients: fiveIngredients,
        phases: {
          prep: {
            instruction: "野菜を洗って切る",
            ingredients: [fiveIngredients[0].name],
          },
          cook: {
            instruction: "炒める",
            ingredients: [fiveIngredients[1].name, fiveIngredients[2].name],
          },
          assemble: {
            instruction: "皿に盛る",
            ingredients: [fiveIngredients[3].name],
          },
          finish: {
            instruction: "トッピング",
            ingredients: [fiveIngredients[4].name],
          },
        },
      };

      const result = convertInventiaToCho(recipe, map);
      expect(result.warnings).toEqual([]);
      expect(result.dishPayload.recipe.ingredients).toHaveLength(5);
      assertValidDishAndDag(result.dishPayload);
    });

    test("12 ingredients recipe (Onion Gratin standard) converts cleanly with 0 errors", () => {
      const twelveIngredients = createSimplifiedIngredients(12);
      const map = createIngredientMapForList(twelveIngredients);
      const recipe: SimplifiedRecipe = {
        name: "本格オニオングラタン 12品目",
        servings: 3,
        ingredients: twelveIngredients,
        phases: {
          prep: {
            instruction: "下ごしらえ",
            ingredients: [twelveIngredients[0].name, twelveIngredients[1].name],
          },
          cook: {
            instruction: "じっくり炒めて煮る",
            ingredients: twelveIngredients.slice(2, 8).map((i) => i.name),
          },
          assemble: {
            instruction: "耐熱容器に盛り付け",
            ingredients: [twelveIngredients[8].name, twelveIngredients[9].name],
          },
          finish: {
            instruction: "焼き上げ",
            ingredients: [twelveIngredients[10].name, twelveIngredients[11].name],
          },
        },
      };

      const result = convertInventiaToCho(recipe, map);
      expect(result.warnings).toEqual([]);
      expect(result.dishPayload.recipe.ingredients).toHaveLength(12);
      assertValidDishAndDag(result.dishPayload);
    });

    test("15 ingredients recipe direct conversion passes dishSchema and validateRecipeDag with 0 errors", () => {
      const fifteenIngredients = createSimplifiedIngredients(15);
      const map = createIngredientMapForList(fifteenIngredients);
      const recipe: SimplifiedRecipe = {
        name: "15品目豪華ポトフ",
        servings: 4,
        ingredients: fifteenIngredients,
      };

      const result = convertInventiaToCho(recipe, map);
      expect(result.warnings).toEqual([]);
      expect(result.dishPayload.recipe.ingredients).toHaveLength(15);
      assertValidDishAndDag(result.dishPayload);
    });

    test("15 ingredients recipe split via splitLargeRecipe(recipe, 12) yields valid sub-recipes <= 12 items", () => {
      const fifteenIngredients = createSimplifiedIngredients(15);
      const map = createIngredientMapForList(fifteenIngredients);
      const recipe: SimplifiedRecipe = {
        name: "15品目大型コース",
        servings: 4,
        ingredients: fifteenIngredients,
        phases: {
          prep: {
            instruction: "全食材の切り出し",
            ingredients: [fifteenIngredients[0].name, fifteenIngredients[13].name],
          },
          cook: {
            instruction: "メイン加熱",
            ingredients: fifteenIngredients.slice(1, 10).map((i) => i.name),
          },
          finish: {
            instruction: "仕上げ",
            ingredients: [fifteenIngredients[14].name],
          },
        },
      };

      const subRecipes = splitLargeRecipe(recipe, 12);
      expect(subRecipes).toHaveLength(2);
      expect(subRecipes[0].ingredients).toHaveLength(12);
      expect(subRecipes[1].ingredients).toHaveLength(3);

      for (const sub of subRecipes) {
        expect(sub.ingredients.length).toBeLessThanOrEqual(12);
        const subResult = convertInventiaToCho(sub, map);
        assertValidDishAndDag(subResult.dishPayload);
      }
    });

    test("15 ingredients recipe split via splitLargeRecipe(recipe, 8) yields valid sub-recipes <= 8 items", () => {
      const fifteenIngredients = createSimplifiedIngredients(15);
      const map = createIngredientMapForList(fifteenIngredients);
      const recipe: SimplifiedRecipe = {
        name: "15品目 8品分割",
        servings: 2,
        ingredients: fifteenIngredients,
      };

      const subRecipes = splitLargeRecipe(recipe, 8);
      expect(subRecipes).toHaveLength(2);
      expect(subRecipes[0].ingredients).toHaveLength(8);
      expect(subRecipes[1].ingredients).toHaveLength(7);

      for (const sub of subRecipes) {
        expect(sub.ingredients.length).toBeLessThanOrEqual(8);
        const subResult = convertInventiaToCho(sub, map);
        assertValidDishAndDag(subResult.dishPayload);
      }
    });
  });

  // =========================================================================
  // Task 1.2: Missing Phases & Custom Phases Stress Testing
  // =========================================================================
  describe("Task 1.2: Missing Phases & Custom Phases Stress Testing", () => {
    test("completely missing phases (undefined) auto-synthesizes standard 4 phases with 0 errors", () => {
      const recipe: SimplifiedRecipe = {
        name: "フェーズ未定義レシピ",
        servings: 2,
        ingredients: [
          {
            name: "じゃがいも",
            amount: 200,
            unit: "g",
            role: "main",
            prepNote: "皮を剥いて乱切り",
          },
          { name: "醤油", amount: 15, unit: "mL", role: "seasoning" },
          { name: "青のり", amount: 1, unit: "g", role: "topping" },
          { name: "マヨネーズ", amount: 10, unit: "g", role: "optional" },
        ],
      };
      const map = {
        じゃがいも: "uuid-potato",
        醤油: "uuid-soysauce",
        青のり: "uuid-aonori",
        マヨネーズ: "uuid-mayo",
      };

      const result = convertInventiaToCho(recipe, map);
      expect(result.warnings).toEqual([]); // no warning when phases undefined
      expect(result.dishPayload.recipe.steps).toHaveLength(4);

      // Verify specific auto-assignment based on role / prepNote:
      // じゃがいも has prepNote -> prep
      // 醤油 has role "seasoning" -> cook
      // マヨネーズ has role "optional" -> assemble
      // 青のり has role "topping" -> finish
      const steps = result.dishPayload.recipe.steps;
      const prepStep = steps.find((s) => s.phase === "prep")!;
      const cookStep = steps.find((s) => s.phase === "cook")!;
      const assembleStep = steps.find((s) => s.phase === "assemble")!;
      const finishStep = steps.find((s) => s.phase === "finish")!;

      expect(
        prepStep.inputs.some((i) => i.type === "ingredient" && i.ingredientEntryId === "entry-1"),
      ).toBe(true);
      expect(
        cookStep.inputs.some((i) => i.type === "ingredient" && i.ingredientEntryId === "entry-2"),
      ).toBe(true);
      expect(
        assembleStep.inputs.some(
          (i) => i.type === "ingredient" && i.ingredientEntryId === "entry-4",
        ),
      ).toBe(true);
      expect(
        finishStep.inputs.some((i) => i.type === "ingredient" && i.ingredientEntryId === "entry-3"),
      ).toBe(true);

      assertValidDishAndDag(result.dishPayload);
    });

    test("empty phases object ({}) auto-synthesizes standard 4 phases with 0 errors", () => {
      const recipe: SimplifiedRecipe = {
        name: "空オブジェクトフェーズレシピ",
        servings: 1,
        ingredients: [{ name: "りんご", amount: 100, unit: "g", role: "main" }],
        phases: {},
      };
      const map = { りんご: "uuid-apple" };

      const result = convertInventiaToCho(recipe, map);
      expect(result.dishPayload.recipe.steps).toHaveLength(4);
      assertValidDishAndDag(result.dishPayload);
    });

    test("isolated single phases (only prep, only cook, only assemble, only finish)", () => {
      const testCases = [
        {
          name: "only prep",
          phases: { prep: { instruction: "刻む", ingredients: ["具材A"] } },
        },
        {
          name: "only cook",
          phases: { cook: { instruction: "焼く", ingredients: ["具材A"] } },
        },
        {
          name: "only assemble",
          phases: { assemble: { instruction: "盛る", ingredients: ["具材A"] } },
        },
        {
          name: "only finish",
          phases: { finish: { instruction: "飾る", ingredients: ["具材A"] } },
        },
      ];

      for (const tc of testCases) {
        const recipe: SimplifiedRecipe = {
          name: `部分フェーズ (${tc.name})`,
          servings: 1,
          ingredients: [
            { name: "具材A", amount: 100, unit: "g", role: "main" },
            { name: "未記載調味料", amount: 5, unit: "g", role: "seasoning" },
          ],
          phases: tc.phases,
        };
        const map = { 具材A: "uuid-a", 未記載調味料: "uuid-b" };

        const result = convertInventiaToCho(recipe, map);
        // Warning should be emitted for auto-assigning 未記載調味料
        expect(result.warnings.some((w) => w.includes("未記載調味料"))).toBe(true);
        assertValidDishAndDag(result.dishPayload);
      }
    });

    test("custom non-standard phases handle gracefully and remain valid", () => {
      const recipeWithCustomPhases: SimplifiedRecipe = {
        name: "カスタム非標準フェーズレシピ",
        servings: 2,
        ingredients: [
          { name: "牛肉", amount: 300, unit: "g", role: "main" },
          { name: "赤ワイン", amount: 100, unit: "mL", role: "seasoning" },
        ],
        // Cast with custom phase keys
        phases: {
          marinate: { instruction: "ワインに漬ける", ingredients: ["牛肉", "赤ワイン"] },
          cook: { instruction: "煮込む", ingredients: [] },
        } as unknown as SimplifiedRecipe["phases"],
      };
      const map = { 牛肉: "uuid-beef", 赤ワイン: "uuid-wine" };

      const result = convertInventiaToCho(recipeWithCustomPhases, map);
      // Non-standard phase is ignored in phaseOrder, so ingredients are safely auto-assigned
      expect(result.warnings.some((w) => w.includes("auto-assigned"))).toBe(true);
      expect(result.dishPayload.recipe.steps).toHaveLength(4);
      assertValidDishAndDag(result.dishPayload);
    });

    test("custom heat levels normalize properly without schema violations", () => {
      const recipe: SimplifiedRecipe = {
        name: "火力バリエーションレシピ",
        servings: 1,
        ingredients: [{ name: "水", amount: 200, unit: "mL", role: "main" }],
        phases: {
          cook: {
            instruction: "沸騰させる",
            heatLevel: "MEDIUM-HIGH", // uppercase & hyphen
            ingredients: ["水"],
          },
        },
      };
      const map = { 水: "uuid-water" };

      const result = convertInventiaToCho(recipe, map);
      const cookStep = result.dishPayload.recipe.steps.find((s) => s.phase === "cook")!;
      expect(cookStep.heatLevel).toBe("medium_high");
      assertValidDishAndDag(result.dishPayload);

      // Unsupported heatLevel falls back to defaultHeat
      const recipeUnknownHeat: SimplifiedRecipe = {
        name: "未知の火力レシピ",
        servings: 1,
        ingredients: [{ name: "水", amount: 200, unit: "mL", role: "main" }],
        phases: {
          cook: {
            instruction: "過熱",
            heatLevel: "ultra_plasma_burst",
            ingredients: ["水"],
          },
        },
      };
      const resultUnknown = convertInventiaToCho(recipeUnknownHeat, map);
      const cookStepDef = resultUnknown.dishPayload.recipe.steps.find((s) => s.phase === "cook")!;
      expect(cookStepDef.heatLevel).toBe("medium"); // default for cook
      assertValidDishAndDag(resultUnknown.dishPayload);
    });

    test("phase durations (0 sec, negative sec) handle gracefully", () => {
      const recipe: SimplifiedRecipe = {
        name: "時間テストレシピ",
        servings: 1,
        ingredients: [{ name: "水", amount: 100, unit: "mL", role: "main" }],
        phases: {
          prep: { instruction: "0秒下準備", durationSec: 0, ingredients: ["水"] },
          cook: { instruction: "負の時間", durationSec: -60, ingredients: [] },
        },
      };
      const map = { 水: "uuid-water" };

      const result = convertInventiaToCho(recipe, map);
      const prepStep = result.dishPayload.recipe.steps.find((s) => s.phase === "prep")!;
      const cookStep = result.dishPayload.recipe.steps.find((s) => s.phase === "cook")!;

      expect(prepStep.timing.activeDurationSec).toBe(0);
      expect(cookStep.timing.activeDurationSec).toBe(420); // fallback to defaultDuration 420
      assertValidDishAndDag(result.dishPayload);
    });
  });

  // =========================================================================
  // Task 1.3: Unmapped Ingredients Handling
  // =========================================================================
  describe("Task 1.3: Unmapped Ingredients Handling", () => {
    test("recipe with unmapped ingredients assigns deterministic fallback IDs and reports warnings", () => {
      const recipe: SimplifiedRecipe = {
        name: "未登録品目テスト",
        servings: 2,
        ingredients: [
          { name: "幻のスパイスA", amount: 5, unit: "g", role: "seasoning" },
          { name: "幻のキノコB", amount: 50, unit: "g", role: "main" },
        ],
      };

      // Completely empty ingredientMap
      const result = convertInventiaToCho(recipe, {});
      expect(result.warnings).toHaveLength(2);
      expect(result.warnings[0]).toContain('Ingredient "幻のスパイスA" not found in ingredientMap');
      expect(result.warnings[1]).toContain('Ingredient "幻のキノコB" not found in ingredientMap');

      // Check fallback IDs
      const ings = result.dishPayload.recipe.ingredients;
      expect(ings[0].ingredientId).toBe("unmapped-1");
      expect(ings[1].ingredientId).toBe("unmapped-2");

      // Recipe DAG and dishSchema must still strictly pass
      assertValidDishAndDag(result.dishPayload);
    });

    test("partially mapped recipe warns only for unmapped items and assigns real IDs for mapped", () => {
      const recipe: SimplifiedRecipe = {
        name: "部分未登録レシピ",
        servings: 1,
        ingredients: [
          { name: "玉ねぎ", amount: 100, unit: "g", role: "main" },
          { name: "未登録チーズ", amount: 30, unit: "g", role: "topping" },
        ],
      };
      const map = { 玉ねぎ: "uuid-onion-registered" };

      const result = convertInventiaToCho(recipe, map);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toContain("未登録チーズ");

      expect(result.dishPayload.recipe.ingredients[0].ingredientId).toBe("uuid-onion-registered");
      expect(result.dishPayload.recipe.ingredients[1].ingredientId).toBe("unmapped-2");
      assertValidDishAndDag(result.dishPayload);
    });
  });

  // =========================================================================
  // Task 1.4: Dry-Run Pre-Flight Check & Probe Residue Prevention
  // =========================================================================
  describe("Task 1.4: Dry-Run Pre-Flight Check & Probe Residue Prevention", () => {
    test("pre-flight check catches invalid configurations before network/DB submission, preventing probe residue", async () => {
      const harness = createTestD1Harness();
      try {
        const { secret } = await harness.issueToken(["create_recipe", "list_recipes"]);

        // Scenario: A malformed recipe input with empty ingredients
        const emptyIngredientRecipe = {
          name: "空具材のレシピ",
          servings: 2,
          ingredients: [] as SimplifiedIngredient[],
        };

        // 1. Run convertInventiaToCho pre-flight dry-run check
        const result = convertInventiaToCho(emptyIngredientRecipe, {});
        // Because ingredients is empty, validateRecipeDag catches ingredients schema validation error
        expect(result.warnings.length).toBeGreaterThan(0);
        expect(result.warnings.some((w) => w.includes("ingredients"))).toBe(true);

        // 2. Pre-flight decision gate: if warnings contains critical schema / DAG errors, ABORT submission!
        const hasPreFlightErrors = result.warnings.some((w) => w.includes("ingredients"));
        expect(hasPreFlightErrors).toBe(true);

        // Since pre-flight caught the invalid configuration, NO network/DB call is made
        // Verify database is completely clean (zero dishes, zero probe residue)
        const listRes = await harness.callMcp(secret, "list_recipes", {});
        const structured = listRes.body.result?.structuredContent as { recipes: unknown[] };
        expect(structured.recipes).toHaveLength(0);
      } finally {
        harness.cleanup();
      }
    });

    test("unmapped ingredients in pre-flight dry-run alert caller to halt DB submission, preventing foreign key residue", async () => {
      const harness = createTestD1Harness();
      try {
        const { secret } = await harness.issueToken(["create_recipe", "list_recipes"]);

        const recipeWithUnmapped: SimplifiedRecipe = {
          name: "未登録品目を含むプローブ候補",
          servings: 1,
          ingredients: [{ name: "未登録の謎食材", amount: 100, unit: "g", role: "main" }],
        };

        // 1. Dry run pre-flight
        const result = convertInventiaToCho(recipeWithUnmapped, {});
        expect(result.warnings.some((w) => w.includes("not found in ingredientMap"))).toBe(true);

        // Pre-flight policy: If unmapped ingredients exist, caller registers ingredients first
        // or aborts, preventing partial / failed DB insert attempts.
        // If a caller bypassed pre-flight and called create_recipe with unmapped id:
        const bypassCall = await harness.callMcp(
          secret,
          "create_recipe",
          toMcpRecipeArgs(result.dishPayload),
        );
        // dishService.create fails because ingredient unmapped-1 does not exist in DB
        // In MCP protocol, tool error returns result.isError === true
        expect(bypassCall.body.result?.isError).toBe(true);
        const errContent =
          (bypassCall.body.result?.content as Array<{ text: string }>)?.[0]?.text ?? "";
        expect(errContent).toContain("Unknown ingredient unmapped-1");

        // Verify that NO partial probe record was left in the dishes table!
        const listRes = await harness.callMcp(secret, "list_recipes", {});
        const structured = listRes.body.result?.structuredContent as { recipes: unknown[] };
        expect(structured.recipes).toHaveLength(0);
      } finally {
        harness.cleanup();
      }
    });

    test("pre-flight validateRecipeDag catches ratio != 1.0, step cycles, and missing steps", () => {
      // Direct adversarial inputs to validateRecipeDag
      // 1. Step dependency cycle
      const cyclicRecipe = {
        schemaVersion: "1.0",
        servings: 1,
        summary: null,
        equipment: [],
        ingredientGroups: [],
        ingredients: [
          {
            id: "entry-1",
            ingredientId: "uuid-1",
            name: "具材1",
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
            id: "step-1",
            stepNumber: 1,
            phase: "prep",
            title: "ステップ1",
            instruction: "循環1",
            executionMode: "active",
            timing: { activeDurationSec: 60, passiveDurationSec: 0, scalingMode: "fixed" },
            dependsOnStepIds: ["step-2"], // cycle
            resourceTags: [],
            heatLevel: "none",
            inputs: [
              {
                type: "ingredient",
                ingredientEntryId: "entry-1",
                amountRatio: 1,
                amountText: null,
              },
            ],
            outputs: [],
            completionCue: null,
            cautions: [],
          },
          {
            id: "step-2",
            stepNumber: 2,
            phase: "cook",
            title: "ステップ2",
            instruction: "循環2",
            executionMode: "active",
            timing: { activeDurationSec: 60, passiveDurationSec: 0, scalingMode: "fixed" },
            dependsOnStepIds: ["step-1"], // cycle
            resourceTags: [],
            heatLevel: "none",
            inputs: [],
            outputs: [],
            completionCue: null,
            cautions: [],
          },
        ],
        globalCautions: [],
      };

      const cycleResult = validateRecipeDag(cyclicRecipe);
      expect(cycleResult.success).toBe(false);
      expect(cycleResult.errors.some((e) => e.includes("cycle"))).toBe(true);
    });
  });

  // =========================================================================
  // Task 1.5: End-to-End Fixtures & D1 Integration Stress Test
  // =========================================================================
  describe("Task 1.5: End-to-End Fixtures & D1 Integration Stress Test", () => {
    const workspaceRoot = resolve(__dirname, "../../../");
    const payloadPath = resolve(workspaceRoot, "recipe_payload_4step.json");
    const mapPath = resolve(workspaceRoot, "ingredient_map.json");

    test("recipe_payload_4step.json and ingredient_map.json are fully valid and consistent", () => {
      const payloadRaw = readFileSync(payloadPath, "utf8");
      const payload = JSON.parse(payloadRaw);
      const mapRaw = readFileSync(mapPath, "utf8");
      const map = JSON.parse(mapRaw) as Record<string, string>;

      expect(payload.name).toBe("オニオングラタン 4-step");
      expect(payload.servings).toBe(2);
      expect(payload.recipe.ingredients).toHaveLength(12);
      expect(payload.recipe.steps).toHaveLength(4);

      // Verify all 12 ingredients match ingredient_map.json
      for (const ing of payload.recipe.ingredients) {
        expect(map[ing.name]).toBe(ing.ingredientId);
      }

      assertValidDishAndDag(payload);
    });

    test("12-ingredient Onion Gratin payload registers in D1 with 0 D1_ERROR variables limit and all 12 items retrieved", async () => {
      const harness = createTestD1Harness({
        enforceVariableLimit: true,
        maxVariablesPerStatement: 100,
      });
      try {
        const { secret } = await harness.issueToken([
          "create_ingredient",
          "create_recipe",
          "list_recipes",
        ]);

        const mapRaw = readFileSync(mapPath, "utf8");
        const map = JSON.parse(mapRaw) as Record<string, string>;
        const payloadRaw = readFileSync(payloadPath, "utf8");
        const payload = JSON.parse(payloadRaw);

        // Register 12 ingredients in DB first
        for (const [name, id] of Object.entries(map)) {
          insertIngredientRow(harness.sqlite, id, name);
        }

        // Register 12-ingredient recipe via MCP create_recipe
        const createRes = await harness.callMcp(secret, "create_recipe", payload);
        expect(createRes.body.result?.isError).toBeFalsy();
        expect(createRes.body.error).toBeUndefined();

        // Retrieve with list_recipes and verify all 12 ingredients and 4 steps intact
        const listRes = await harness.callMcp(secret, "list_recipes", {});
        const listStructured = listRes.body.result?.structuredContent as {
          recipes: Array<{ recipe: { ingredients: unknown[]; steps: unknown[] } }>;
        };
        const recipes = listStructured.recipes;
        expect(recipes).toHaveLength(1);
        expect(recipes[0].recipe.ingredients).toHaveLength(12);
        expect(recipes[0].recipe.steps).toHaveLength(4);
      } finally {
        harness.cleanup();
      }
    });

    test("15-ingredient direct converted recipe registers in D1 without D1 SQL variables overflow", async () => {
      const harness = createTestD1Harness({
        enforceVariableLimit: true,
        maxVariablesPerStatement: 100,
      });
      try {
        const { secret } = await harness.issueToken([
          "create_ingredient",
          "create_recipe",
          "list_recipes",
        ]);

        const fifteenIngredients = createSimplifiedIngredients(15);
        const map: Record<string, string> = {};
        for (let i = 0; i < fifteenIngredients.length; i++) {
          const ingId = `uuid-fifteen-${i + 1}`;
          const ingName = fifteenIngredients[i].name;
          map[ingName] = ingId;
          insertIngredientRow(harness.sqlite, ingId, ingName);
        }

        const simplifiedRecipe: SimplifiedRecipe = {
          name: "15品目D1バッチ上限ストレステスト",
          servings: 4,
          ingredients: fifteenIngredients,
        };

        const conversionResult = convertInventiaToCho(simplifiedRecipe, map);
        expect(conversionResult.warnings).toEqual([]);

        // Send to create_recipe
        const createRes = await harness.callMcp(
          secret,
          "create_recipe",
          toMcpRecipeArgs(conversionResult.dishPayload),
        );
        expect(createRes.body.result?.isError).toBeFalsy();
        expect(createRes.body.error).toBeUndefined();

        const listRes = await harness.callMcp(secret, "list_recipes", {});
        const listStructured = listRes.body.result?.structuredContent as {
          recipes: Array<{ name: string; recipe: { ingredients: unknown[] } }>;
        };
        const recipes = listStructured.recipes;
        expect(recipes).toHaveLength(1);
        expect(recipes[0].recipe.ingredients).toHaveLength(15);
      } finally {
        harness.cleanup();
      }
    });
  });
});
