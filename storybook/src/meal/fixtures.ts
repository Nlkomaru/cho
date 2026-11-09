import type { Meal, MealItem } from "@/components/meal/meal-shared";

import { buildNutritionFacts } from "../fixtures/food";

/**
 * 食事記録のフィクスチャ。日時は固定 (2026-11-10 火曜) にして、スクリーンショットを安定させる。
 */
let sequence = 0;

export const buildMealItem = (overrides: Partial<MealItem> = {}): MealItem => {
  sequence += 1;
  return {
    id: `item-${sequence}`,
    name: "ポークカレー",
    dishId: null,
    ingredientId: null,
    servingsFactor: 1,
    priceYen: 186,
    nutrition: buildNutritionFacts(),
    ingredientCostBreakdown: [],
    estimationSource: "manual",
    sortOrder: 0,
    ...overrides,
  };
};

export const buildMeal = (overrides: Partial<Meal> = {}): Meal => {
  sequence += 1;
  return {
    id: `meal-${sequence}`,
    eatenAt: new Date(2026, 10, 10, 19, 0).toISOString(),
    mealTiming: "dinner",
    sourceType: "self_cooked",
    placeName: null,
    title: "ポークカレー",
    totalPriceYen: 186,
    totalNutrition: buildNutritionFacts(),
    imageIds: [],
    items: [buildMealItem()],
    memo: null,
    inventiaConsumptionStatus: null,
    ...overrides,
  };
};

/** レシピから記録した自炊のカレー (材料原価の内訳つき)。 */
export const curryMeal = buildMeal({
  id: "meal-curry",
  items: [
    buildMealItem({
      name: "ポークカレー",
      dishId: "dish-curry",
      estimationSource: "recipe",
      priceYen: 186,
      ingredientCostBreakdown: [
        { ingredientId: "rice", name: "精白米", amount: 150, unit: "g", costYen: 75 },
        { ingredientId: "pork", name: "豚こま切れ肉", amount: 50, unit: "g", costYen: 90 },
        { ingredientId: "onion", name: "玉ねぎ", amount: 50, unit: "g", costYen: 20 },
        { ingredientId: "roux", name: "カレールウ", amount: 1, unit: "g", costYen: 1.2 },
      ],
    }),
  ],
});

/** 学食の定食。品目を AI で推定。 */
export const cafeteriaMeal = buildMeal({
  id: "meal-cafeteria",
  eatenAt: new Date(2026, 10, 10, 12, 10).toISOString(),
  mealTiming: "lunch",
  sourceType: "cafeteria",
  placeName: "第二食堂",
  title: "日替わり定食",
  totalPriceYen: 550,
  totalNutrition: buildNutritionFacts({
    caloriesKcal: 780,
    proteinG: 28,
    fatG: 22,
    carbohydrateG: 110,
    fiberG: 4.2,
    saltEquivalentG: 3.6,
  }),
  items: [
    buildMealItem({
      name: "鶏の唐揚げ",
      priceYen: 300,
      estimationSource: "ai",
      nutrition: buildNutritionFacts({
        caloriesKcal: 420,
        proteinG: 21,
        fatG: 18,
        carbohydrateG: 34,
        fiberG: 1.2,
        saltEquivalentG: 1.8,
      }),
    }),
    buildMealItem({
      name: "ごはん (中)",
      priceYen: 150,
      estimationSource: "ai",
      nutrition: buildNutritionFacts({
        caloriesKcal: 312,
        proteinG: 4,
        fatG: 0.5,
        carbohydrateG: 69,
        fiberG: 2.4,
        saltEquivalentG: 0,
      }),
    }),
    buildMealItem({
      name: "味噌汁",
      priceYen: 100,
      estimationSource: "ai",
      nutrition: buildNutritionFacts({
        caloriesKcal: 48,
        proteinG: 3,
        fatG: 3.5,
        carbohydrateG: 7,
        fiberG: 0.6,
        saltEquivalentG: 1.8,
      }),
    }),
  ],
});

/** 栄養価の無いコンビニの朝食。 */
export const convenienceMeal = buildMeal({
  id: "meal-convenience",
  eatenAt: new Date(2026, 10, 9, 8, 0).toISOString(),
  mealTiming: "breakfast",
  sourceType: "convenience",
  title: "おにぎりとお茶",
  totalPriceYen: 280,
  totalNutrition: null,
  items: [buildMealItem({ name: "おにぎりとお茶", priceYen: 280, nutrition: null })],
});

export const weekMeals: readonly Meal[] = [curryMeal, cafeteriaMeal, convenienceMeal];

/** ストーリー用の写真 (外部の画像を読まないよう SVG を埋め込む)。 */
export const photoSrc = (hue: number) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" fill="hsl(${hue} 45% 82%)"/><circle cx="60" cy="62" r="34" fill="hsl(${hue} 40% 64%)"/></svg>`,
  )}`;
