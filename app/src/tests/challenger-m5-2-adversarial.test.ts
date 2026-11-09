import { describe, expect, test } from "vite-plus/test";
import { dishSchema, type Ingredient } from "../domain/ingredient";
import { calculatePurchaseList } from "../domain/purchase-list";
import { convertInventiaToCho, splitLargeRecipe } from "../domain/recipe-converter";
import { validateRecipeDag } from "../domain/recipe-scheduler";
import type { RecipeJson } from "../domain/recipe";

describe("Empirical Challenger M5-2: R3 Purchase List & R4 Converter/Splitter Stress Suite", () => {
  // Helper to build schema-valid RecipeJson
  function buildRecipe(
    ingredients: Array<{
      id?: string;
      ingredientId?: string;
      name: string;
      amount: number;
      unit: string;
      displayAmount?: string;
    }>,
    servings = 2,
  ): RecipeJson {
    const recipeIngredients = ingredients.map((item, idx) => ({
      id: item.id ?? `entry-${idx + 1}`,
      ingredientId: item.ingredientId ?? `ing-mock-${idx + 1}`,
      name: item.name,
      amount: item.amount,
      unit: item.unit,
      displayAmount: item.displayAmount ?? `${item.amount}${item.unit}`,
      role: "main" as const,
      groupId: null,
      prepNote: null,
    }));

    const steps = [
      {
        id: "step-1",
        stepNumber: 1,
        phase: "prep" as const,
        title: "下準備",
        instruction: "具材を計量する",
        executionMode: "active" as const,
        timing: {
          activeDurationSec: 60,
          passiveDurationSec: 0,
          minTotalDurationSec: null,
          maxTotalDurationSec: null,
          scalingMode: "fixed" as const,
          timerLabel: null,
        },
        dependsOnStepIds: [],
        resourceTags: [],
        heatLevel: "none" as const,
        targetTempCelsius: null,
        inputs: recipeIngredients.map((ing) => ({
          type: "ingredient" as const,
          ingredientEntryId: ing.id,
          amountRatio: 1,
          amountText: null,
        })),
        outputs: [{ id: "out-1", label: "下準備完了" }],
        completionCue: null,
        cautions: [],
      },
    ];

    return {
      schemaVersion: "1.0",
      servings,
      summary: "Stress Test Recipe",
      equipment: [],
      ingredientGroups: [],
      ingredients: recipeIngredients,
      steps,
      globalCautions: [],
    };
  }

  // =========================================================================
  // Section 1: R3 calculatePurchaseList Adversarial Stress Testing
  // =========================================================================
  describe("R3: calculatePurchaseList Adversarial Tests", () => {
    const catalogIngredients: Ingredient[] = [
      {
        id: "ing-onion",
        name: "玉ねぎ",
        normalizedName: "玉ねぎ",
        baseDimension: "count",
        baseUnit: "個",
        nutritionBasisAmount: 1,
        nutritionPerBasis: {
          caloriesKcal: 74,
          proteinG: 2,
          fatG: 0.2,
          carbohydrateG: 17.6,
          fiberG: 3.2,
          saltEquivalentG: 0,
          micronutrients: [],
        },
        gramPerUnit: 200,
        inventiaItemId: "inv-onion-1",
        latestUnitPriceYen: 50, // 50 yen per 1 count
        latestPriceUpdatedAt: null,
        memo: null,
      },
      {
        id: "ing-pork",
        name: "豚こま肉",
        normalizedName: "豚こま肉",
        baseDimension: "mass",
        baseUnit: "g",
        nutritionBasisAmount: 100,
        nutritionPerBasis: {
          caloriesKcal: 236,
          proteinG: 19.3,
          fatG: 17.1,
          carbohydrateG: 0.2,
          fiberG: 0,
          saltEquivalentG: 0.1,
          micronutrients: [],
        },
        gramPerUnit: null,
        inventiaItemId: "inv-pork-1",
        latestUnitPriceYen: 120, // 120 yen per 100g
        latestPriceUpdatedAt: null,
        memo: null,
      },
      {
        id: "ing-milk",
        name: "牛乳",
        normalizedName: "牛乳",
        baseDimension: "volume",
        baseUnit: "mL",
        nutritionBasisAmount: 100,
        nutritionPerBasis: {
          caloriesKcal: 67,
          proteinG: 3.3,
          fatG: 3.8,
          carbohydrateG: 4.8,
          fiberG: 0,
          saltEquivalentG: 0.1,
          micronutrients: [],
        },
        gramPerUnit: null,
        inventiaItemId: null, // registered in cho, but not inventia
        latestUnitPriceYen: null, // NO price data
        latestPriceUpdatedAt: null,
        memo: null,
      },
      {
        id: "ing-garlic",
        name: "にんにく",
        normalizedName: "にんにく",
        baseDimension: "count",
        baseUnit: "個",
        nutritionBasisAmount: 1,
        nutritionPerBasis: {
          caloriesKcal: 136,
          proteinG: 6.4,
          fatG: 0.9,
          carbohydrateG: 26.3,
          fiberG: 5.7,
          saltEquivalentG: 0,
          micronutrients: [],
        },
        gramPerUnit: 10,
        inventiaItemId: "inv-garlic-1",
        latestUnitPriceYen: 35,
        latestPriceUpdatedAt: null,
        memo: null,
      },
    ];

    test("1.1 Stock Variations: zero stock, exact stock, surplus stock, and partial stock", () => {
      const recipe = buildRecipe([
        { ingredientId: "ing-onion", name: "玉ねぎ", amount: 2, unit: "個" }, // exact stock (2 in stock)
        { ingredientId: "ing-pork", name: "豚こま肉", amount: 300, unit: "g" }, // zero stock (0 in stock)
        { ingredientId: "ing-garlic", name: "にんにく", amount: 1, unit: "個" }, // surplus stock (10 in stock)
        { ingredientId: "ing-milk", name: "牛乳", amount: 200, unit: "mL" }, // partial stock (50 in stock)
      ]);

      const inventory = {
        "ing-onion": { currentQuantity: 2, baseUnit: "個" },
        "ing-pork": 0, // raw number notation
        "ing-garlic": 10,
        "ing-milk": { currentQuantity: 50, baseUnit: "mL" },
      };

      const result = calculatePurchaseList({
        recipe,
        ingredients: catalogIngredients,
        inventory,
      });

      expect(result.items).toHaveLength(4);

      // 1. exact stock: 玉ねぎ
      const onion = result.items.find((i) => i.name === "玉ねぎ")!;
      expect(onion.stockPresence).toBe("sufficient");
      expect(onion.stockQuantity).toBe(2);
      expect(onion.shortageAmount).toBe(0);
      expect(onion.purchaseAmount).toBe(0);
      expect(onion.estimatedCostYen).toBe(0);
      expect(onion.isUnregistered).toBe(false);

      // 2. zero stock: 豚こま肉
      const pork = result.items.find((i) => i.name === "豚こま肉")!;
      expect(pork.stockPresence).toBe("none");
      expect(pork.stockQuantity).toBe(0);
      expect(pork.shortageAmount).toBe(300);
      expect(pork.purchaseAmount).toBe(300);
      // unit price: 120 yen / 100g -> 300g = 360 yen
      expect(pork.unitPriceYen).toBe(120);
      expect(pork.estimatedCostYen).toBe(360);

      // 3. surplus stock: にんにく
      const garlic = result.items.find((i) => i.name === "にんにく")!;
      expect(garlic.stockPresence).toBe("sufficient");
      expect(garlic.stockQuantity).toBe(10);
      expect(garlic.shortageAmount).toBe(0);
      expect(garlic.purchaseAmount).toBe(0);
      expect(garlic.estimatedCostYen).toBe(0);

      // 4. partial stock: 牛乳 (no price)
      const milk = result.items.find((i) => i.name === "牛乳")!;
      expect(milk.stockPresence).toBe("partial");
      expect(milk.stockQuantity).toBe(50);
      expect(milk.shortageAmount).toBe(150);
      expect(milk.purchaseAmount).toBe(150);
      expect(milk.unitPriceYen).toBeNull();
      expect(milk.estimatedCostYen).toBeNull();

      // Total estimated cost: 0 (onion) + 360 (pork) + 0 (garlic) + null (milk) = 360
      expect(result.totalEstimatedCostYen).toBe(360);

      // Validate markdown table contains 9 columns per row
      const lines = result.markdownTable.trim().split("\n");
      expect(lines.length).toBe(7); // header (1) + separator (1) + 4 items (4) + total row (1) = 7
      for (const line of lines) {
        const cols = line.split("|").filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
        expect(cols).toHaveLength(9);
      }
    });

    test("1.2 Missing Stock / Missing Inventory Parameter", () => {
      const recipe = buildRecipe([
        { ingredientId: "ing-onion", name: "玉ねぎ", amount: 3, unit: "個" },
      ]);

      // Case A: inventory completely undefined
      const resNoInventory = calculatePurchaseList({
        recipe,
        ingredients: catalogIngredients,
      });
      expect(resNoInventory.items[0].stockQuantity).toBeNull();
      expect(resNoInventory.items[0].stockPresence).toBe("unknown");
      expect(resNoInventory.items[0].shortageAmount).toBe(3);
      expect(resNoInventory.items[0].purchaseAmount).toBe(3);
      expect(resNoInventory.items[0].estimatedCostYen).toBe(150);

      // Case B: inventory provided but key missing
      const resMissingKey = calculatePurchaseList({
        recipe,
        ingredients: catalogIngredients,
        inventory: { "some-other-ing": 5 },
      });
      expect(resMissingKey.items[0].stockQuantity).toBeNull();
      expect(resMissingKey.items[0].stockPresence).toBe("unknown");
    });

    test("1.3 Negative stock quantity in inventory is treated as none (not negative shortage)", () => {
      const recipe = buildRecipe([
        { ingredientId: "ing-pork", name: "豚こま肉", amount: 150, unit: "g" },
      ]);
      const resNegativeStock = calculatePurchaseList({
        recipe,
        ingredients: catalogIngredients,
        inventory: { "ing-pork": -50 },
      });
      const pork = resNegativeStock.items[0];
      expect(pork.stockPresence).toBe("none");
      expect(pork.stockQuantity).toBe(-50);
      // Shortage must equal required amount, NOT 150 - (-50) = 200
      expect(pork.shortageAmount).toBe(150);
      expect(pork.purchaseAmount).toBe(150);
      expect(pork.estimatedCostYen).toBe(180); // (120 * 150) / 100
    });

    test("1.4 Unregistered Ingredient: not found in master catalog", () => {
      const recipe = buildRecipe([
        { name: "秘密のスパイス", amount: 15, unit: "g" }, // no ingredientId
      ]);
      const result = calculatePurchaseList({
        recipe,
        ingredients: catalogIngredients,
        inventory: { 秘密のスパイス: 5 },
      });

      const spice = result.items[0];
      expect(spice.ingredientId).toBeNull();
      expect(spice.isUnregistered).toBe(true);
      expect(spice.stockPresence).toBe("partial");
      expect(spice.stockQuantity).toBe(5);
      expect(spice.shortageAmount).toBe(10);
      expect(spice.purchaseAmount).toBe(10);
      expect(spice.unitPriceYen).toBeNull();
      expect(spice.estimatedCostYen).toBeNull();

      expect(result.totalEstimatedCostYen).toBeNull();
      expect(result.markdownTable).toContain("未登録");
    });

    test("1.5 Resolution Priority: matches by matchedIngredient.id, entry.ingredientId, inventiaItemId, and entry.name", () => {
      const recipe = buildRecipe([
        { ingredientId: "ing-onion", name: "玉ねぎ", amount: 2, unit: "個" },
      ]);

      // Test resolution by inventiaItemId
      const resInventiaKey = calculatePurchaseList({
        recipe,
        ingredients: catalogIngredients,
        inventory: { "inv-onion-1": 8 },
      });
      expect(resInventiaKey.items[0].stockQuantity).toBe(8);
      expect(resInventiaKey.items[0].stockPresence).toBe("sufficient");

      // Test resolution by ingredient name
      const resNameKey = calculatePurchaseList({
        recipe,
        ingredients: catalogIngredients,
        inventory: { 玉ねぎ: 4 },
      });
      expect(resNameKey.items[0].stockQuantity).toBe(4);
      expect(resNameKey.items[0].stockPresence).toBe("sufficient");
    });

    test("1.6 High precision decimal quantities and rounding", () => {
      const recipe = buildRecipe([
        { ingredientId: "ing-pork", name: "豚こま肉", amount: 123.456, unit: "g" },
      ]);
      const result = calculatePurchaseList({
        recipe,
        ingredients: catalogIngredients,
        inventory: { "ing-pork": 23.45 },
      });
      const pork = result.items[0];
      expect(pork.shortageAmount).toBeCloseTo(100.006, 3);
      expect(pork.purchaseAmount).toBeCloseTo(100.006, 3);
      // cost: (120 * 100.006) / 100 = 120.0072 -> rounded to 120.01
      expect(pork.estimatedCostYen).toBe(120.01);
    });

    test("1.7 Empty recipe with 0 ingredients returns empty items and null total cost", () => {
      const recipe = buildRecipe([]);
      const result = calculatePurchaseList({
        recipe,
        ingredients: catalogIngredients,
      });
      expect(result.items).toHaveLength(0);
      expect(result.totalEstimatedCostYen).toBeNull();
      expect(result.markdownTable).toContain("| **合計** | - | - | - | - | - | - | **-** | - |");
    });

    test("1.8 Zero unit price (free ingredient, e.g. 0 yen) behaves correctly", () => {
      const freeIngredient: Ingredient = {
        id: "ing-water",
        name: "水",
        normalizedName: "水",
        baseDimension: "volume",
        baseUnit: "mL",
        nutritionBasisAmount: 100,
        nutritionPerBasis: {
          caloriesKcal: 0,
          proteinG: 0,
          fatG: 0,
          carbohydrateG: 0,
          fiberG: 0,
          saltEquivalentG: 0,
          micronutrients: [],
        },
        gramPerUnit: null,
        inventiaItemId: "inv-water",
        latestUnitPriceYen: 0, // 0 yen!
        latestPriceUpdatedAt: null,
        memo: null,
      };

      const recipe = buildRecipe([
        { ingredientId: "ing-water", name: "水", amount: 500, unit: "mL" },
      ]);

      const result = calculatePurchaseList({
        recipe,
        ingredients: [...catalogIngredients, freeIngredient],
        inventory: { "ing-water": 0 },
      });

      const water = result.items[0];
      expect(water.unitPriceYen).toBe(0);
      expect(water.estimatedCostYen).toBe(0);
      expect(result.totalEstimatedCostYen).toBe(0);
      expect(result.markdownTable).toContain(
        "| 水 | 500mL | 0mL | なし | 500mL | 500mL | 0円 | 0円 | 連携済 |",
      );
      expect(result.markdownTable).toContain("| **合計** | - | - | - | - | - | - | **0円** | - |");
    });

    test("1.9 Inventory provided with object structure (InventoryItemInfo) and string quantity safety", () => {
      const recipe = buildRecipe([
        { ingredientId: "ing-onion", name: "玉ねぎ", amount: 3, unit: "個" },
      ]);

      const result = calculatePurchaseList({
        recipe,
        ingredients: catalogIngredients,
        inventory: {
          "ing-onion": { currentQuantity: 1.5, baseUnit: "個" },
        },
      });

      const onion = result.items[0];
      expect(onion.stockQuantity).toBe(1.5);
      expect(onion.stockPresence).toBe("partial");
      expect(onion.shortageAmount).toBe(1.5);
      expect(onion.purchaseAmount).toBe(1.5);
      expect(onion.estimatedCostYen).toBe(75);
    });
  });

  // =========================================================================
  // Section 2: R4 splitLargeRecipe Boundary & Stress Testing
  // =========================================================================
  describe("R4: splitLargeRecipe Boundary & Stress Tests", () => {
    function generateRecipeWithCount(count: number): SimplifiedRecipe {
      const ingredients: SimplifiedIngredient[] = Array.from({ length: count }, (_, i) => ({
        name: `食材_${i + 1}`,
        amount: (i + 1) * 10,
        unit: "g",
        role: (["main", "seasoning", "topping", "optional"] as const)[i % 4],
        prepNote: i % 2 === 0 ? `下処理_${i + 1}` : undefined,
      }));

      return {
        name: `検証レシピ_${count}品`,
        category: "stress",
        servings: 4,
        summary: `${count}品のテストレシピ`,
        equipment: ["鍋", "包丁"],
        ingredients,
        phases: {
          prep: {
            instruction: "下準備を行う",
            ingredients: ingredients.slice(0, Math.ceil(count / 2)).map((i) => i.name),
          },
          cook: {
            instruction: "加熱調理する",
            ingredients: ingredients.slice(Math.ceil(count / 2)).map((i) => i.name),
          },
        },
      };
    }

    test("2.1 Boundary: 1 ingredient (minimum valid recipe)", () => {
      const r1 = generateRecipeWithCount(1);
      const parts = splitLargeRecipe(r1, 12);
      expect(parts).toHaveLength(1);
      expect(parts[0].ingredients).toHaveLength(1);
      expect(parts[0].name).toBe(r1.name); // Not partitioned into part 1/1
    });

    test("2.2 Boundary: 12 ingredients (exact threshold)", () => {
      const r12 = generateRecipeWithCount(12);
      const parts = splitLargeRecipe(r12, 12);
      expect(parts).toHaveLength(1);
      expect(parts[0].ingredients).toHaveLength(12);
      expect(parts[0].name).toBe(r12.name);
    });

    test("2.3 Boundary: 13 ingredients (threshold + 1 -> 2 sub-recipes)", () => {
      const r13 = generateRecipeWithCount(13);
      const parts = splitLargeRecipe(r13, 12);
      expect(parts).toHaveLength(2);
      expect(parts[0].ingredients).toHaveLength(12);
      expect(parts[1].ingredients).toHaveLength(1);
      expect(parts[0].name).toContain("(パート 1/2)");
      expect(parts[1].name).toContain("(パート 2/2)");

      // Ingredient conservation
      const allNames = parts.flatMap((p) => p.ingredients.map((i) => i.name));
      expect(allNames).toEqual(r13.ingredients.map((i) => i.name));
    });

    test("2.4 Boundary: 24 ingredients (exact 2x threshold -> 2 sub-recipes)", () => {
      const r24 = generateRecipeWithCount(24);
      const parts = splitLargeRecipe(r24, 12);
      expect(parts).toHaveLength(2);
      expect(parts[0].ingredients).toHaveLength(12);
      expect(parts[1].ingredients).toHaveLength(12);
      expect(parts[0].name).toContain("(パート 1/2)");
      expect(parts[1].name).toContain("(パート 2/2)");
    });

    test("2.5 Boundary: 25 ingredients (2x + 1 -> 3 sub-recipes)", () => {
      const r25 = generateRecipeWithCount(25);
      const parts = splitLargeRecipe(r25, 12);
      expect(parts).toHaveLength(3);
      expect(parts[0].ingredients).toHaveLength(12);
      expect(parts[1].ingredients).toHaveLength(12);
      expect(parts[2].ingredients).toHaveLength(1);
      expect(parts[0].name).toContain("(パート 1/3)");
      expect(parts[1].name).toContain("(パート 2/3)");
      expect(parts[2].name).toContain("(パート 3/3)");
    });

    test("2.6 Stress: 50 ingredients (large multi-part split)", () => {
      const r50 = generateRecipeWithCount(50);
      const parts = splitLargeRecipe(r50, 12);
      expect(parts).toHaveLength(5);
      expect(parts[0].ingredients).toHaveLength(12);
      expect(parts[1].ingredients).toHaveLength(12);
      expect(parts[2].ingredients).toHaveLength(12);
      expect(parts[3].ingredients).toHaveLength(12);
      expect(parts[4].ingredients).toHaveLength(2);

      // Verify every sub-recipe converts to valid Cho recipe and passes validateRecipeDag
      for (const part of parts) {
        const converted = convertInventiaToCho(part);
        expect(converted.warnings).not.toContain(expect.stringContaining("DAG"));
        const dagCheck = validateRecipeDag(converted.dishPayload.recipe as RecipeJson);
        expect(dagCheck.success).toBe(true);
        expect(dagCheck.errors).toHaveLength(0);
      }
    });

    test("2.7 Custom maxIngredientsPerDish parameter (e.g. max 5)", () => {
      const r12 = generateRecipeWithCount(12);
      const parts = splitLargeRecipe(r12, 5);
      expect(parts).toHaveLength(3); // 5, 5, 2
      expect(parts[0].ingredients).toHaveLength(5);
      expect(parts[1].ingredients).toHaveLength(5);
      expect(parts[2].ingredients).toHaveLength(2);
    });

    test("2.8 Zero or negative maxIngredientsPerDish defaults safely to 1", () => {
      const r3 = generateRecipeWithCount(3);
      const partsZero = splitLargeRecipe(r3, 0);
      expect(partsZero).toHaveLength(3);
      const partsNeg = splitLargeRecipe(r3, -5);
      expect(partsNeg).toHaveLength(3);
    });

    test("2.9 Extreme boundaries: 0 ingredients and 100 ingredients", () => {
      // 0 ingredients
      const r0 = generateRecipeWithCount(0);
      const parts0 = splitLargeRecipe(r0, 12);
      expect(parts0).toHaveLength(1);
      expect(parts0[0].ingredients).toHaveLength(0);

      // 100 ingredients
      const r100 = generateRecipeWithCount(100);
      const parts100 = splitLargeRecipe(r100, 12);
      // ceil(100 / 12) = 9 parts (8 * 12 + 4)
      expect(parts100).toHaveLength(9);
      expect(parts100[0].ingredients).toHaveLength(12);
      expect(parts100[7].ingredients).toHaveLength(12);
      expect(parts100[8].ingredients).toHaveLength(4);
    });
  });

  // =========================================================================
  // Section 3: R4 convertInventiaToCho Adversarial Edge Cases
  // =========================================================================
  describe("R4: convertInventiaToCho Adversarial Tests", () => {
    test("3.1 Missing phases entirely (recipe.phases = undefined)", () => {
      const recipeNoPhases: SimplifiedRecipe = {
        name: "シンプルパスタ",
        category: "noodles",
        servings: 2,
        ingredients: [
          { name: "パスタ", amount: 200, unit: "g", role: "main" },
          { name: "オリーブオイル", amount: 15, unit: "mL", role: "seasoning" },
          { name: "パセリ", amount: 5, unit: "g", role: "topping" },
          { name: "粉チーズ", amount: 10, unit: "g", role: "optional" },
          { name: "にんにく", amount: 1, unit: "個", prepNote: "みじん切り" },
        ],
      };

      const converted = convertInventiaToCho(recipeNoPhases);
      expect(converted.warnings).toHaveLength(5); // 5 unmapped ingredient warnings, NO DAG errors

      const recipe = converted.dishPayload.recipe as RecipeJson;
      expect(recipe.steps).toHaveLength(4); // prep, cook, assemble, finish synthesized

      // Step 1: prep should have にんにく (has prepNote)
      const prepStep = recipe.steps.find((s) => s.phase === "prep")!;
      const prepIngIds = prepStep.inputs
        .filter((i) => i.type === "ingredient")
        .map((i) => i.ingredientEntryId);
      const garlicEntry = recipe.ingredients.find((i) => i.name === "にんにく")!;
      expect(prepIngIds).toContain(garlicEntry.id);

      // Step 2: cook should have オリーブオイル (seasoning) and パスタ (main default)
      const cookStep = recipe.steps.find((s) => s.phase === "cook")!;
      const cookIngIds = cookStep.inputs
        .filter((i) => i.type === "ingredient")
        .map((i) => i.ingredientEntryId);
      const pastaEntry = recipe.ingredients.find((i) => i.name === "パスタ")!;
      const oilEntry = recipe.ingredients.find((i) => i.name === "オリーブオイル")!;
      expect(cookIngIds).toContain(pastaEntry.id);
      expect(cookIngIds).toContain(oilEntry.id);

      // Step 3: assemble should have 粉チーズ (optional)
      const assembleStep = recipe.steps.find((s) => s.phase === "assemble")!;
      const cheeseEntry = recipe.ingredients.find((i) => i.name === "粉チーズ")!;
      expect(
        assembleStep.inputs.some(
          (i) => i.type === "ingredient" && i.ingredientEntryId === cheeseEntry.id,
        ),
      ).toBe(true);

      // Step 4: finish should have パセリ (topping)
      const finishStep = recipe.steps.find((s) => s.phase === "finish")!;
      const parsleyEntry = recipe.ingredients.find((i) => i.name === "パセリ")!;
      expect(
        finishStep.inputs.some(
          (i) => i.type === "ingredient" && i.ingredientEntryId === parsleyEntry.id,
        ),
      ).toBe(true);

      // Verify DAG passes with 0 errors
      const dagValidation = validateRecipeDag(recipe);
      expect(dagValidation.success).toBe(true);
      expect(dagValidation.errors).toHaveLength(0);

      // Verify schema compliance
      const dishParsed = dishSchema.safeParse({ id: "dish-test-1", ...converted.dishPayload });
      expect(dishParsed.success).toBe(true);
    });

    test("3.2 Missing / empty ingredientMap uses placeholder IDs and emits warnings", () => {
      const recipe: SimplifiedRecipe = {
        name: "謎のスープ",
        servings: 1,
        ingredients: [
          { name: "謎の野菜", amount: 100, unit: "g" },
          { name: "謎の調味料", amount: 5, unit: "g" },
        ],
      };

      const converted = convertInventiaToCho(recipe, {});
      expect(converted.warnings.length).toBeGreaterThanOrEqual(2);
      expect(converted.warnings[0]).toContain("not found in ingredientMap; using placeholder id");

      const recipeJson = converted.dishPayload.recipe as RecipeJson;
      expect(recipeJson.ingredients[0].ingredientId).toBe("unmapped-1");
      expect(recipeJson.ingredients[1].ingredientId).toBe("unmapped-2");

      const dagValidation = validateRecipeDag(recipeJson);
      expect(dagValidation.success).toBe(true);
    });

    test("3.3 Phase references ingredient not present in ingredients list", () => {
      const recipe: SimplifiedRecipe = {
        name: "テスト料理",
        servings: 2,
        ingredients: [{ name: "玉ねぎ", amount: 1, unit: "個" }],
        phases: {
          prep: {
            instruction: "刻む",
            ingredients: ["玉ねぎ", "存在しない食材"],
          },
        },
      };

      const converted = convertInventiaToCho(recipe);
      expect(converted.warnings).toContain(
        'Phase "prep" references ingredient "存在しない食材" which is not in the ingredients list.',
      );

      // The resulting recipe should still pass DAG validation because the ghost ingredient was skipped
      const dagValidation = validateRecipeDag(converted.dishPayload.recipe as RecipeJson);
      expect(dagValidation.success).toBe(true);
    });

    test("3.4 Ingredient assigned multiple times in phases is deduplicated to preserve 1.0 ratio", () => {
      const recipe: SimplifiedRecipe = {
        name: "重複食材レシピ",
        servings: 2,
        ingredients: [{ name: "塩", amount: 5, unit: "g", role: "seasoning" }],
        phases: {
          cook: {
            instruction: "塩を入れる",
            ingredients: ["塩"],
          },
          finish: {
            instruction: "さらに塩を振る",
            ingredients: ["塩"],
          },
        },
      };

      const converted = convertInventiaToCho(recipe);
      expect(
        converted.warnings.some((w) =>
          w.includes("is assigned multiple times; keeping first assignment"),
        ),
      ).toBe(true);

      const dagValidation = validateRecipeDag(converted.dishPayload.recipe as RecipeJson);
      expect(dagValidation.success).toBe(true);
    });

    test("3.5 Boundary servings: 0, negative, and >100 are clamped to 1..100", () => {
      const r0: SimplifiedRecipe = {
        name: "ゼロ人前",
        servings: 0,
        ingredients: [{ name: "水", amount: 200, unit: "mL" }],
      };
      const res0 = convertInventiaToCho(r0);
      expect(res0.dishPayload.servings).toBe(1);

      const rNeg: SimplifiedRecipe = {
        name: "マイナス人前",
        servings: -5,
        ingredients: [{ name: "水", amount: 200, unit: "mL" }],
      };
      const resNeg = convertInventiaToCho(rNeg);
      expect(resNeg.dishPayload.servings).toBe(1);

      const r200: SimplifiedRecipe = {
        name: "200人前",
        servings: 200,
        ingredients: [{ name: "水", amount: 200, unit: "mL" }],
      };
      const res200 = convertInventiaToCho(r200);
      expect(res200.dishPayload.servings).toBe(100);
    });

    test("3.6 Heat level normalization handles uppercase, hyphens, and unknown levels gracefully", () => {
      const recipe: SimplifiedRecipe = {
        name: "火加減検証レシピ",
        servings: 2,
        ingredients: [{ name: "水", amount: 200, unit: "mL" }],
        phases: {
          prep: {
            instruction: "準備",
            heatLevel: "LOW", // uppercase
            ingredients: [],
          },
          cook: {
            instruction: "加熱",
            heatLevel: "medium-high", // hyphenated
            ingredients: ["水"],
          },
          assemble: {
            instruction: "合わせる",
            heatLevel: "SUPER_BLAST_UNKNOWN", // invalid
            ingredients: [],
          },
        },
      };

      const converted = convertInventiaToCho(recipe);
      const choRecipe = converted.dishPayload.recipe as RecipeJson;

      const prepStep = choRecipe.steps.find((s) => s.phase === "prep")!;
      expect(prepStep.heatLevel).toBe("low");

      const cookStep = choRecipe.steps.find((s) => s.phase === "cook")!;
      expect(cookStep.heatLevel).toBe("medium_high");

      const assembleStep = choRecipe.steps.find((s) => s.phase === "assemble")!;
      // Should fallback to meta.defaultHeat ("none")
      expect(assembleStep.heatLevel).toBe("none");
    });

    test("3.7 End-to-end integration with workspace fixtures recipe_payload_4step.json & ingredient_map.json", async () => {
      const { readFileSync } = await import("node:fs");
      const { resolve } = await import("node:path");

      const workspaceRoot = resolve(__dirname, "../../../");
      const fixturePayload = JSON.parse(
        readFileSync(resolve(workspaceRoot, "recipe_payload_4step.json"), "utf-8"),
      );
      const ingredientMap = JSON.parse(
        readFileSync(resolve(workspaceRoot, "ingredient_map.json"), "utf-8"),
      );

      // Verify that all 12 ingredients in fixturePayload exist in ingredientMap
      const fixtureIngredients = fixturePayload.recipe.ingredients as Array<{
        name: string;
        ingredientId: string;
      }>;
      expect(fixtureIngredients).toHaveLength(12);

      for (const ing of fixtureIngredients) {
        expect(ingredientMap[ing.name]).toBeDefined();
        expect(ingredientMap[ing.name]).toBe(ing.ingredientId);
      }

      // Convert from simplified recipe using ingredientMap
      const simplifiedFromFixture: SimplifiedRecipe = {
        name: fixturePayload.name,
        category: fixturePayload.category,
        servings: fixturePayload.servings,
        summary: fixturePayload.notes,
        ingredients: fixtureIngredients.map((i) => ({
          name: i.name,
          amount: 100,
          unit: "g",
        })),
      };

      const converted = convertInventiaToCho(simplifiedFromFixture, ingredientMap);
      // Zero unmapped warnings expected since all 12 are in ingredientMap
      const unmappedWarnings = converted.warnings.filter((w) =>
        w.includes("not found in ingredientMap"),
      );
      expect(unmappedWarnings).toHaveLength(0);

      // Converted DAG passes validation
      const dagValidation = validateRecipeDag(converted.dishPayload.recipe as RecipeJson);
      expect(dagValidation.success).toBe(true);
      expect(dagValidation.errors).toHaveLength(0);
    });
  });

  // =========================================================================
  // Section 4: Pre-flight Dry Run DAG Validation Adversarial Scenarios
  // =========================================================================
  describe("R4: Pre-flight Dry Run Validation Adversarial Scenarios", () => {
    test("4.1 Malformed DAG with circular dependency is rejected by validateRecipeDag", () => {
      const recipe = buildRecipe([
        { id: "e-1", ingredientId: "ing-1", name: "具材", amount: 100, unit: "g" },
      ]);

      // Inject a cycle: step-1 depends on step-2, step-2 depends on step-1
      recipe.steps = [
        {
          id: "step-1",
          stepNumber: 1,
          phase: "prep",
          title: "Step 1",
          instruction: "Do 1",
          executionMode: "active",
          timing: {
            activeDurationSec: 60,
            passiveDurationSec: 0,
            minTotalDurationSec: null,
            maxTotalDurationSec: null,
            scalingMode: "fixed",
            timerLabel: null,
          },
          dependsOnStepIds: ["step-2"],
          resourceTags: [],
          heatLevel: "none",
          targetTempCelsius: null,
          inputs: [
            { type: "ingredient", ingredientEntryId: "e-1", amountRatio: 1, amountText: null },
            { type: "intermediate", fromStepId: "step-2", outputId: "out-2" },
          ],
          outputs: [{ id: "out-1", label: "Out 1" }],
          completionCue: null,
          cautions: [],
        },
        {
          id: "step-2",
          stepNumber: 2,
          phase: "cook",
          title: "Step 2",
          instruction: "Do 2",
          executionMode: "active",
          timing: {
            activeDurationSec: 60,
            passiveDurationSec: 0,
            minTotalDurationSec: null,
            maxTotalDurationSec: null,
            scalingMode: "fixed",
            timerLabel: null,
          },
          dependsOnStepIds: ["step-1"],
          resourceTags: [],
          heatLevel: "none",
          targetTempCelsius: null,
          inputs: [{ type: "intermediate", fromStepId: "step-1", outputId: "out-1" }],
          outputs: [{ id: "out-2", label: "Out 2" }],
          completionCue: null,
          cautions: [],
        },
      ];

      const validation = validateRecipeDag(recipe);
      expect(validation.success).toBe(false);
      expect(validation.errors.some((e) => e.toLowerCase().includes("cycle"))).toBe(true);
    });

    test("4.2 Missing input reference to non-existent ingredient or output", () => {
      const recipe = buildRecipe([
        { id: "e-1", ingredientId: "ing-1", name: "具材", amount: 100, unit: "g" },
      ]);

      // Reference non-existent ingredientEntryId
      recipe.steps[0].inputs.push({
        type: "ingredient",
        ingredientEntryId: "nonexistent-entry",
        amountRatio: 1,
        amountText: null,
      });

      const validation = validateRecipeDag(recipe);
      expect(validation.success).toBe(false);
      expect(
        validation.errors.some((e) => e.includes("nonexistent-entry") || e.includes("unknown")),
      ).toBe(true);
    });

    test("4.3 Ingredient ratio total not equal to 1.0 triggers validation error", () => {
      const recipe = buildRecipe([
        { id: "e-1", ingredientId: "ing-1", name: "具材", amount: 100, unit: "g" },
      ]);

      // Change ratio to 0.5 without any remaining step consuming the other 0.5
      recipe.steps[0].inputs[0].amountRatio = 0.5;

      const validation = validateRecipeDag(recipe);
      expect(validation.success).toBe(false);
      expect(
        validation.errors.some(
          (e) => e.includes("ratio") || e.includes("total") || e.includes("0.5"),
        ),
      ).toBe(true);
    });
  });
});
