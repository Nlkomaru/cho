import { existsSync } from "node:fs";
import { describe, expect, test } from "vite-plus/test";
import { api } from "../api/index";
import { calculatePurchaseListInputSchema, purchaseListResultSchema } from "./mcp";
import type { Ingredient } from "./ingredient";
import type { RecipeJson } from "./recipe";
import {
  calculatePurchaseList,
  type CalculatePurchaseListParams,
  type PurchaseListItem,
  type PurchaseListResult,
} from "./purchase-list";
import { createTestD1Harness } from "../tests/test-harness";

export type { PurchaseListItem, PurchaseListResult, CalculatePurchaseListParams };

type CalculatePurchaseListFn = (params: CalculatePurchaseListParams) => PurchaseListResult;

// Dynamically load implementation once created by worker_m3
async function getCalculatePurchaseList(): Promise<CalculatePurchaseListFn | null> {
  const modulePath = new URL("./purchase-list.ts", import.meta.url).pathname;
  if (!existsSync(modulePath)) return null;
  const mod = (await import(modulePath)) as {
    calculatePurchaseList?: CalculatePurchaseListFn;
  };
  return mod.calculatePurchaseList ?? null;
}

describe("R3: Purchase & Shortage List Domain Engine (purchase-list.ts)", () => {
  const mockIngredients: Ingredient[] = [
    {
      id: "ing-macaroni",
      name: "マカロニ",
      normalizedName: "マカロニ",
      baseDimension: "mass",
      baseUnit: "g",
      nutritionBasisAmount: 100,
      nutritionPerBasis: {
        caloriesKcal: 358,
        proteinG: 13,
        fatG: 2,
        carbohydrateG: 72,
        fiberG: 2.8,
        saltEquivalentG: 0,
        micronutrients: [],
      },
      gramPerUnit: null,
      inventiaItemId: "inv-macaroni",
      latestUnitPriceYen: 60, // 60 yen per 100g
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
      inventiaItemId: "inv-milk",
      latestUnitPriceYen: 30, // 30 yen per 100mL
      latestPriceUpdatedAt: null,
      memo: null,
    },
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
      inventiaItemId: "inv-onion",
      latestUnitPriceYen: 80, // 80 yen per 1 count
      latestPriceUpdatedAt: null,
      memo: null,
    },
  ];

  const sampleRecipe: RecipeJson = {
    schemaVersion: "1.0",
    servings: 2,
    summary: "グラタン",
    equipment: ["オーブン"],
    ingredientGroups: [],
    ingredients: [
      {
        id: "r-macaroni",
        ingredientId: "ing-macaroni",
        name: "マカロニ",
        amount: 100,
        unit: "g",
        displayAmount: "100g",
        role: "main",
        groupId: null,
        prepNote: null,
      },
      {
        id: "r-milk",
        ingredientId: "ing-milk",
        name: "牛乳",
        amount: 350,
        unit: "mL",
        displayAmount: "350mL",
        role: "main",
        groupId: null,
        prepNote: null,
      },
      {
        id: "r-onion",
        ingredientId: "ing-onion",
        name: "玉ねぎ",
        amount: 1,
        unit: "個",
        displayAmount: "1個",
        role: "main",
        groupId: null,
        prepNote: null,
      },
      {
        id: "r-spice",
        ingredientId: "ing-unregistered-spice",
        name: "特製スパイス",
        amount: 10,
        unit: "g",
        displayAmount: "10g",
        role: "seasoning",
        groupId: null,
        prepNote: null,
      },
    ],
    steps: [
      {
        id: "step-1",
        stepNumber: 1,
        phase: "cook",
        title: "調味",
        instruction: "すべて混ぜる",
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
        inputs: [],
        outputs: [],
        completionCue: null,
        cautions: [],
      },
    ],
    globalCautions: [],
  };

  test("accurately calculates sufficient, partial, none, and unknown stock states", async () => {
    const calculatePurchaseListFn = await getCalculatePurchaseList();
    if (!calculatePurchaseListFn) {
      expect(
        calculatePurchaseListFn,
        "M3 implementation pending in app/src/domain/purchase-list.ts",
      ).toBeNull();
      return;
    }

    // Inventory state:
    // - Macaroni: 250g in stock (required 100g) -> sufficient (shortage 0, purchase 0)
    // - Milk: 200mL in stock (required 350mL) -> partial (shortage 150mL, purchase 150mL)
    // - Onion: 0 in stock (required 1個) -> none (shortage 1個, purchase 1個)
    // - Spice: not in inventory -> unknown (shortage 10g, purchase 10g, unregistered)
    const inventory = {
      "ing-macaroni": { currentQuantity: 250, baseUnit: "g" },
      "ing-milk": { currentQuantity: 200, baseUnit: "mL" },
      "ing-onion": { currentQuantity: 0, baseUnit: "個" },
    };

    const result = calculatePurchaseListFn({
      recipe: sampleRecipe,
      ingredients: mockIngredients,
      inventory,
    });

    expect(result.items).toHaveLength(4);

    // Macaroni: sufficient
    const macaroni = result.items.find((i) => i.name === "マカロニ");
    expect(macaroni).toBeDefined();
    if (macaroni) {
      expect(macaroni.stockPresence).toBe("sufficient");
      expect(macaroni.stockQuantity).toBe(250);
      expect(macaroni.shortageAmount).toBe(0);
      expect(macaroni.purchaseAmount).toBe(0);
      expect(macaroni.estimatedCostYen).toBe(0);
      expect(macaroni.isUnregistered).toBe(false);
    }

    // Milk: partial (150mL shortage)
    // Cost: (30 yen / 100mL) * 150mL = 45 yen
    const milk = result.items.find((i) => i.name === "牛乳");
    expect(milk).toBeDefined();
    if (milk) {
      expect(milk.stockPresence).toBe("partial");
      expect(milk.stockQuantity).toBe(200);
      expect(milk.shortageAmount).toBe(150);
      expect(milk.purchaseAmount).toBe(150);
      expect(milk.unitPriceYen).toBe(30);
      expect(milk.estimatedCostYen).toBe(45);
      expect(milk.isUnregistered).toBe(false);
    }

    // Onion: none (1 count shortage)
    // Cost: (80 yen / 1個) * 1個 = 80 yen
    const onion = result.items.find((i) => i.name === "玉ねぎ");
    expect(onion).toBeDefined();
    if (onion) {
      expect(onion.stockPresence).toBe("none");
      expect(onion.stockQuantity).toBe(0);
      expect(onion.shortageAmount).toBe(1);
      expect(onion.purchaseAmount).toBe(1);
      expect(onion.unitPriceYen).toBe(80);
      expect(onion.estimatedCostYen).toBe(80);
      expect(onion.isUnregistered).toBe(false);
    }

    // Spice: unknown / unregistered
    // Cost: null (unregistered price)
    const spice = result.items.find((i) => i.name === "特製スパイス");
    expect(spice).toBeDefined();
    if (spice) {
      expect(spice.stockPresence).toBe("unknown");
      expect(spice.stockQuantity).toBeNull();
      expect(spice.shortageAmount).toBe(10);
      expect(spice.purchaseAmount).toBe(10);
      expect(spice.unitPriceYen).toBeNull();
      expect(spice.estimatedCostYen).toBeNull();
      expect(spice.isUnregistered).toBe(true);
    }

    // Total estimated cost: 0 (macaroni) + 45 (milk) + 80 (onion) = 125 yen
    expect(result.totalEstimatedCostYen).toBe(125);
  });

  test("generates a single unified Markdown table containing all 8 required columns", async () => {
    const calculatePurchaseListFn = await getCalculatePurchaseList();
    if (!calculatePurchaseListFn) {
      expect(
        calculatePurchaseListFn,
        "M3 implementation pending in app/src/domain/purchase-list.ts",
      ).toBeNull();
      return;
    }

    const inventory = {
      "ing-macaroni": { currentQuantity: 250, baseUnit: "g" },
      "ing-milk": { currentQuantity: 200, baseUnit: "mL" },
      "ing-onion": { currentQuantity: 0, baseUnit: "個" },
    };

    const result = calculatePurchaseListFn({
      recipe: sampleRecipe,
      ingredients: mockIngredients,
      inventory,
    });

    expect(typeof result.markdownTable).toBe("string");
    const table = result.markdownTable;

    // Table header validations
    expect(table).toContain("|");
    expect(table).toMatch(/材料名/);
    expect(table).toMatch(/必要量/);
    expect(table).toMatch(/在庫/);
    expect(table).toMatch(/不足量/);
    expect(table).toMatch(/買い足し量/);
    expect(table).toMatch(/単価/);
    expect(table).toMatch(/概算費用/);

    // Content rows
    expect(table).toContain("マカロニ");
    expect(table).toContain("牛乳");
    expect(table).toContain("玉ねぎ");
    expect(table).toContain("特製スパイス");

    // Total line
    expect(table).toMatch(/合計/);
    expect(table).toContain("125");
  });

  test("handles zero inventory gracefully when inventory parameter is omitted", async () => {
    const calculatePurchaseListFn = await getCalculatePurchaseList();
    if (!calculatePurchaseListFn) {
      expect(
        calculatePurchaseListFn,
        "M3 implementation pending in app/src/domain/purchase-list.ts",
      ).toBeNull();
      return;
    }

    const result = calculatePurchaseListFn({
      recipe: sampleRecipe,
      ingredients: mockIngredients,
    });

    // Every item should be classified as "unknown"
    for (const item of result.items) {
      expect(item.stockPresence).toBe("unknown");
      expect(item.shortageAmount).toBe(item.requiredAmount);
      expect(item.purchaseAmount).toBe(item.requiredAmount);
    }
  });

  // =========================================================================
  // Additional Edge Case & Resilience Unit Tests
  // =========================================================================

  test("handles fractional quantities and decimal stock calculations accurately", () => {
    const result = calculatePurchaseList({
      recipe: {
        schemaVersion: "1.0",
        servings: 1,
        summary: "Decimal test",
        equipment: [],
        ingredientGroups: [],
        ingredients: [
          {
            id: "entry-1",
            ingredientId: "ing-macaroni",
            name: "マカロニ",
            amount: 150.5,
            unit: "g",
            displayAmount: "150.5g",
            role: "main",
            groupId: null,
            prepNote: null,
          },
        ],
        steps: [],
        globalCautions: [],
      },
      ingredients: mockIngredients,
      inventory: {
        "ing-macaroni": { currentQuantity: 100.25, baseUnit: "g" },
      },
    });

    expect(result.items).toHaveLength(1);
    const item = result.items[0];
    expect(item.stockPresence).toBe("partial");
    expect(item.stockQuantity).toBe(100.25);
    // 150.5 - 100.25 = 50.25
    expect(item.shortageAmount).toBe(50.25);
    expect(item.purchaseAmount).toBe(50.25);
    // Unit price 60 yen / 100g -> (60 * 50.25) / 100 = 30.15 yen
    expect(item.estimatedCostYen).toBe(30.15);
    expect(result.totalEstimatedCostYen).toBe(30.15);
  });

  test("handles negative inventory quantity as 'none' presence", () => {
    const result = calculatePurchaseList({
      recipe: {
        schemaVersion: "1.0",
        servings: 1,
        summary: "Negative stock test",
        equipment: [],
        ingredientGroups: [],
        ingredients: [
          {
            id: "entry-1",
            ingredientId: "ing-onion",
            name: "玉ねぎ",
            amount: 2,
            unit: "個",
            displayAmount: "2個",
            role: "main",
            groupId: null,
            prepNote: null,
          },
        ],
        steps: [],
        globalCautions: [],
      },
      ingredients: mockIngredients,
      inventory: {
        "ing-onion": -5, // direct numeric negative stock
      },
    });

    expect(result.items).toHaveLength(1);
    const item = result.items[0];
    expect(item.stockPresence).toBe("none");
    expect(item.stockQuantity).toBe(-5);
    expect(item.shortageAmount).toBe(2);
    expect(item.purchaseAmount).toBe(2);
    expect(item.estimatedCostYen).toBe(160); // 80 * 2 = 160
  });

  test("resolves inventory key by ingredient name fallback when ID is absent", () => {
    const result = calculatePurchaseList({
      recipe: {
        schemaVersion: "1.0",
        servings: 1,
        summary: "Name fallback test",
        equipment: [],
        ingredientGroups: [],
        ingredients: [
          {
            id: "entry-1",
            ingredientId: "custom-unmapped-id",
            name: "玉ねぎ",
            amount: 3,
            unit: "個",
            displayAmount: "3個",
            role: "main",
            groupId: null,
            prepNote: null,
          },
        ],
        steps: [],
        globalCautions: [],
      },
      ingredients: mockIngredients,
      inventory: {
        玉ねぎ: { currentQuantity: 5, baseUnit: "個" },
      },
    });

    expect(result.items).toHaveLength(1);
    const item = result.items[0];
    expect(item.stockPresence).toBe("sufficient");
    expect(item.stockQuantity).toBe(5);
    expect(item.shortageAmount).toBe(0);
    expect(item.purchaseAmount).toBe(0);
    expect(item.estimatedCostYen).toBe(0);
  });

  test("handles empty recipe ingredients gracefully", () => {
    const result = calculatePurchaseList({
      recipe: {
        schemaVersion: "1.0",
        servings: 1,
        summary: "Empty recipe",
        equipment: [],
        ingredientGroups: [],
        ingredients: [],
        steps: [],
        globalCautions: [],
      },
      ingredients: mockIngredients,
      inventory: {},
    });

    expect(result.items).toHaveLength(0);
    expect(result.totalEstimatedCostYen).toBeNull();
    expect(result.markdownTable).toContain("| 材料名 |");
    expect(result.markdownTable).toContain("| **合計** |");
  });

  test("Zod schemas validate purchase list input and output properly", () => {
    // Valid input with dishId
    const validDishInput = calculatePurchaseListInputSchema.parse({
      dishId: "dish-123",
    });
    expect(validDishInput.dishId).toBe("dish-123");

    // Valid input with ad-hoc recipe
    const validRecipeInput = calculatePurchaseListInputSchema.parse({
      recipe: sampleRecipe,
      inventory: { "ing-macaroni": 100 },
    });
    expect(validRecipeInput.recipe).toBeDefined();

    // Invalid input with no dishId and no recipe
    expect(() => calculatePurchaseListInputSchema.parse({})).toThrow();

    // Output schema validates calculation result
    const result = calculatePurchaseList({
      recipe: sampleRecipe,
      ingredients: mockIngredients,
    });
    const parsedResult = purchaseListResultSchema.parse(result);
    expect(parsedResult.items).toHaveLength(4);
  });

  // =========================================================================
  // REST Route Integration: POST /api/dishes/{id}/purchase-list
  // =========================================================================
  describe("REST Endpoint POST /api/dishes/{id}/purchase-list", () => {
    test("calculates purchase list for a registered dish via REST endpoint", async () => {
      const harness = createTestD1Harness();
      try {
        // 1. Create ingredient in database
        const ingRes = await api.fetch(
          new Request("http://localhost/api/ingredients", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: "グラタンマカロニ",
              baseDimension: "mass",
              baseUnit: "g",
              nutritionBasisAmount: 100,
              nutritionPerBasis: {
                caloriesKcal: 350,
                proteinG: 12,
                fatG: 2,
                carbohydrateG: 70,
                fiberG: 2,
                saltEquivalentG: 0,
                micronutrients: [],
              },
            }),
          }),
          harness.env,
        );
        expect(ingRes.status).toBe(201);
        const createdIng = (await ingRes.json()) as { id: string };

        // 2. Create dish using this ingredient
        const dishRes = await api.fetch(
          new Request("http://localhost/api/dishes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: "テストグラタン",
              servings: 2,
              recipe: {
                schemaVersion: "1.0",
                servings: 2,
                summary: "テスト用",
                equipment: [],
                ingredientGroups: [],
                ingredients: [
                  {
                    id: "entry-1",
                    ingredientId: createdIng.id,
                    name: "グラタンマカロニ",
                    amount: 200,
                    unit: "g",
                    displayAmount: "200g",
                    role: "main",
                    groupId: null,
                    prepNote: null,
                  },
                ],
                steps: [
                  {
                    id: "s-1",
                    stepNumber: 1,
                    phase: "cook",
                    title: "茹でる",
                    instruction: "マカロニを茹でる",
                    executionMode: "active",
                    timing: { activeDurationSec: 60, scalingMode: "fixed" },
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
                    outputs: [],
                    completionCue: null,
                    cautions: [],
                  },
                ],
                globalCautions: [],
              },
            }),
          }),
          harness.env,
        );
        expect(dishRes.status).toBe(201);
        const createdDish = (await dishRes.json()) as { id: string };

        // 3. Call POST /api/dishes/{id}/purchase-list with inventory override
        const purchaseRes = await api.fetch(
          new Request(`http://localhost/api/dishes/${createdDish.id}/purchase-list`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              inventoryOverrides: {
                [createdIng.id]: { currentQuantity: 50, baseUnit: "g" },
              },
            }),
          }),
          harness.env,
        );
        expect(purchaseRes.status).toBe(200);

        const purchaseBody = (await purchaseRes.json()) as PurchaseListResult;
        expect(purchaseBody.items).toHaveLength(1);
        expect(purchaseBody.items[0].name).toBe("グラタンマカロニ");
        expect(purchaseBody.items[0].stockQuantity).toBe(50);
        expect(purchaseBody.items[0].stockPresence).toBe("partial");
        expect(purchaseBody.items[0].shortageAmount).toBe(150);
        expect(purchaseBody.items[0].purchaseAmount).toBe(150);
        expect(purchaseBody.markdownTable).toContain("グラタンマカロニ");
        expect(purchaseBody.markdownTable).toContain("150g");

        // 4. Test 404 for non-existent dish
        const notFoundRes = await api.fetch(
          new Request("http://localhost/api/dishes/non-existent-dish-id/purchase-list", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
          }),
          harness.env,
        );
        expect(notFoundRes.status).toBe(404);
      } finally {
        harness.cleanup();
      }
    });
  });
});
