import { errorMessageFrom } from "../../../lib/api-error";
import type { NutritionFacts } from "../../../domain/nutrition";

export type Source =
  | "self_cooked"
  | "cafeteria"
  | "convenience"
  | "supermarket"
  | "snack"
  | "restaurant"
  | "other";
export type Timing = "breakfast" | "lunch" | "dinner" | "snack" | "late_snack";

export type MealItem = {
  id?: string;
  dishId?: string | null;
  ingredientId?: string | null;
  name: string;
  servingsFactor?: number;
  priceYen: number | null;
  nutrition: NutritionFacts | null;
  estimationSource?: "manual" | "recipe" | "ingredient" | "ai" | "unknown";
  sortOrder?: number;
};

export type Meal = {
  id: string;
  eatenAt: string;
  mealTiming: Timing | null;
  sourceType: Source;
  placeName: string | null;
  title: string;
  totalPriceYen: number | null;
  totalNutrition: NutritionFacts | null;
  imageIds: string[];
  items: MealItem[];
  memo?: string | null;
};

export type PeriodTotals = {
  priceYen: number;
  caloriesKcal: number | null;
  proteinG: number | null;
  fatG: number | null;
  carbohydrateG: number | null;
  fiberG: number | null;
  saltEquivalentG: number | null;
};

export type MealListResponse = {
  meals: Meal[];
  summary: { day: PeriodTotals; week: PeriodTotals; month: PeriodTotals };
};

export type Dish = {
  id: string;
  name: string;
  servings: number;
  totalNutrition: NutritionFacts | null;
  totalCostYen: number | null;
};

export type Analysis = {
  suggestedTitle: string;
  suggestedPlaceName: string | null;
  items: {
    name: string;
    estimatedWeightG: number | null;
    estimatedPriceYen: number | null;
    nutrition: NutritionFacts;
  }[];
  totalPriceYen: number | null;
  totalNutrition: NutritionFacts;
};

export type StockConsumption = {
  status: "succeeded" | "failed" | "skipped";
  results: unknown[];
  error: string | null;
};

export type CreatedMeal = Meal & { stockConsumption?: StockConsumption };

export const sources: [Source | "", string][] = [
  ["", "すべて"],
  ["self_cooked", "自炊"],
  ["cafeteria", "学食"],
  ["convenience", "コンビニ"],
  ["supermarket", "スーパー"],
  ["snack", "お菓子"],
  ["restaurant", "外食"],
  ["other", "その他"],
];

export const timings: [Timing | "", string][] = [
  ["", "すべて"],
  ["breakfast", "朝食"],
  ["lunch", "昼食"],
  ["dinner", "夕食"],
  ["snack", "間食"],
  ["late_snack", "夜食"],
];

export const sourceName: Record<Source, string> = Object.fromEntries(
  sources.filter(([id]) => id).map(([id, name]) => [id, name]),
) as Record<Source, string>;

export const emptyFacts = (): NutritionFacts => ({
  caloriesKcal: 0,
  proteinG: 0,
  fatG: 0,
  carbohydrateG: 0,
  fiberG: null,
  saltEquivalentG: null,
  micronutrients: [],
});

export function fmt(n: number | null | undefined, digits = 1) {
  return n == null ? "—" : n.toLocaleString("ja-JP", { maximumFractionDigits: digits });
}

export function currency(n: number | null | undefined) {
  return n == null ? "—" : `¥${Math.round(n).toLocaleString("ja-JP")}`;
}

export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    let message = `通信に失敗しました (${response.status})`;
    try {
      message = errorMessageFrom(await response.json(), message);
    } catch {}
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

export function nutritionText(nutrition: NutritionFacts | null) {
  if (!nutrition) return "栄養価 —";
  return `${fmt(nutrition.caloriesKcal)} kcal · P ${fmt(nutrition.proteinG)}g / F ${fmt(nutrition.fatG)}g / C ${fmt(nutrition.carbohydrateG)}g / 食塩 ${fmt(nutrition.saltEquivalentG)}g`;
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function localCalendarDate(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function localTimeValue(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function localDateTimeValue(date = new Date()) {
  return `${localCalendarDate(date)}T${localTimeValue(date)}`;
}

export function combineLocalDateTime(date: string, time: string) {
  return new Date(`${date}T${time || "00:00"}`).toISOString();
}

const weekdays = ["日", "月", "火", "水", "木", "金", "土"];

export function dayLabel(dateKey: string) {
  const date = new Date(`${dateKey}T00:00:00`);
  return `${date.getMonth() + 1}月${date.getDate()}日 (${weekdays[date.getDay()]})`;
}

export interface DayGroup {
  key: string;
  label: string;
  meals: Meal[];
  priceYen: number;
  caloriesKcal: number;
  hasNutrition: boolean;
}

export function groupMealsByDay(meals: readonly Meal[]): DayGroup[] {
  const groups = new Map<string, DayGroup>();
  for (const meal of meals) {
    const key = localCalendarDate(meal.eatenAt);
    const group = groups.get(key) ?? {
      key,
      label: dayLabel(key),
      meals: [],
      priceYen: 0,
      caloriesKcal: 0,
      hasNutrition: false,
    };
    group.meals.push(meal);
    group.priceYen += meal.totalPriceYen ?? 0;
    if (meal.totalNutrition) {
      group.caloriesKcal += meal.totalNutrition.caloriesKcal;
      group.hasNutrition = true;
    }
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => (a.key < b.key ? 1 : -1));
}
