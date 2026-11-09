import type { Dish, Ingredient } from "@/domain/ingredient";
import type { NutritionFacts } from "@/domain/nutrition";
import type { RecipeJson, RecipeStep } from "@/domain/recipe";
import { computeRecipeGanttSchedule } from "@/domain/recipe-scheduler";
import {
  createTwelveIngredientRecipePayload,
  twelveIngredientsMaster,
} from "@/tests/fixtures/recipe-fixtures";
import { sampleImageIds } from "../fixtures/images";

/**
 * レシピ詳細のストーリー用フィクスチャ。
 * - オニオングラタン: app のテスト用フィクスチャ (直列 4 手順)。
 * - ポークカレー: 炊飯と並行する 6 手順。レーン・待機・材料グループ・注意を含む。
 */

const facts = (
  caloriesKcal: number,
  proteinG: number,
  fatG: number,
  carbohydrateG: number,
  fiberG = 0,
  saltEquivalentG = 0,
): NutritionFacts => ({
  caloriesKcal,
  proteinG,
  fatG,
  carbohydrateG,
  fiberG,
  saltEquivalentG,
  micronutrients: [],
});

export const buildIngredient = (overrides: Partial<Ingredient> & Pick<Ingredient, "id" | "name">) =>
  ({
    normalizedName: null,
    baseDimension: "mass",
    baseUnit: "g",
    nutritionBasisAmount: 100,
    nutritionPerBasis: facts(100, 1, 1, 1),
    gramPerUnit: null,
    inventiaItemId: null,
    latestUnitPriceYen: null,
    latestPriceUpdatedAt: null,
    memo: null,
    ...overrides,
  }) satisfies Ingredient;

// 単価は栄養価の基準量 (100g / 100mL / 1個) あたり
const gratinMaster = twelveIngredientsMaster.map((item) =>
  buildIngredient({
    id: item.id,
    name: item.name,
    baseDimension: item.baseDimension,
    baseUnit: item.baseUnit,
    nutritionBasisAmount: item.nutritionBasisAmount,
    nutritionPerBasis: { ...item.nutritionPerBasis, micronutrients: [] },
    latestUnitPriceYen: item.latestUnitPriceYen,
  }),
);

const curryMaster = [
  buildIngredient({
    id: "ing-rice",
    name: "精白米",
    nutritionPerBasis: facts(342, 6.1, 0.9, 77.6, 0.5, 0),
    latestUnitPriceYen: 50,
  }),
  buildIngredient({
    id: "ing-pork",
    name: "豚こま切れ肉",
    nutritionPerBasis: facts(236, 17.7, 17.2, 0.2, 0, 0.1),
    latestUnitPriceYen: 180,
  }),
  buildIngredient({
    id: "ing-potato",
    name: "じゃがいも",
    nutritionPerBasis: facts(59, 1.8, 0.1, 17.3, 8.9, 0),
    latestUnitPriceYen: 50,
  }),
  buildIngredient({
    id: "ing-carrot",
    name: "にんじん",
    nutritionPerBasis: facts(35, 0.8, 0.2, 9.3, 2.8, 0.1),
    latestUnitPriceYen: 60,
  }),
  buildIngredient({
    id: "ing-roux",
    name: "カレールウ",
    nutritionPerBasis: facts(474, 6.5, 34.1, 44.7, 3.7, 10.6),
    latestUnitPriceYen: 120,
  }),
  buildIngredient({
    id: "ing-soy",
    name: "しょうゆ",
    nutritionPerBasis: facts(77, 7.7, 0, 7.9, 0, 14.5),
    latestUnitPriceYen: 80,
  }),
  buildIngredient({
    id: "ing-mirin",
    name: "みりん",
    nutritionPerBasis: facts(241, 0.3, 0, 43.2, 0, 0),
    latestUnitPriceYen: 80,
  }),
  buildIngredient({
    id: "ing-sugar",
    name: "砂糖",
    nutritionPerBasis: facts(391, 0, 0, 99.3, 0, 0),
    latestUnitPriceYen: 30,
  }),
];

export const ingredientMaster: Ingredient[] = [...gratinMaster, ...curryMaster];
export const ingredientById: ReadonlyMap<string, Ingredient> = new Map(
  ingredientMaster.map((item) => [item.id, item]),
);

const entry = (
  id: string,
  ingredientId: string,
  name: string,
  amount: number,
  displayAmount: string,
  extra: Partial<RecipeJson["ingredients"][number]> = {},
): RecipeJson["ingredients"][number] => ({
  id,
  ingredientId,
  name,
  amount,
  unit: "g",
  displayAmount,
  role: "main",
  groupId: null,
  prepNote: null,
  ...extra,
});

const timing = (active: number, passive = 0, timerLabel: string | null = null) => ({
  activeDurationSec: active,
  passiveDurationSec: passive,
  minTotalDurationSec: null,
  maxTotalDurationSec: null,
  scalingMode: "fixed" as const,
  timerLabel,
});

const step = (
  value: Pick<
    RecipeStep,
    "id" | "stepNumber" | "phase" | "title" | "instruction" | "executionMode" | "timing"
  > &
    Partial<RecipeStep>,
): RecipeStep => ({
  dependsOnStepIds: [],
  resourceTags: [],
  heatLevel: "none",
  targetTempCelsius: null,
  inputs: [],
  outputs: [],
  completionCue: null,
  cautions: [],
  imageIds: [],
  ...value,
});

const ingredientInput = (
  ingredientEntryId: string,
  amountRatio = 1,
  amountText: string | null = null,
) => ({
  type: "ingredient" as const,
  ingredientEntryId,
  amountRatio,
  amountText,
});
const intermediate = (fromStepId: string, outputId: string) => ({
  type: "intermediate" as const,
  fromStepId,
  outputId,
});

export const curryRecipe: RecipeJson = {
  schemaVersion: "1.0",
  servings: 4,
  summary: "炊飯と並行して作る定番のポークカレー",
  equipment: ["炊飯器", "厚手の鍋", "包丁", "まな板"],
  ingredientGroups: [
    {
      id: "grp-hidden",
      symbol: "★",
      label: "隠し味",
      ingredientEntryIds: ["e-soy", "e-mirin", "e-sugar"],
    },
  ],
  ingredients: [
    entry("e-rice", "ing-rice", "精白米", 300, "2合"),
    entry("e-pork", "ing-pork", "豚こま切れ肉", 300, "300g"),
    entry("e-onion", "ing-onion", "玉ねぎ", 400, "2個", { prepNote: "くし切り" }),
    entry("e-potato", "ing-potato", "じゃがいも", 300, "2個", { prepNote: "一口大" }),
    entry("e-carrot", "ing-carrot", "にんじん", 150, "1本", { prepNote: "乱切り" }),
    entry("e-oil", "ing-olive-oil", "オリーブオイル", 10, "大さじ1", { role: "seasoning" }),
    entry("e-roux", "ing-roux", "カレールウ", 100, "1/2箱", { role: "seasoning" }),
    entry("e-soy", "ing-soy", "しょうゆ", 6, "小さじ1", {
      role: "seasoning",
      groupId: "grp-hidden",
    }),
    entry("e-mirin", "ing-mirin", "みりん", 6, "小さじ1", {
      role: "seasoning",
      groupId: "grp-hidden",
    }),
    entry("e-sugar", "ing-sugar", "砂糖", 3, "小さじ1", {
      role: "seasoning",
      groupId: "grp-hidden",
    }),
  ],
  steps: [
    step({
      id: "s-rice",
      stepNumber: 1,
      phase: "prep",
      title: "米を研いで炊く",
      instruction: "米を研いで30分浸水させ、炊飯器で炊く。",
      executionMode: "mixed",
      timing: timing(300, 2700, "炊飯"),
      resourceTags: ["炊飯器"],
      inputs: [ingredientInput("e-rice")],
      outputs: [{ id: "o-rice", label: "ご飯" }],
      completionCue: "炊飯器の完了音",
    }),
    step({
      id: "s-cut",
      stepNumber: 2,
      phase: "prep",
      title: "野菜と肉を切る",
      instruction:
        "玉ねぎはくし切り、じゃがいもは一口大、にんじんは乱切りにする。豚肉は大きければ切る。",
      executionMode: "active",
      timing: timing(600),
      resourceTags: ["まな板"],
      inputs: [
        ingredientInput("e-onion"),
        ingredientInput("e-potato"),
        ingredientInput("e-carrot"),
        ingredientInput("e-pork"),
      ],
      outputs: [{ id: "o-cut", label: "切った具材" }],
    }),
    step({
      id: "s-saute",
      stepNumber: 3,
      phase: "cook",
      title: "炒める",
      instruction: "鍋に油を熱し、豚肉と玉ねぎを炒め、残りの野菜を加えて全体に油が回るまで炒める。",
      executionMode: "active",
      timing: timing(480),
      resourceTags: ["コンロ"],
      heatLevel: "medium",
      inputs: [ingredientInput("e-oil"), intermediate("s-cut", "o-cut")],
      outputs: [{ id: "o-saute", label: "炒めた具材" }],
      dependsOnStepIds: ["s-cut"],
      completionCue: "玉ねぎがしんなりする",
    }),
    step({
      id: "s-simmer",
      stepNumber: 4,
      phase: "cook",
      title: "煮込む",
      instruction: "水700mLを加えて沸騰させ、アクを取って弱めの中火で15分煮込む。",
      executionMode: "mixed",
      timing: timing(120, 900, "煮込み"),
      resourceTags: ["コンロ"],
      heatLevel: "simmer",
      inputs: [intermediate("s-saute", "o-saute")],
      outputs: [{ id: "o-simmer", label: "煮込んだ具材" }],
      dependsOnStepIds: ["s-saute"],
      completionCue: "じゃがいもに竹串がすっと通る",
      cautions: [
        {
          id: "c-boil",
          category: "safety",
          severity: "warning",
          title: "吹きこぼれ",
          description: "沸騰したら火を弱める。",
          triggerCondition: null,
        },
      ],
    }),
    step({
      id: "s-roux",
      stepNumber: 5,
      phase: "finish",
      title: "ルウを溶かす",
      instruction:
        "火を止めてルウを割り入れて溶かし、隠し味を加えて弱火で5分とろみがつくまで煮る。",
      executionMode: "mixed",
      timing: timing(180, 300),
      resourceTags: ["コンロ"],
      heatLevel: "low",
      inputs: [
        intermediate("s-simmer", "o-simmer"),
        ingredientInput("e-roux"),
        { type: "group", groupId: "grp-hidden" },
      ],
      outputs: [{ id: "o-curry", label: "カレー" }],
      dependsOnStepIds: ["s-simmer"],
      cautions: [
        {
          id: "c-burn",
          category: "quality",
          severity: "info",
          title: "焦げつき",
          description: "底から混ぜ続ける。",
          triggerCondition: "とろみがついた後",
        },
      ],
    }),
    step({
      id: "s-serve",
      stepNumber: 6,
      phase: "finish",
      title: "盛り付ける",
      instruction: "器にご飯を盛り、カレーをかける。",
      executionMode: "active",
      timing: timing(120),
      inputs: [intermediate("s-rice", "o-rice"), intermediate("s-roux", "o-curry")],
      dependsOnStepIds: ["s-rice", "s-roux"],
    }),
  ],
  globalCautions: [
    {
      id: "g-store",
      category: "storage",
      severity: "warning",
      title: "保存",
      description: "常温で放置せず、粗熱を取って冷蔵する。",
      triggerCondition: null,
    },
  ],
};

/** 油を 2 回に分けて使う版 (材料の手順参照の表示確認用)。 */
export const curryRecipeSplitOil: RecipeJson = {
  ...curryRecipe,
  steps: curryRecipe.steps.map((item) =>
    item.id === "s-saute"
      ? {
          ...item,
          inputs: [ingredientInput("e-oil", 0.5, "大さじ1/2"), intermediate("s-cut", "o-cut")],
        }
      : item.id === "s-simmer"
        ? { ...item, inputs: [...item.inputs, ingredientInput("e-oil", 0.5, "大さじ1/2")] }
        : item,
  ),
};

export const curryDish: Dish = {
  id: "dish-curry",
  name: "ポークカレー",
  category: "主菜",
  servings: 4,
  recipe: curryRecipe,
  totalNutrition: null,
  totalCostYen: null,
  coverImageId: null,
  notes: "隠し味のしょうゆとみりんはルウを溶かした後に加える。",
};

/** 表紙と手順の写真があるカレー。 */
const curryStepImages: Record<string, string[]> = {
  "s-cut": [sampleImageIds.curryCut],
  "s-saute": [sampleImageIds.currySaute1, sampleImageIds.currySaute2],
  "s-simmer": [sampleImageIds.currySimmer],
};
export const curryDishWithImages: Dish = {
  ...curryDish,
  coverImageId: sampleImageIds.curryCover,
  recipe: {
    ...curryRecipe,
    steps: curryRecipe.steps.map((item) => ({
      ...item,
      imageIds: curryStepImages[item.id] ?? [],
    })),
  },
};

const gratinPayload = createTwelveIngredientRecipePayload();
export const gratinDish: Dish = {
  id: "dish-gratin",
  name: "オニオングラタン",
  category: "主菜",
  servings: gratinPayload.servings,
  recipe: gratinPayload.recipe,
  totalNutrition: null,
  totalCostYen: null,
  coverImageId: null,
  notes: null,
};

export const currySchedule = computeRecipeGanttSchedule(curryRecipe);
export const gratinSchedule = computeRecipeGanttSchedule(gratinDish.recipe);
export const emptySchedule = {
  totalDurationSec: 0,
  serialDurationSec: 0,
  savedDurationSec: 0,
  lanes: [],
  bars: [],
};
