import type { Ingredient } from "@/domain/ingredient";
import type { MicronutrientEntry, NutritionFacts } from "@/domain/nutrition";
import { formatNumber } from "@/lib/format";

export type Dimension = Ingredient["baseDimension"];
export type MicroUnit = MicronutrientEntry["unit"];

export const dimensionLabels: Record<Dimension, string> = {
  mass: "質量",
  volume: "体積",
  count: "個数",
};

/** 入力途中の値を保てるよう、数値はすべて文字列で持つ。 */
export interface MicroForm {
  key: string;
  label: string;
  amount: string;
  unit: MicroUnit;
}

export interface NutritionForm {
  caloriesKcal: string;
  proteinG: string;
  fatG: string;
  carbohydrateG: string;
  fiberG: string;
  saltEquivalentG: string;
  micronutrients: MicroForm[];
}

export interface IngredientForm extends NutritionForm {
  name: string;
  baseDimension: Dimension;
  baseUnit: string;
  nutritionBasisAmount: string;
  gramPerUnit: string;
  /** 手入力の単価 (基準量あたり、円)。Inventia と連携していないときだけ使う。 */
  unitPriceYen: string;
  memo: string;
}

/** POST /api/ingredients・PATCH /api/ingredients/:id の本文。 */
export interface IngredientPayload {
  name: string;
  baseDimension: Dimension;
  baseUnit: string;
  nutritionBasisAmount: number;
  nutritionPerBasis: NutritionFacts;
  gramPerUnit: number | null;
  memo: string | null;
  /** 手入力の単価。Inventia と連携している材料では送らない (Inventia の価格を使う)。 */
  latestUnitPriceYen?: number | null;
}

/** POST /api/ai/estimate-ingredient の結果。 */
export type EstimateResult = NutritionFacts & { gramPerUnit?: number };

export const emptyIngredientForm = (): IngredientForm => ({
  name: "",
  baseDimension: "mass",
  baseUnit: "g",
  nutritionBasisAmount: "100",
  gramPerUnit: "",
  unitPriceYen: "",
  caloriesKcal: "0",
  proteinG: "0",
  fatG: "0",
  carbohydrateG: "0",
  fiberG: "",
  saltEquivalentG: "",
  memo: "",
  micronutrients: [],
});

const optional = (value: number | null) => (value === null ? "" : String(value));

export const nutritionFormFrom = (facts: EstimateResult): NutritionForm => ({
  caloriesKcal: String(facts.caloriesKcal),
  proteinG: String(facts.proteinG),
  fatG: String(facts.fatG),
  carbohydrateG: String(facts.carbohydrateG),
  fiberG: optional(facts.fiberG),
  saltEquivalentG: optional(facts.saltEquivalentG),
  micronutrients: facts.micronutrients.map((micro) => ({ ...micro, amount: String(micro.amount) })),
});

export const ingredientFormFrom = (item: Ingredient): IngredientForm => ({
  name: item.name,
  baseDimension: item.baseDimension,
  baseUnit: item.baseUnit,
  nutritionBasisAmount: String(item.nutritionBasisAmount),
  gramPerUnit: optional(item.gramPerUnit),
  unitPriceYen: item.inventiaItemId ? "" : optional(item.latestUnitPriceYen),
  memo: item.memo ?? "",
  ...nutritionFormFrom(item.nutritionPerBasis),
});

/** 次元を変えたときの基準単位と基準量 (API の制約に合わせる)。 */
export const basisForDimension = (dimension: Dimension) =>
  dimension === "mass"
    ? { baseUnit: "g", nutritionBasisAmount: "100" }
    : dimension === "volume"
      ? { baseUnit: "mL", nutritionBasisAmount: "100" }
      : { baseUnit: "個", nutritionBasisAmount: "1" };

const requiredNumber = (value: string, label: string) => {
  const number = Number(value);
  if (!value.trim() || !Number.isFinite(number) || number < 0)
    throw new Error(`${label}には0以上の数値を入力してください。`);
  return number;
};

const optionalNumber = (value: string, label: string) =>
  value.trim() ? requiredNumber(value, label) : null;

/**
 * フォームを API の本文に変換する。不正な値があれば Error を投げる。
 * `manualPrice` が false (Inventia と連携中) なら単価は送らない。
 */
export const payloadFromForm = (form: IngredientForm, manualPrice = true): IngredientPayload => ({
  name: form.name.trim(),
  baseDimension: form.baseDimension,
  baseUnit: form.baseUnit.trim(),
  nutritionBasisAmount: requiredNumber(form.nutritionBasisAmount, "基準量"),
  nutritionPerBasis: {
    caloriesKcal: requiredNumber(form.caloriesKcal, "エネルギー"),
    proteinG: requiredNumber(form.proteinG, "たんぱく質"),
    fatG: requiredNumber(form.fatG, "脂質"),
    carbohydrateG: requiredNumber(form.carbohydrateG, "炭水化物"),
    fiberG: optionalNumber(form.fiberG, "食物繊維"),
    saltEquivalentG: optionalNumber(form.saltEquivalentG, "食塩相当量"),
    micronutrients: form.micronutrients.map((micro) => ({
      key: micro.key.trim(),
      label: micro.label.trim(),
      amount: requiredNumber(micro.amount, micro.label.trim() || "微量栄養素の量"),
      unit: micro.unit,
    })),
  },
  gramPerUnit: optionalNumber(form.gramPerUnit, "1単位あたりのグラム数"),
  memo: form.memo.trim() || null,
  ...(manualPrice ? { latestUnitPriceYen: optionalNumber(form.unitPriceYen, "単価") } : {}),
});

/** "100g あたり" / "1個 あたり" */
export const basisLabel = (item: Pick<Ingredient, "nutritionBasisAmount" | "baseUnit">) =>
  `${formatNumber(item.nutritionBasisAmount)}${item.baseUnit} あたり`;

/** 単価 (基準量あたり)。1 円未満の値も潰さずに表示する。 */
export const formatBasisPrice = (value: number | null | undefined) => {
  if (value === null || value === undefined) return null;
  return value < 10
    ? `¥${formatNumber(value, 2, { fixed: true })}`
    : `¥${Math.round(value).toLocaleString("ja-JP")}`;
};
