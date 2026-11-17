import type { Food } from "@/domain/ingredient";
import type { NutritionFacts } from "@/domain/nutrition";
import {
  type NutritionForm,
  nutritionFormFrom,
} from "@/routes/_app/ingredients/-components/ingredient-form";

export interface FoodForm extends NutritionForm {
  name: string;
  category: string;
  servingLabel: string;
  priceYen: string;
  memo: string;
}

/** POST /api/foods・PATCH /api/foods/:id の本文。 */
export interface FoodPayload {
  name: string;
  category: string | null;
  servingLabel: string;
  priceYen: number | null;
  nutrition: NutritionFacts;
  memo: string | null;
}

export const emptyFoodForm = (): FoodForm => ({
  name: "",
  category: "",
  servingLabel: "1食分",
  priceYen: "",
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

export const foodFormFrom = (item: Food): FoodForm => ({
  name: item.name,
  category: item.category ?? "",
  servingLabel: item.servingLabel,
  priceYen: optional(item.priceYen),
  memo: item.memo ?? "",
  ...nutritionFormFrom(item.nutrition),
});

const requiredNumber = (value: string, label: string) => {
  const number = Number(value);
  if (!value.trim() || !Number.isFinite(number) || number < 0)
    throw new Error(`${label}には0以上の数値を入力してください。`);
  return number;
};

const optionalNumber = (value: string, label: string) =>
  value.trim() ? requiredNumber(value, label) : null;

/** フォームを API の本文に変換する。不正な値があれば Error を投げる。 */
export const payloadFromFoodForm = (form: FoodForm): FoodPayload => {
  const name = form.name.trim();
  if (!name) throw new Error("食品名を入力してください。");
  const servingLabel = form.servingLabel.trim();
  if (!servingLabel) throw new Error("1食分の目安を入力してください。");
  return {
    name,
    category: form.category.trim() || null,
    servingLabel,
    priceYen: optionalNumber(form.priceYen, "価格"),
    nutrition: {
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
    memo: form.memo.trim() || null,
  };
};
