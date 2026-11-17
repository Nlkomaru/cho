import { afterEach, describe, expect, test } from "vitest";

import { api } from "./index";
import { createTestD1Harness } from "../tests/test-harness";

describe("foods API, recipe status, and dish stock/conversion routes", () => {
  const cleanups: (() => void)[] = [];

  afterEach(() => {
    while (cleanups.length > 0) {
      cleanups.pop()?.();
    }
  });

  test("supports food CRUD, meal log foodId snapshots, and dish-to-food conversion", async () => {
    const harness = createTestD1Harness();
    cleanups.push(harness.cleanup);

    // 1. Create a staple food directly
    const createFoodRes = await api.fetch(
      new Request("http://localhost/api/foods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "ごはん",
          category: "主食",
          servingLabel: "1杯 (150g)",
          priceYen: 60,
          nutrition: {
            caloriesKcal: 234,
            proteinG: 3.8,
            fatG: 0.5,
            carbohydrateG: 55.7,
            fiberG: 0.5,
            saltEquivalentG: 0,
            micronutrients: [],
          },
          memo: "0.75合相当",
        }),
      }),
      harness.env,
    );
    expect(createFoodRes.status).toBe(201);
    const food = (await createFoodRes.json()) as { id: string; name: string };
    expect(food.name).toBe("ごはん");

    // 2. Record a meal referencing the foodId and verify automatic nutrition/cost scaling
    const mealRes = await api.fetch(
      new Request("http://localhost/api/meals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eatenAt: "2026-11-18T12:00:00.000Z",
          mealTiming: "lunch",
          sourceType: "self_cooked",
          placeName: null,
          title: "昼ごはん",
          totalPriceYen: null,
          totalNutrition: null,
          rating: null,
          memo: null,
          imageIds: [],
          items: [
            {
              foodId: food.id,
              name: food.name,
              servingsFactor: 1.5,
              priceYen: null,
              nutrition: null,
              estimationSource: "food",
              sortOrder: 0,
            },
          ],
        }),
      }),
      harness.env,
    );
    expect(mealRes.status).toBe(201);
    const meal = (await mealRes.json()) as {
      id: string;
      totalPriceYen: number;
      totalNutrition: { caloriesKcal: number };
      items: { foodId: string; estimationSource: string }[];
    };
    expect(meal.totalPriceYen).toBe(90);
    expect(meal.totalNutrition.caloriesKcal).toBeCloseTo(351, 5);
    expect(meal.items[0]?.foodId).toBe(food.id);
    expect(meal.items[0]?.estimationSource).toBe("food");

    // 3. Removed meal consume-stock route should return 404
    const removedMealStockRes = await api.fetch(
      new Request(`http://localhost/api/meals/${meal.id}/consume-stock`, { method: "POST" }),
      harness.env,
    );
    expect(removedMealStockRes.status).toBe(404);

    // 4. Create an ingredient and a dish with explicit status "orbit", then convert to food
    const ingRes = await api.fetch(
      new Request("http://localhost/api/ingredients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "納豆パック",
          baseDimension: "count",
          baseUnit: "個",
          nutritionBasisAmount: 1,
          nutritionPerBasis: {
            caloriesKcal: 90,
            proteinG: 7.4,
            fatG: 4.5,
            carbohydrateG: 5.4,
            fiberG: 3.0,
            saltEquivalentG: 0.7,
            micronutrients: [],
          },
          latestUnitPriceYen: 35,
        }),
      }),
      harness.env,
    );
    expect(ingRes.status).toBe(201);
    const ing = (await ingRes.json()) as { id: string };

    const dishRes = await api.fetch(
      new Request("http://localhost/api/dishes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "納豆",
          category: "副菜",
          servings: 1,
          recipe: {
            schemaVersion: "1.0",
            status: "orbit",
            servings: 1,
            summary: null,
            equipment: [],
            ingredientGroups: [],
            ingredients: [
              {
                id: "ing-1",
                ingredientId: ing.id,
                label: null,
                amount: 1,
                unit: "個",
                displayAmount: "1パック",
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
                title: "混ぜる",
                instruction: "タレを入れて混ぜる",
                executionMode: "active",
                timing: { activeDurationSec: 30, passiveDurationSec: 0, scalingMode: "fixed" },
                dependsOnStepIds: [],
                resourceTags: [],
                heatLevel: "none",
                inputs: [{ type: "ingredient", ingredientEntryId: "ing-1", amountRatio: 1 }],
                outputs: [],
                cautions: [],
                imageIds: [],
              },
            ],
            globalCautions: [],
          },
        }),
      }),
      harness.env,
    );
    expect(dishRes.status).toBe(201);
    const dish = (await dishRes.json()) as { id: string; recipe: { status: string } };
    expect(dish.recipe.status).toBe("orbit");

    // Dish consume-stock should guard when INVENTIA_STOCK_WRITES_ENABLED !== "true"
    const dishStockRes = await api.fetch(
      new Request(`http://localhost/api/dishes/${dish.id}/consume-stock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ servings: 1 }),
      }),
      harness.env,
    );
    expect(dishStockRes.status).toBe(409);

    // Convert dish to food and verify original dish is deleted
    const convertRes = await api.fetch(
      new Request(`http://localhost/api/dishes/${dish.id}/convert-to-food`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ servingLabel: "1パック", deleteDish: true }),
      }),
      harness.env,
    );
    expect(convertRes.status).toBe(201);
    const converted = (await convertRes.json()) as {
      food: { id: string; name: string; servingLabel: string; priceYen: number };
      deletedDishId: string | null;
    };
    expect(converted.food.name).toBe("納豆");
    expect(converted.food.servingLabel).toBe("1パック");
    expect(converted.food.priceYen).toBe(35);
    expect(converted.deletedDishId).toBe(dish.id);

    const getDeletedDishRes = await api.fetch(
      new Request(`http://localhost/api/dishes/${dish.id}`),
      harness.env,
    );
    expect(getDeletedDishRes.status).toBe(404);
  });
});
