import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vite-plus/test";
import { dishSchema } from "./ingredient";
import {
  convertInventiaToCho,
  splitLargeRecipe,
  type ConvertInventiaToChoResult,
  type SimplifiedIngredient,
  type SimplifiedPhase,
  type SimplifiedRecipe,
} from "./recipe-converter";
import { validateRecipeDag } from "./recipe-scheduler";

export type { SimplifiedIngredient, SimplifiedPhase, SimplifiedRecipe, ConvertInventiaToChoResult };

describe("R4: Inventia to cho Recipe Converter & Splitter (recipe-converter.ts)", () => {
  const sampleIngredientMap: Record<string, string> = {
    玉ねぎ: "uuid-onion",
    マカロニ: "uuid-macaroni",
    牛乳: "uuid-milk",
    有塩バター: "uuid-butter",
    ピザ用チーズ: "uuid-cheese",
    小麦粉: "uuid-flour",
    顆粒コンソメ: "uuid-consomme",
    食塩: "uuid-salt",
    黒こしょう: "uuid-pepper",
    ナツメグ: "uuid-nutmeg",
    オリーブオイル: "uuid-olive-oil",
    パセリ: "uuid-parsley",
  };

  const sampleSimplifiedRecipe: SimplifiedRecipe = {
    name: "オニオングラタン 簡易版",
    category: "main",
    servings: 2,
    summary: "Inventia連携テンプレートから生成するグラタン",
    equipment: ["フライパン", "耐熱皿", "オーブントースター"],
    ingredients: [
      {
        name: "玉ねぎ",
        amount: 200,
        unit: "g",
        displayAmount: "1個 (200g)",
        role: "main",
        prepNote: "薄切り",
      },
      { name: "マカロニ", amount: 100, unit: "g", displayAmount: "100g", role: "main" },
      { name: "食塩", amount: 2, unit: "g", displayAmount: "2g", role: "seasoning" },
      { name: "有塩バター", amount: 20, unit: "g", displayAmount: "20g", role: "main" },
      { name: "小麦粉", amount: 20, unit: "g", displayAmount: "20g", role: "main" },
      { name: "牛乳", amount: 350, unit: "mL", displayAmount: "350mL", role: "main" },
      { name: "顆粒コンソメ", amount: 5, unit: "g", displayAmount: "5g", role: "seasoning" },
      {
        name: "黒こしょう",
        amount: 0.5,
        unit: "g",
        displayAmount: "0.5g",
        role: "seasoning",
      },
      { name: "ナツメグ", amount: 0.2, unit: "g", displayAmount: "0.2g", role: "seasoning" },
      { name: "ピザ用チーズ", amount: 50, unit: "g", displayAmount: "50g", role: "topping" },
      {
        name: "オリーブオイル",
        amount: 10,
        unit: "g",
        displayAmount: "10g",
        role: "topping",
      },
      { name: "パセリ", amount: 1, unit: "g", displayAmount: "1g", role: "topping" },
    ],
    phases: {
      prep: {
        instruction: "玉ねぎをスライスし、マカロニを塩茹でする。",
        durationSec: 300,
        ingredients: ["玉ねぎ", "マカロニ", "食塩"],
      },
      cook: {
        instruction: "フライパンでバターを熱し、小麦粉・牛乳・コンソメ・こしょう・ナツメグを煮る。",
        durationSec: 420,
        heatLevel: "medium",
        ingredients: ["有塩バター", "小麦粉", "牛乳", "顆粒コンソメ", "黒こしょう", "ナツメグ"],
      },
      assemble: {
        instruction: "耐熱皿に合わせ、チーズとオリーブオイルをかける。",
        durationSec: 120,
        ingredients: ["ピザ用チーズ", "オリーブオイル"],
      },
      finish: {
        instruction: "オーブントースターで焼き上げ、パセリを振る。",
        durationSec: 300,
        heatLevel: "high",
        ingredients: ["パセリ"],
      },
    },
  };

  test("converts simplified Inventia recipe to valid cho DAG recipe satisfying dishSchema", () => {
    const result = convertInventiaToCho(sampleSimplifiedRecipe, sampleIngredientMap);
    expect(result).toBeDefined();
    expect(result.warnings).toEqual([]);

    const payload = result.dishPayload;
    expect(payload.name).toBe("オニオングラタン 簡易版");
    expect(payload.recipe.ingredients).toHaveLength(12);

    // Every ingredient mapped to proper UUID from ingredientMap
    for (const ing of payload.recipe.ingredients) {
      expect(ing.ingredientId).toBe(sampleIngredientMap[ing.name]);
      expect(ing.ingredientId).not.toBe("");
    }

    // Recipe must pass DAG validation
    const dagCheck = validateRecipeDag(payload.recipe);
    expect(dagCheck.success).toBe(true);
    expect(dagCheck.errors).toEqual([]);

    // Must satisfy dishSchema
    const fullDish = {
      id: "converted-dish-uuid",
      ...payload,
      totalNutrition: null,
      totalCostYen: null,
      coverImageId: null,
      notes: payload.notes ?? null,
    };
    const dishCheck = dishSchema.safeParse(fullDish);
    expect(dishCheck.success).toBe(true);
  });

  test("emits warnings when recipe contains unmapped ingredients", () => {
    // Provide an empty ingredientMap
    const result = convertInventiaToCho(sampleSimplifiedRecipe, {});
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings.some((w) => w.includes("玉ねぎ"))).toBe(true);
    // Pre-flight DAG check still passes with assigned placeholder IDs
    const dagCheck = validateRecipeDag(result.dishPayload.recipe);
    expect(dagCheck.success).toBe(true);
  });

  test("auto-generates standard 4-phase DAG when phases are completely omitted", () => {
    const recipeWithoutPhases: SimplifiedRecipe = {
      name: "フェーズ未指定のレシピ",
      servings: 2,
      summary: "材料のみ指定された簡易レシピ",
      ingredients: [
        { name: "玉ねぎ", amount: 200, unit: "g", role: "main", prepNote: "みじん切り" },
        { name: "牛乳", amount: 200, unit: "mL", role: "main" },
        { name: "食塩", amount: 2, unit: "g", role: "seasoning" },
        { name: "パセリ", amount: 1, unit: "g", role: "topping" },
      ],
    };

    const result = convertInventiaToCho(recipeWithoutPhases, sampleIngredientMap);
    expect(result.dishPayload.recipe.steps).toHaveLength(4);

    // Every ingredient used in steps
    const dagCheck = validateRecipeDag(result.dishPayload.recipe);
    expect(dagCheck.success).toBe(true);
    expect(dagCheck.errors).toEqual([]);

    const fullDish = {
      id: "auto-phase-dish",
      ...result.dishPayload,
      totalNutrition: null,
      totalCostYen: null,
      coverImageId: null,
      notes: result.dishPayload.notes ?? null,
    };
    expect(dishSchema.safeParse(fullDish).success).toBe(true);
  });

  test("auto-assigns unlisted ingredients and warns when phases are partially specified", () => {
    const partialPhaseRecipe: SimplifiedRecipe = {
      name: "一部材料のみフェーズ記載",
      servings: 1,
      ingredients: [
        { name: "玉ねぎ", amount: 100, unit: "g", role: "main" },
        { name: "食塩", amount: 2, unit: "g", role: "seasoning" },
        { name: "パセリ", amount: 1, unit: "g", role: "topping" },
      ],
      phases: {
        prep: {
          instruction: "玉ねぎを刻む",
          ingredients: ["玉ねぎ"],
        },
        // cook, assemble, finish omitted, salt and parsley unlisted
      },
    };

    const result = convertInventiaToCho(partialPhaseRecipe, sampleIngredientMap);
    expect(result.warnings.some((w) => w.includes("食塩"))).toBe(true);
    expect(result.warnings.some((w) => w.includes("パセリ"))).toBe(true);

    const dagCheck = validateRecipeDag(result.dishPayload.recipe);
    expect(dagCheck.success).toBe(true);
    expect(dagCheck.errors).toEqual([]);
  });

  test("prevents ratio > 1 when ingredient is duplicated across phases", () => {
    const duplicateIngredientRecipe: SimplifiedRecipe = {
      name: "重複指定レシピ",
      servings: 2,
      ingredients: [{ name: "有塩バター", amount: 20, unit: "g", role: "main" }],
      phases: {
        prep: {
          instruction: "バターを計量",
          ingredients: ["有塩バター"],
        },
        cook: {
          instruction: "バターを溶かす",
          ingredients: ["有塩バター"], // duplicate
        },
      },
    };

    const result = convertInventiaToCho(duplicateIngredientRecipe, sampleIngredientMap);
    expect(result.warnings.some((w) => w.includes("assigned multiple times"))).toBe(true);

    // DAG check verifies ratio sum remains 1.0 (no >1 violation)
    const dagCheck = validateRecipeDag(result.dishPayload.recipe);
    expect(dagCheck.success).toBe(true);
  });

  test("splitLargeRecipe splits 20-ingredient recipe into valid sub-recipes <= maxIngredientsPerDish", () => {
    const twentyIngredients: SimplifiedIngredient[] = Array.from({ length: 20 }, (_, i) => ({
      name: `食材 ${i + 1}`,
      amount: (i + 1) * 10,
      unit: "g",
      role: "main",
    }));

    const largeRecipe: SimplifiedRecipe = {
      name: "超大型20品目フルコース",
      servings: 4,
      ingredients: twentyIngredients,
    };

    const subRecipes = splitLargeRecipe(largeRecipe, 8);
    expect(subRecipes.length).toBeGreaterThanOrEqual(3);

    for (const sub of subRecipes) {
      expect(sub.ingredients.length).toBeLessThanOrEqual(8);
      expect(sub.servings).toBe(4);
      expect(sub.name).toContain("超大型20品目フルコース");

      // Each sub-recipe can be converted to cho and passes DAG validation
      const subResult = convertInventiaToCho(sub, {});
      const dagCheck = validateRecipeDag(subResult.dishPayload.recipe);
      expect(dagCheck.success).toBe(true);
    }

    // Sum of ingredients across sub-recipes equals original 20
    const totalIngredients = subRecipes.reduce((sum, sub) => sum + sub.ingredients.length, 0);
    expect(totalIngredients).toBe(20);
  });

  test("splitLargeRecipe preserves single recipe when ingredients <= maxIngredientsPerDish", () => {
    const smallRecipe: SimplifiedRecipe = {
      name: "小型レシピ",
      servings: 2,
      ingredients: [
        { name: "玉ねぎ", amount: 100, unit: "g", role: "main" },
        { name: "牛乳", amount: 100, unit: "mL", role: "main" },
      ],
    };

    const subRecipes = splitLargeRecipe(smallRecipe, 12);
    expect(subRecipes).toHaveLength(1);
    expect(subRecipes[0].name).toBe("小型レシピ");
    expect(subRecipes[0].ingredients).toHaveLength(2);
  });

  // =========================================================================
  // Verification of Fixtures: recipe_payload_4step.json & ingredient_map.json
  // =========================================================================
  describe("Fixtures Verification (recipe_payload_4step.json & ingredient_map.json)", () => {
    const workspaceRoot = resolve(__dirname, "../../../");
    const payloadPath = resolve(workspaceRoot, "recipe_payload_4step.json");
    const mapPath = resolve(workspaceRoot, "ingredient_map.json");

    test("workspace files exist on disk", () => {
      expect(existsSync(payloadPath), "recipe_payload_4step.json must exist").toBe(true);
      expect(existsSync(mapPath), "ingredient_map.json must exist").toBe(true);
    });

    test("ingredient_map.json is valid and maps 12 onion gratin ingredients to non-empty IDs", () => {
      const raw = readFileSync(mapPath, "utf8");
      const map = JSON.parse(raw) as Record<string, string>;

      expect(Object.keys(map)).toHaveLength(12);
      const expectedKeys = [
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

      for (const key of expectedKeys) {
        expect(map[key]).toBeDefined();
        expect(typeof map[key]).toBe("string");
        expect(map[key].trim().length).toBeGreaterThan(0);
      }
    });

    test("recipe_payload_4step.json is valid, conforms to dishSchema, and passes validateRecipeDag", () => {
      const rawPayload = readFileSync(payloadPath, "utf8");
      const payload = JSON.parse(rawPayload);
      const rawMap = readFileSync(mapPath, "utf8");
      const map = JSON.parse(rawMap) as Record<string, string>;

      expect(payload.name).toBe("オニオングラタン 4-step");
      expect(payload.servings).toBe(2);
      expect(payload.recipe.ingredients).toHaveLength(12);
      expect(payload.recipe.steps).toHaveLength(4);

      // All 12 ingredients must match ingredient_map.json
      for (const ing of payload.recipe.ingredients) {
        expect(map[ing.name]).toBe(ing.ingredientId);
      }

      // Recipe must pass DAG validation with 0 errors
      const dagCheck = validateRecipeDag(payload.recipe);
      expect(dagCheck.success).toBe(true);
      expect(dagCheck.errors).toEqual([]);

      // Top-level payload satisfies dishSchema (with an id)
      const fullDish = {
        id: "fixture-onion-gratin-4step-id",
        ...payload,
        totalNutrition: null,
        totalCostYen: null,
        coverImageId: null,
        notes: payload.notes ?? null,
      };
      const dishCheck = dishSchema.safeParse(fullDish);
      expect(dishCheck.success).toBe(true);
    });
  });
});
