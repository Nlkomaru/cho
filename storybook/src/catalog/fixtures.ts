import type { Ingredient } from "@/domain/ingredient";
import type { DishRow } from "@/routes/_app/dishes/-components/dish-table";
import type {
  InventiaActions,
  InventiaItem,
} from "@/routes/_app/ingredients/-components/inventia-link-panel";

import { buildNutritionFacts } from "../fixtures/food";
import { sampleImageIds } from "../fixtures/images";

let sequence = 0;

/** 材料マスタ 1 件。値は日本食品標準成分表に近いもの。 */
export const buildIngredient = (overrides: Partial<Ingredient> = {}): Ingredient => {
  sequence += 1;
  return {
    id: `ingredient-${sequence}`,
    name: "玉ねぎ",
    normalizedName: null,
    baseDimension: "mass",
    baseUnit: "g",
    nutritionBasisAmount: 100,
    nutritionPerBasis: buildNutritionFacts({
      caloriesKcal: 33,
      proteinG: 1,
      fatG: 0.1,
      carbohydrateG: 8.4,
      fiberG: 1.5,
      saltEquivalentG: 0,
    }),
    gramPerUnit: null,
    inventiaItemId: null,
    latestUnitPriceYen: 40,
    latestPriceUpdatedAt: "2026-11-01T00:00:00.000Z",
    memo: null,
    ...overrides,
  };
};

export const ingredients: readonly Ingredient[] = [
  buildIngredient({
    id: "onion",
    name: "玉ねぎ",
    gramPerUnit: 200,
    inventiaItemId: "itm_01JD8ONION",
    memo: "新玉ねぎの時期は水分が多い。",
  }),
  buildIngredient({
    id: "potato",
    name: "じゃがいも",
    nutritionPerBasis: buildNutritionFacts({
      caloriesKcal: 59,
      proteinG: 1.8,
      fatG: 0.1,
      carbohydrateG: 17.3,
      fiberG: 8.9,
      saltEquivalentG: 0,
    }),
    latestUnitPriceYen: 50,
  }),
  buildIngredient({
    id: "carrot",
    name: "にんじん",
    nutritionPerBasis: buildNutritionFacts({
      caloriesKcal: 35,
      proteinG: 0.8,
      fatG: 0.1,
      carbohydrateG: 9.3,
      fiberG: 2.4,
      saltEquivalentG: 0.1,
      micronutrients: [{ key: "vitaminA", label: "ビタミンA", amount: 720, unit: "ug" }],
    }),
    latestUnitPriceYen: 60,
    inventiaItemId: "itm_01JD8CARROT",
  }),
  buildIngredient({
    id: "pork",
    name: "豚こま切れ肉",
    nutritionPerBasis: buildNutritionFacts({
      caloriesKcal: 236,
      proteinG: 17.6,
      fatG: 18.6,
      carbohydrateG: 0.2,
      fiberG: 0,
      saltEquivalentG: 0.1,
    }),
    latestUnitPriceYen: 180,
  }),
  buildIngredient({
    id: "milk",
    name: "牛乳",
    baseDimension: "volume",
    baseUnit: "mL",
    nutritionPerBasis: buildNutritionFacts({
      caloriesKcal: 63,
      proteinG: 3.4,
      fatG: 3.9,
      carbohydrateG: 5,
      fiberG: 0,
      saltEquivalentG: 0.1,
    }),
    gramPerUnit: 1.03,
    latestUnitPriceYen: 24,
  }),
  buildIngredient({
    id: "egg",
    name: "鶏卵",
    baseDimension: "count",
    baseUnit: "個",
    nutritionBasisAmount: 1,
    nutritionPerBasis: buildNutritionFacts({
      caloriesKcal: 85,
      proteinG: 7.3,
      fatG: 6.1,
      carbohydrateG: 0.2,
      fiberG: null,
      saltEquivalentG: 0.2,
    }),
    gramPerUnit: 60,
    latestUnitPriceYen: 28,
    inventiaItemId: "itm_01JD8EGG",
  }),
  buildIngredient({
    id: "salt",
    name: "食塩",
    nutritionPerBasis: buildNutritionFacts({
      caloriesKcal: 0,
      proteinG: 0,
      fatG: 0,
      carbohydrateG: 0,
      fiberG: 0,
      saltEquivalentG: 99.5,
    }),
    latestUnitPriceYen: null,
    latestPriceUpdatedAt: null,
  }),
];

export const inventiaMatches: InventiaItem[] = [
  {
    id: "itm_01JD8ONION",
    name: "玉ねぎ (北海道産)",
    baseUnit: "g",
    baseDimension: "mass",
    currentQuantity: 1200,
  },
  {
    id: "itm_01JD8NEWONION",
    name: "新玉ねぎ",
    baseUnit: "g",
    baseDimension: "mass",
    currentQuantity: 450,
  },
  {
    id: "itm_01JD8ONIONBAG",
    name: "玉ねぎ 3個入り",
    baseUnit: "袋",
    baseDimension: "count",
    currentQuantity: 2,
  },
];

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** API を呼ばない Inventia 操作。 */
export const fakeInventiaActions: InventiaActions = {
  async search() {
    await wait(300);
    return inventiaMatches;
  },
  async link() {
    await wait(300);
    return { synced: true };
  },
  async readStock() {
    await wait(300);
    return { found: true, currentQuantity: 1200, baseUnit: "g" };
  },
  async consumeStock(_id, amount) {
    await wait(300);
    return { currentQuantity: 1200 - amount };
  },
};

let dishSequence = 0;

export const buildDishRow = (overrides: Partial<DishRow> = {}): DishRow => {
  dishSequence += 1;
  return {
    id: `dish-${dishSequence}`,
    name: "ポークカレー",
    category: "主菜",
    servings: 4,
    coverImageId: null,
    durationSec: 52 * 60,
    ingredientCount: 9,
    facts: buildNutritionFacts(),
    costYen: 312,
    costMissingCount: 0,
    ...overrides,
  };
};

export const dishRows: readonly DishRow[] = [
  buildDishRow({ id: "curry", name: "ポークカレー", coverImageId: sampleImageIds.curryCover }),
  buildDishRow({
    id: "gratin",
    name: "オニオングラタン",
    coverImageId: sampleImageIds.gratinCover,
    servings: 2,
    durationSec: 65 * 60,
    ingredientCount: 12,
    facts: buildNutritionFacts({
      caloriesKcal: 612,
      proteinG: 24.1,
      fatG: 31.5,
      carbohydrateG: 55.2,
    }),
    costYen: 286,
    costMissingCount: 2,
  }),
  buildDishRow({
    id: "miso",
    name: "豆腐とわかめの味噌汁",
    coverImageId: sampleImageIds.misoCover,
    category: "汁物",
    servings: 2,
    durationSec: 12 * 60,
    ingredientCount: 5,
    facts: buildNutritionFacts({ caloriesKcal: 64, proteinG: 5.2, fatG: 3.1, carbohydrateG: 4.4 }),
    costYen: 58,
  }),
  buildDishRow({
    id: "salad",
    name: "キャベツのコールスロー",
    category: "副菜",
    servings: 3,
    durationSec: 15 * 60,
    ingredientCount: 6,
    facts: buildNutritionFacts({ caloriesKcal: 118, proteinG: 1.4, fatG: 9.8, carbohydrateG: 6.9 }),
    costYen: null,
    costMissingCount: 6,
  }),
  buildDishRow({
    id: "rice",
    name: "白ごはん",
    category: null,
    servings: 4,
    durationSec: 50 * 60,
    ingredientCount: 2,
    facts: null,
    costYen: 35,
  }),
];
