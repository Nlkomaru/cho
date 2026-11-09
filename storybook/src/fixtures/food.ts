import type { NutritionFacts } from "@/domain/nutrition";

/**
 * Storybook 共通の栄養価・材料フィクスチャ。値は日本食品標準成分表に近い現実的なもの。
 */
export const buildNutritionFacts = (overrides: Partial<NutritionFacts> = {}): NutritionFacts => ({
  caloriesKcal: 677,
  proteinG: 22.2,
  fatG: 24.8,
  carbohydrateG: 96.3,
  fiberG: 6.4,
  saltEquivalentG: 3.1,
  micronutrients: [],
  ...overrides,
});

/** ポークカレー 4 人前の全量。 */
export const curryTotalFacts = buildNutritionFacts({
  caloriesKcal: 2708,
  proteinG: 88.8,
  fatG: 99.2,
  carbohydrateG: 385.2,
  fiberG: 25.6,
  saltEquivalentG: 12.4,
});

export interface IngredientRow {
  id: string;
  name: string;
  /** 栄養価の基準量の表示 ("100g あたり")。 */
  basis: string;
  facts: NutritionFacts;
  unitPriceYen: number | null;
  inventiaItemId: string | null;
}

let sequence = 0;

export const buildIngredientRow = (overrides: Partial<IngredientRow> = {}): IngredientRow => {
  sequence += 1;
  return {
    id: `ingredient-${sequence}`,
    name: "玉ねぎ",
    basis: "100g あたり",
    facts: buildNutritionFacts({
      caloriesKcal: 33,
      proteinG: 1,
      fatG: 0.1,
      carbohydrateG: 8.4,
      fiberG: 1.5,
      saltEquivalentG: 0,
    }),
    unitPriceYen: 40,
    inventiaItemId: null,
    ...overrides,
  };
};

export const ingredientRows: readonly IngredientRow[] = [
  buildIngredientRow({ id: "onion", name: "玉ねぎ", inventiaItemId: "itm_onion" }),
  buildIngredientRow({
    id: "potato",
    name: "じゃがいも",
    facts: buildNutritionFacts({
      caloriesKcal: 59,
      proteinG: 1.8,
      fatG: 0.1,
      carbohydrateG: 17.3,
      fiberG: 8.9,
      saltEquivalentG: 0,
    }),
    unitPriceYen: 50,
  }),
  buildIngredientRow({
    id: "carrot",
    name: "にんじん",
    facts: buildNutritionFacts({
      caloriesKcal: 35,
      proteinG: 0.8,
      fatG: 0.1,
      carbohydrateG: 9.3,
      fiberG: 2.4,
      saltEquivalentG: 0.1,
    }),
    unitPriceYen: 60,
    inventiaItemId: "itm_carrot",
  }),
  buildIngredientRow({
    id: "pork",
    name: "豚こま切れ肉",
    facts: buildNutritionFacts({
      caloriesKcal: 236,
      proteinG: 17.6,
      fatG: 18.6,
      carbohydrateG: 0.2,
      fiberG: 0,
      saltEquivalentG: 0.1,
    }),
    unitPriceYen: 180,
  }),
  buildIngredientRow({
    id: "roux",
    name: "カレールウ",
    facts: buildNutritionFacts({
      caloriesKcal: 474,
      proteinG: 6.5,
      fatG: 34.1,
      carbohydrateG: 44.7,
      fiberG: 6.4,
      saltEquivalentG: 10.6,
    }),
    unitPriceYen: 120,
  }),
  buildIngredientRow({
    id: "rice",
    name: "精白米",
    facts: buildNutritionFacts({
      caloriesKcal: 342,
      proteinG: 6.1,
      fatG: 0.9,
      carbohydrateG: 77.6,
      fiberG: 0.5,
      saltEquivalentG: 0,
    }),
    unitPriceYen: 50,
    inventiaItemId: "itm_rice",
  }),
  buildIngredientRow({
    id: "salt",
    name: "食塩",
    facts: buildNutritionFacts({
      caloriesKcal: 0,
      proteinG: 0,
      fatG: 0,
      carbohydrateG: 0,
      fiberG: 0,
      saltEquivalentG: 99.5,
    }),
    unitPriceYen: null,
  }),
];
