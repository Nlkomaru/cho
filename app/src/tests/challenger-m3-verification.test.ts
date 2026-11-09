import { describe, expect, test } from "vite-plus/test";
import { z } from "zod";

import { api } from "../api";
import { mcpToolNames, purchaseListResultSchema } from "../domain/mcp";
import type { RecipeJson } from "../domain/recipe";
import {
  createTwelveIngredientRecipePayload,
  twelveIngredientsMaster,
} from "./fixtures/recipe-fixtures";
import { createTestD1Harness } from "./test-harness";

describe("Empirical Challenger M3: MCP & REST Purchase List Adversarial Suite", () => {
  // Helper to build a schema-valid RecipeJson
  function buildValidRecipe(
    ingredients: Array<{
      id?: string;
      ingredientId?: string;
      name: string;
      amount: number;
      unit: string;
      displayAmount?: string;
    }>,
    title = "Ad-hoc Recipe",
  ): RecipeJson {
    const recipeIngredients = ingredients.map((item, idx) => ({
      id: item.id ?? `entry-${idx + 1}`,
      ingredientId: item.ingredientId ?? `ing-adhoc-${idx + 1}`,
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
        title,
        instruction: "Cook ingredients",
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
        outputs: [{ id: "out-1", label: "Finished" }],
        completionCue: null,
        cautions: [],
        imageIds: [],
      },
    ];

    return {
      schemaVersion: "1.0",
      servings: 2,
      summary: `${title} summary`,
      equipment: [],
      ingredientGroups: [],
      ingredients: recipeIngredients,
      steps,
      globalCautions: [],
    };
  }

  // Helper to seed ingredients and create a sample dish
  async function setupDishFixture(harness: ReturnType<typeof createTestD1Harness>, secret: string) {
    // 1. Create ingredients in database
    const onionRes = await harness.callMcp(secret, "create_ingredient", {
      name: "玉ねぎ",
      baseDimension: "mass",
      baseUnit: "g",
      nutritionBasisAmount: 100,
      nutritionPerBasis: {
        caloriesKcal: 37,
        proteinG: 1,
        fatG: 0.1,
        carbohydrateG: 8.8,
        fiberG: 1.6,
        saltEquivalentG: 0,
        micronutrients: [],
      },
    });
    const onionId = z
      .object({ ingredient: z.object({ id: z.string() }) })
      .parse(onionRes.body.result?.structuredContent).ingredient.id;

    const milkRes = await harness.callMcp(secret, "create_ingredient", {
      name: "牛乳",
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
    });
    const milkId = z
      .object({ ingredient: z.object({ id: z.string() }) })
      .parse(milkRes.body.result?.structuredContent).ingredient.id;

    const macaroniRes = await harness.callMcp(secret, "create_ingredient", {
      name: "マカロニ",
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
    });
    const macaroniId = z
      .object({ ingredient: z.object({ id: z.string() }) })
      .parse(macaroniRes.body.result?.structuredContent).ingredient.id;

    // Set prices in DB
    // 玉ねぎ: 40 yen / 100g
    // 牛乳: 30 yen / 100mL
    // マカロニ: 60 yen / 100g
    harness.sqlite
      .prepare("UPDATE ingredients SET latest_unit_price_yen = ? WHERE id = ?")
      .run(40, onionId);
    harness.sqlite
      .prepare("UPDATE ingredients SET latest_unit_price_yen = ? WHERE id = ?")
      .run(30, milkId);
    harness.sqlite
      .prepare("UPDATE ingredients SET latest_unit_price_yen = ? WHERE id = ?")
      .run(60, macaroniId);

    // 2. Create a 3-ingredient dish
    const recipePayload = {
      name: "グラタンテスト",
      category: "main",
      servings: 2,
      coverImageId: null,
      notes: "テスト用グラタン",
      recipe: buildValidRecipe([
        { id: "entry-onion", ingredientId: onionId, name: "玉ねぎ", amount: 200, unit: "g" },
        { id: "entry-milk", ingredientId: milkId, name: "牛乳", amount: 300, unit: "mL" },
        {
          id: "entry-macaroni",
          ingredientId: macaroniId,
          name: "マカロニ",
          amount: 150,
          unit: "g",
        },
      ]),
    };

    const createRecipeRes = await harness.callMcp(secret, "create_recipe", recipePayload);
    expect(createRecipeRes.response.status).toBe(200);
    const dishId = z
      .object({ recipe: z.object({ id: z.string() }) })
      .parse(createRecipeRes.body.result?.structuredContent).recipe.id;

    return {
      dishId,
      onionId,
      milkId,
      macaroniId,
    };
  }

  // =========================================================================
  // Challenge 1: MCP calculate_purchase_list with registered dish (dishId & recipeId)
  // =========================================================================
  describe("Challenge 1: MCP calculate_purchase_list with registered dish", () => {
    test("calculates purchase list via dishId and outputs complete 9-column Markdown table", async () => {
      const harness = createTestD1Harness({ enforceVariableLimit: true });
      try {
        const { secret } = await harness.issueToken([...mcpToolNames]);
        const { dishId, onionId, milkId, macaroniId } = await setupDishFixture(harness, secret);

        // Call MCP calculate_purchase_list using dishId
        const toolRes = await harness.callMcp(secret, "calculate_purchase_list", {
          dishId,
        });

        expect(toolRes.response.status).toBe(200);
        expect(toolRes.body.error).toBeUndefined();

        const structured = purchaseListResultSchema.parse(toolRes.body.result?.structuredContent);

        // Assert 3 items
        expect(structured.items).toHaveLength(3);

        // All stock is unknown because no inventory was passed
        // 玉ねぎ: required 200g, unit price 40/100g -> cost 80 yen
        // 牛乳: required 300mL, unit price 30/100mL -> cost 90 yen
        // マカロニ: required 150g, unit price 60/100g -> cost 90 yen
        // Total expected cost: 80 + 90 + 90 = 260 yen
        expect(structured.totalEstimatedCostYen).toBe(260);

        const onionItem = structured.items.find((i) => i.ingredientId === onionId);
        expect(onionItem).toBeDefined();
        expect(onionItem?.name).toBe("玉ねぎ");
        expect(onionItem?.requiredAmount).toBe(200);
        expect(onionItem?.unit).toBe("g");
        expect(onionItem?.stockQuantity).toBeNull();
        expect(onionItem?.stockPresence).toBe("unknown");
        expect(onionItem?.shortageAmount).toBe(200);
        expect(onionItem?.purchaseAmount).toBe(200);
        expect(onionItem?.unitPriceYen).toBe(40);
        expect(onionItem?.estimatedCostYen).toBe(80);
        expect(onionItem?.isUnregistered).toBe(false);

        const milkItem = structured.items.find((i) => i.ingredientId === milkId);
        expect(milkItem?.estimatedCostYen).toBe(90);

        const macaroniItem = structured.items.find((i) => i.ingredientId === macaroniId);
        expect(macaroniItem?.estimatedCostYen).toBe(90);

        // Assert Markdown Table Structure
        const lines = structured.markdownTable.trim().split("\n");
        // Header (line 0) + Separator (line 1) + 3 rows + Total row (line 5) = 6 lines
        expect(lines).toHaveLength(6);

        // Verify Header
        expect(lines[0]).toBe(
          "| 材料名 | 必要量 | 在庫量 | 在庫状況 | 不足量 | 買い足し量 | 参考単価 | 概算費用 | 登録状態 |",
        );
        expect(lines[1]).toBe("| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |");

        // Check columns per line
        for (const line of lines) {
          const cells = line.split("|").slice(1, -1);
          expect(cells).toHaveLength(9);
        }

        // Total row verification
        expect(lines[5]).toBe("| **合計** | - | - | - | - | - | - | **260円** | - |");
      } finally {
        harness.cleanup();
      }
    });

    test("supports recipeId alias identically to dishId", async () => {
      const harness = createTestD1Harness({ enforceVariableLimit: true });
      try {
        const { secret } = await harness.issueToken([...mcpToolNames]);
        const { dishId } = await setupDishFixture(harness, secret);

        // Call using recipeId alias
        const toolRes = await harness.callMcp(secret, "calculate_purchase_list", {
          recipeId: dishId,
        });

        expect(toolRes.response.status).toBe(200);
        expect(toolRes.body.error).toBeUndefined();

        const structured = purchaseListResultSchema.parse(toolRes.body.result?.structuredContent);
        expect(structured.items).toHaveLength(3);
        expect(structured.totalEstimatedCostYen).toBe(260);
      } finally {
        harness.cleanup();
      }
    });
  });

  // =========================================================================
  // Challenge 2: Ad-hoc recipe and custom inventoryOverrides
  // =========================================================================
  describe("Challenge 2: Ad-hoc recipe and custom inventoryOverrides", () => {
    test("evaluates ad-hoc recipe with mixed stock presences and override precedence", async () => {
      const harness = createTestD1Harness({ enforceVariableLimit: true });
      try {
        const { secret } = await harness.issueToken([...mcpToolNames]);
        const { onionId, milkId, macaroniId } = await setupDishFixture(harness, secret);

        const adhocRecipe = buildValidRecipe([
          // 1. Sufficient: required 200, inventory 300
          { id: "e-1", ingredientId: onionId, name: "玉ねぎ", amount: 200, unit: "g" },
          // 2. Partial: required 300, inventory 100
          { id: "e-2", ingredientId: milkId, name: "牛乳", amount: 300, unit: "mL" },
          // 3. None (zero stock): required 150, inventory 0
          { id: "e-3", ingredientId: macaroniId, name: "マカロニ", amount: 150, unit: "g" },
          // 4. Unknown: stock not provided
          { id: "e-4", ingredientId: "ing-pepper-unreg", name: "こしょう", amount: 5, unit: "g" },
          // 5. Unregistered ingredient with inventory override
          {
            id: "e-5",
            ingredientId: "ing-spice-unreg",
            name: "特製スパイス",
            amount: 20,
            unit: "g",
          },
        ]);

        const toolRes = await harness.callMcp(secret, "calculate_purchase_list", {
          recipe: adhocRecipe,
          // inventory has initial stock
          inventory: {
            [onionId]: { currentQuantity: 50, baseUnit: "g" }, // will be overridden below!
            [milkId]: 100, // numeric shorthand: partial (100 < 300)
            [macaroniId]: 0, // none (0)
          },
          // inventoryOverrides overrides onion to 300 (sufficient) and provides for unregistered
          inventoryOverrides: {
            [onionId]: { currentQuantity: 300, baseUnit: "g" }, // overrides 50 -> 300 (sufficient)
            特製スパイス: 5, // partial for unregistered item (5 < 20)
          },
        });

        expect(toolRes.response.status).toBe(200);
        expect(toolRes.body.error).toBeUndefined();

        const structured = purchaseListResultSchema.parse(toolRes.body.result?.structuredContent);

        expect(structured.items).toHaveLength(5);

        // 1. Onion: sufficient due to override
        const onion = structured.items.find((i) => i.name === "玉ねぎ")!;
        expect(onion.stockQuantity).toBe(300);
        expect(onion.stockPresence).toBe("sufficient");
        expect(onion.shortageAmount).toBe(0);
        expect(onion.purchaseAmount).toBe(0);
        expect(onion.estimatedCostYen).toBe(0);

        // 2. Milk: partial (100 < 300 -> shortage 200mL)
        // Unit price 30 yen / 100mL -> cost (30 * 200)/100 = 60 yen
        const milk = structured.items.find((i) => i.name === "牛乳")!;
        expect(milk.stockQuantity).toBe(100);
        expect(milk.stockPresence).toBe("partial");
        expect(milk.shortageAmount).toBe(200);
        expect(milk.purchaseAmount).toBe(200);
        expect(milk.estimatedCostYen).toBe(60);

        // 3. Macaroni: none (0 stock -> shortage 150g)
        // Unit price 60 yen / 100g -> cost (60 * 150)/100 = 90 yen
        const macaroni = structured.items.find((i) => i.name === "マカロニ")!;
        expect(macaroni.stockQuantity).toBe(0);
        expect(macaroni.stockPresence).toBe("none");
        expect(macaroni.shortageAmount).toBe(150);
        expect(macaroni.purchaseAmount).toBe(150);
        expect(macaroni.estimatedCostYen).toBe(90);

        // 4. Pepper (こしょう): unknown (not in inventory)
        // Unregistered, no unit price -> cost null
        const pepper = structured.items.find((i) => i.name === "こしょう")!;
        expect(pepper.stockQuantity).toBeNull();
        expect(pepper.stockPresence).toBe("unknown");
        expect(pepper.shortageAmount).toBe(5);
        expect(pepper.purchaseAmount).toBe(5);
        expect(pepper.isUnregistered).toBe(true);
        expect(pepper.estimatedCostYen).toBeNull();

        // 5. Special Spice (特製スパイス): unregistered but inventory key resolved by name!
        // required 20, stock 5 -> partial, shortage 15
        const spice = structured.items.find((i) => i.name === "特製スパイス")!;
        expect(spice.stockQuantity).toBe(5);
        expect(spice.stockPresence).toBe("partial");
        expect(spice.shortageAmount).toBe(15);
        expect(spice.purchaseAmount).toBe(15);
        expect(spice.isUnregistered).toBe(true);
        expect(spice.estimatedCostYen).toBeNull();

        // Total cost sum of items with known costs: 0 (onion) + 60 (milk) + 90 (macaroni) = 150 yen
        expect(structured.totalEstimatedCostYen).toBe(150);

        // Assert Markdown table contains correct status labels
        expect(structured.markdownTable).toContain("充足");
        expect(structured.markdownTable).toContain("一部あり");
        expect(structured.markdownTable).toContain("なし");
        expect(structured.markdownTable).toContain("不明");
        expect(structured.markdownTable).toContain("未登録");
        expect(structured.markdownTable).toContain("登録済");
        expect(structured.markdownTable).toContain(
          "| **合計** | - | - | - | - | - | - | **150円** | - |",
        );
      } finally {
        harness.cleanup();
      }
    });

    test("handles negative inventory as stockPresence none", async () => {
      const harness = createTestD1Harness({ enforceVariableLimit: true });
      try {
        const { secret } = await harness.issueToken([...mcpToolNames]);
        const { onionId } = await setupDishFixture(harness, secret);

        const toolRes = await harness.callMcp(secret, "calculate_purchase_list", {
          recipe: buildValidRecipe([
            { id: "e-1", ingredientId: onionId, name: "玉ねぎ", amount: 100, unit: "g" },
          ]),
          inventoryOverrides: {
            [onionId]: -20, // Negative stock value
          },
        });

        expect(toolRes.response.status).toBe(200);
        const structured = purchaseListResultSchema.parse(toolRes.body.result?.structuredContent);
        expect(structured.items[0].stockQuantity).toBe(-20);
        expect(structured.items[0].stockPresence).toBe("none");
        expect(structured.items[0].shortageAmount).toBe(100);
        expect(structured.items[0].purchaseAmount).toBe(100);
      } finally {
        harness.cleanup();
      }
    });
  });

  // =========================================================================
  // Challenge 3: MCP Error handling & boundary defense
  // =========================================================================
  describe("Challenge 3: MCP error handling & boundary defense", () => {
    test("rejects non-existent dishId with error", async () => {
      const harness = createTestD1Harness({ enforceVariableLimit: true });
      try {
        const { secret } = await harness.issueToken([...mcpToolNames]);

        const fakeId = "00000000-0000-4000-8000-000000000000";
        const toolRes = await harness.callMcp(secret, "calculate_purchase_list", {
          dishId: fakeId,
        });

        expect(toolRes.response.status).toBe(200);
        // MCP error returns isError: true with message
        expect(toolRes.body.result?.isError).toBe(true);
        const content = toolRes.body.result?.content as Array<{ text: string }> | undefined;
        expect(content?.[0]?.text).toContain(`Dish not found: ${fakeId}`);
      } finally {
        harness.cleanup();
      }
    });

    test("rejects non-existent recipeId with error", async () => {
      const harness = createTestD1Harness({ enforceVariableLimit: true });
      try {
        const { secret } = await harness.issueToken([...mcpToolNames]);

        const fakeId = "11111111-2222-4333-8444-555555555555";
        const toolRes = await harness.callMcp(secret, "calculate_purchase_list", {
          recipeId: fakeId,
        });

        expect(toolRes.response.status).toBe(200);
        expect(toolRes.body.result?.isError).toBe(true);
        const content = toolRes.body.result?.content as Array<{ text: string }> | undefined;
        expect(content?.[0]?.text).toContain(`Dish not found: ${fakeId}`);
      } finally {
        harness.cleanup();
      }
    });

    test("rejects empty arguments object missing dishId/recipeId/recipe", async () => {
      const harness = createTestD1Harness({ enforceVariableLimit: true });
      try {
        const { secret } = await harness.issueToken([...mcpToolNames]);

        const toolRes = await harness.callMcp(secret, "calculate_purchase_list", {});

        expect(toolRes.response.status).toBe(200);
        expect(toolRes.body.result?.isError).toBe(true);
        const content = toolRes.body.result?.content as Array<{ text: string }> | undefined;
        expect(content?.[0]?.text).toMatch(/Either dishId, recipeId, or recipe must be provided/i);
      } finally {
        harness.cleanup();
      }
    });

    test("rejects blank or whitespace dishId", async () => {
      const harness = createTestD1Harness({ enforceVariableLimit: true });
      try {
        const { secret } = await harness.issueToken([...mcpToolNames]);

        const toolRes = await harness.callMcp(secret, "calculate_purchase_list", {
          dishId: "   ",
        });

        expect(toolRes.response.status).toBe(200);
        expect(toolRes.body.result?.isError).toBe(true);
      } finally {
        harness.cleanup();
      }
    });

    test("rejects unrecognized extraneous properties under .strict() validation", async () => {
      const harness = createTestD1Harness({ enforceVariableLimit: true });
      try {
        const { secret } = await harness.issueToken([...mcpToolNames]);
        const { dishId } = await setupDishFixture(harness, secret);

        const toolRes = await harness.callMcp(secret, "calculate_purchase_list", {
          dishId,
          unexpectedExtraProperty: "malicious_injection",
        });

        expect(toolRes.response.status).toBe(200);
        expect(toolRes.body.result?.isError).toBe(true);
        const content = toolRes.body.result?.content as Array<{ text: string }> | undefined;
        expect(content?.[0]?.text).toMatch(/unrecognized key/i);
      } finally {
        harness.cleanup();
      }
    });

    test("rejects execution when token lacks calculate_purchase_list permission", async () => {
      const harness = createTestD1Harness({ enforceVariableLimit: true });
      try {
        const fullToken = await harness.issueToken([...mcpToolNames]);
        const { dishId } = await setupDishFixture(harness, fullToken.secret);

        // Token issued WITHOUT calculate_purchase_list
        const restrictedToken = await harness.issueToken(["list_recipes", "list_ingredients"]);

        const toolRes = await harness.callMcp(restrictedToken.secret, "calculate_purchase_list", {
          dishId,
        });

        expect(toolRes.response.status).toBe(200);
        // Returns RPC error or tool error
        expect(toolRes.body.error !== undefined || toolRes.body.result?.isError === true).toBe(
          true,
        );
      } finally {
        harness.cleanup();
      }
    });
  });

  // =========================================================================
  // Challenge 4: REST API POST /api/dishes/:id/purchase-list
  // =========================================================================
  describe("Challenge 4: REST API POST /api/dishes/:id/purchase-list", () => {
    test("returns 200 OK with complete purchase list on empty object body", async () => {
      const harness = createTestD1Harness({ enforceVariableLimit: true });
      try {
        const { secret } = await harness.issueToken([...mcpToolNames]);
        const { dishId } = await setupDishFixture(harness, secret);

        const res = await api.fetch(
          new Request(`http://localhost/api/dishes/${dishId}/purchase-list`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
          }),
          harness.env,
        );

        expect(res.status).toBe(200);
        const data = purchaseListResultSchema.parse(await res.json());
        expect(data.items).toHaveLength(3);
        expect(data.totalEstimatedCostYen).toBe(260);
        expect(data.markdownTable).toContain(
          "| **合計** | - | - | - | - | - | - | **260円** | - |",
        );
      } finally {
        harness.cleanup();
      }
    });

    test("returns 200 OK with inventoryOverrides applied", async () => {
      const harness = createTestD1Harness({ enforceVariableLimit: true });
      try {
        const { secret } = await harness.issueToken([...mcpToolNames]);
        const { dishId, onionId, milkId, macaroniId } = await setupDishFixture(harness, secret);

        const res = await api.fetch(
          new Request(`http://localhost/api/dishes/${dishId}/purchase-list`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              inventoryOverrides: {
                [onionId]: 200, // exact sufficient (200 >= 200) -> 0 cost
                [milkId]: { currentQuantity: 150, baseUnit: "mL" }, // partial (150 < 300) -> shortage 150 -> 45 yen
                [macaroniId]: 150, // exact sufficient (150 >= 150) -> 0 cost
              },
            }),
          }),
          harness.env,
        );

        expect(res.status).toBe(200);
        const data = purchaseListResultSchema.parse(await res.json());
        expect(data.items).toHaveLength(3);

        const onion = data.items.find((i) => i.ingredientId === onionId);
        expect(onion?.stockPresence).toBe("sufficient");
        expect(onion?.shortageAmount).toBe(0);

        const milk = data.items.find((i) => i.ingredientId === milkId);
        expect(milk?.stockPresence).toBe("partial");
        expect(milk?.shortageAmount).toBe(150);
        expect(milk?.estimatedCostYen).toBe(45);

        const macaroni = data.items.find((i) => i.ingredientId === macaroniId);
        expect(macaroni?.stockPresence).toBe("sufficient");
        expect(macaroni?.shortageAmount).toBe(0);

        expect(data.totalEstimatedCostYen).toBe(45);
      } finally {
        harness.cleanup();
      }
    });

    test("returns 404 Not Found when dish ID does not exist", async () => {
      const harness = createTestD1Harness({ enforceVariableLimit: true });
      try {
        const nonExistentId = "00000000-0000-4000-8000-000000000000";
        const res = await api.fetch(
          new Request(`http://localhost/api/dishes/${nonExistentId}/purchase-list`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
          }),
          harness.env,
        );

        expect(res.status).toBe(404);
        const body = (await res.json()) as { error: string };
        expect(body.error).toBe("Dish not found.");
      } finally {
        harness.cleanup();
      }
    });

    test("returns 400 Bad Request when request body has invalid types", async () => {
      const harness = createTestD1Harness({ enforceVariableLimit: true });
      try {
        const { secret } = await harness.issueToken([...mcpToolNames]);
        const { dishId } = await setupDishFixture(harness, secret);

        const res = await api.fetch(
          new Request(`http://localhost/api/dishes/${dishId}/purchase-list`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              inventory: "invalid_not_an_object",
            }),
          }),
          harness.env,
        );

        expect(res.status).toBe(400);
      } finally {
        harness.cleanup();
      }
    });

    test("returns 400 Bad Request when body contains unauthorized fields (.strict())", async () => {
      const harness = createTestD1Harness({ enforceVariableLimit: true });
      try {
        const { secret } = await harness.issueToken([...mcpToolNames]);
        const { dishId } = await setupDishFixture(harness, secret);

        const res = await api.fetch(
          new Request(`http://localhost/api/dishes/${dishId}/purchase-list`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              unrecognizedField: "fail",
            }),
          }),
          harness.env,
        );

        expect(res.status).toBe(400);
      } finally {
        harness.cleanup();
      }
    });
  });

  // =========================================================================
  // Challenge 5: Complex Edge Cases & Scale Stress Tests
  // =========================================================================
  describe("Challenge 5: Scale stress testing & precision boundary", () => {
    test("12-ingredient dish generates complete 15-line markdown table with precision", async () => {
      const harness = createTestD1Harness({ enforceVariableLimit: true });
      try {
        const { secret } = await harness.issueToken([...mcpToolNames]);

        // Register 12 master ingredients
        const ingredientIdMap: Record<string, string> = {};
        for (const master of twelveIngredientsMaster) {
          const created = await harness.callMcp(secret, "create_ingredient", {
            name: master.name,
            baseDimension: master.baseDimension,
            baseUnit: master.baseUnit,
            nutritionBasisAmount: master.nutritionBasisAmount,
            nutritionPerBasis: master.nutritionPerBasis,
          });
          const id = z
            .object({ ingredient: z.object({ id: z.string() }) })
            .parse(created.body.result?.structuredContent).ingredient.id;
          ingredientIdMap[master.name] = id;

          if (master.latestUnitPriceYen !== null) {
            harness.sqlite
              .prepare("UPDATE ingredients SET latest_unit_price_yen = ? WHERE id = ?")
              .run(master.latestUnitPriceYen, id);
          }
        }

        const dishPayload = {
          ...createTwelveIngredientRecipePayload(ingredientIdMap),
          coverImageId: null,
        };
        const createDishRes = await harness.callMcp(secret, "create_recipe", dishPayload);
        const dishId = z
          .object({ recipe: z.object({ id: z.string() }) })
          .parse(createDishRes.body.result?.structuredContent).recipe.id;

        // Calculate purchase list via MCP with custom stock overrides
        const calcRes = await harness.callMcp(secret, "calculate_purchase_list", {
          dishId,
          inventoryOverrides: {
            // First 4 sufficient
            [ingredientIdMap["玉ねぎ"]]: 500,
            [ingredientIdMap["鶏もも肉"]]: 400,
            [ingredientIdMap["マカロニ"]]: 200,
            [ingredientIdMap["牛乳"]]: 500,
            // Next 2 partial
            [ingredientIdMap["ブロッコリー"]]: 50,
            [ingredientIdMap["ピザ用チーズ"]]: 30,
            // Rest none (0)
            [ingredientIdMap["薄力粉"]]: 0,
            [ingredientIdMap["無塩バター"]]: 0,
          },
        });

        expect(calcRes.response.status).toBe(200);
        const structured = purchaseListResultSchema.parse(calcRes.body.result?.structuredContent);

        expect(structured.items).toHaveLength(12);

        // Verify table lines count:
        // Header + separator + 12 items + total row = 15 lines
        const tableLines = structured.markdownTable.trim().split("\n");
        expect(tableLines).toHaveLength(15);

        // Verify total sum consistency: sum of item costs must equal totalEstimatedCostYen
        const manualSum =
          Math.round(
            structured.items
              .filter((i) => i.estimatedCostYen !== null)
              .reduce((acc, i) => acc + (i.estimatedCostYen ?? 0), 0) * 100,
          ) / 100;
        expect(structured.totalEstimatedCostYen).toBe(manualSum);

        // Also test REST API on the same 12-ingredient dish
        const restRes = await api.fetch(
          new Request(`http://localhost/api/dishes/${dishId}/purchase-list`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
          }),
          harness.env,
        );
        expect(restRes.status).toBe(200);
        const restData = purchaseListResultSchema.parse(await restRes.json());
        expect(restData.items).toHaveLength(12);
      } finally {
        harness.cleanup();
      }
    });

    test("stress test: 50-ingredient recipe completes rapidly with exact row count", async () => {
      const harness = createTestD1Harness({ enforceVariableLimit: true });
      try {
        const { secret } = await harness.issueToken([...mcpToolNames]);

        // Generate 50 ad-hoc ingredients
        const rawIngredients: Array<{ name: string; amount: number; unit: string }> = [];
        const inventory: Record<string, number> = {};

        for (let i = 1; i <= 50; i++) {
          const name = `食材_${i.toString().padStart(2, "0")}`;
          rawIngredients.push({
            name,
            amount: i * 10,
            unit: "g",
          });
          // Every 3rd item has inventory
          if (i % 3 === 0) {
            inventory[name] = i * 5; // partial
          } else if (i % 3 === 1) {
            inventory[name] = i * 20; // sufficient
          } // i % 3 === 2: not in inventory (unknown)
        }

        const largeRecipe = buildValidRecipe(rawIngredients, "50食材の特大レシピ");

        const startTime = Date.now();
        const toolRes = await harness.callMcp(secret, "calculate_purchase_list", {
          recipe: largeRecipe,
          inventory,
        });
        const duration = Date.now() - startTime;

        expect(toolRes.response.status).toBe(200);
        expect(toolRes.body.error).toBeUndefined();

        const structured = purchaseListResultSchema.parse(toolRes.body.result?.structuredContent);

        expect(structured.items).toHaveLength(50);

        // Header (1) + Separator (1) + 50 items + Total (1) = 53 lines
        const lines = structured.markdownTable.trim().split("\n");
        expect(lines).toHaveLength(53);

        // Assert performance (< 500ms)
        expect(duration).toBeLessThan(500);
      } finally {
        harness.cleanup();
      }
    });

    test("handles floating-point decimal stock without precision rounding artifacts", async () => {
      const harness = createTestD1Harness({ enforceVariableLimit: true });
      try {
        const { secret } = await harness.issueToken([...mcpToolNames]);

        const recipe = buildValidRecipe([
          // 0.3 - 0.1 in binary float is 0.19999999999999998 without rounding
          { name: "サフラン", amount: 0.3, unit: "g" },
          // 1.0 - 0.9 = 0.09999999999999998
          { name: "バニラエッセンス", amount: 1.0, unit: "g" },
        ]);

        const toolRes = await harness.callMcp(secret, "calculate_purchase_list", {
          recipe,
          inventoryOverrides: {
            サフラン: 0.1,
            バニラエッセンス: 0.9,
          },
        });

        expect(toolRes.response.status).toBe(200);
        const structured = purchaseListResultSchema.parse(toolRes.body.result?.structuredContent);

        const saffron = structured.items.find((i) => i.name === "サフラン")!;
        expect(saffron.shortageAmount).toBe(0.2);
        expect(saffron.purchaseAmount).toBe(0.2);

        const vanilla = structured.items.find((i) => i.name === "バニラエッセンス")!;
        expect(vanilla.shortageAmount).toBe(0.1);
        expect(vanilla.purchaseAmount).toBe(0.1);

        // In markdown table: no 0.19999999999999998
        expect(structured.markdownTable).toContain("0.2g");
        expect(structured.markdownTable).toContain("0.1g");
        expect(structured.markdownTable).not.toContain("0.199999999999");
      } finally {
        harness.cleanup();
      }
    });
  });
});
