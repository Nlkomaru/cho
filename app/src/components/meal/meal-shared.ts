import type { NutritionFacts } from "@/domain/nutrition";
import { errorMessageFrom } from "@/lib/api-error";
import { formatDateJa } from "@/lib/format";

export type Source =
  | "self_cooked"
  | "cafeteria"
  | "convenience"
  | "supermarket"
  | "snack"
  | "restaurant"
  | "other";
export type Timing = "breakfast" | "lunch" | "dinner" | "snack" | "late_snack";
export type MealPeriod = "day" | "week" | "month";
export type MealView = "cards" | "table";
export type StockStatus = "pending" | "succeeded" | "failed";

export type IngredientCost = {
  ingredientId: string;
  name: string;
  amount: number;
  unit: string;
  costYen: number;
};

export type MealItem = {
  id?: string;
  dishId?: string | null;
  ingredientId?: string | null;
  name: string;
  servingsFactor?: number;
  priceYen: number | null;
  nutrition: NutritionFacts | null;
  ingredientCostBreakdown?: IngredientCost[];
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
  inventiaConsumptionStatus?: StockStatus | null;
};

export type PeriodTotals = {
  priceYen: number | null;
  caloriesKcal: number | null;
  proteinG: number | null;
  fatG: number | null;
  carbohydrateG: number | null;
  fiberG: number | null;
  saltEquivalentG: number | null;
};

export type MealTotals = PeriodTotals & {
  /** 栄養価が無く、栄養の合計に含めていない記録の数。 */
  nutritionMissing: number;
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
  costMissingCount: number;
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

export const sourceOptions: { value: Source; label: string }[] = [
  { value: "self_cooked", label: "自炊" },
  { value: "cafeteria", label: "学食" },
  { value: "convenience", label: "コンビニ" },
  { value: "supermarket", label: "スーパー" },
  { value: "snack", label: "お菓子" },
  { value: "restaurant", label: "外食" },
  { value: "other", label: "その他" },
];

export const timingOptions: { value: Timing; label: string }[] = [
  { value: "breakfast", label: "朝食" },
  { value: "lunch", label: "昼食" },
  { value: "dinner", label: "夕食" },
  { value: "snack", label: "間食" },
  { value: "late_snack", label: "夜食" },
];

export const sourceName = Object.fromEntries(
  sourceOptions.map(({ value, label }) => [value, label]),
) as Record<Source, string>;

export const timingName = Object.fromEntries(
  timingOptions.map(({ value, label }) => [value, label]),
) as Record<Timing, string>;

export const stockStatusName: Record<StockStatus, string> = {
  pending: "処理中",
  succeeded: "消費済み",
  failed: "失敗",
};

/** "夕食 · 自炊 · 学食" のような区分の並び。 */
export function mealMetaParts(meal: Pick<Meal, "mealTiming" | "sourceType" | "placeName">) {
  const source = sourceName[meal.sourceType] ?? meal.sourceType;
  return [meal.mealTiming ? timingName[meal.mealTiming] : null, source, mealPlace(meal)].filter(
    (part): part is string => Boolean(part),
  );
}

/** 場所。区分と同じ名前 (「学食」など) なら重ねて出さない。 */
export function mealPlace(meal: Pick<Meal, "sourceType" | "placeName">) {
  const place = meal.placeName?.trim();
  if (!place || place === sourceName[meal.sourceType]) return null;
  return place;
}

/** 時刻から食事区分を推測する (記録の初期値)。 */
export function timingFromDate(date: Date): Timing {
  const hour = date.getHours();
  if (hour >= 4 && hour < 10) return "breakfast";
  if (hour >= 10 && hour < 15) return "lunch";
  if (hour >= 15 && hour < 17) return "snack";
  if (hour >= 17 && hour < 22) return "dinner";
  return "late_snack";
}

export { imageUrl } from "@/lib/images";

export const emptyFacts = (): NutritionFacts => ({
  caloriesKcal: 0,
  proteinG: 0,
  fatG: 0,
  carbohydrateG: 0,
  fiberG: null,
  saltEquivalentG: null,
  micronutrients: [],
});

export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    let message = `通信に失敗しました (${response.status})`;
    try {
      message = errorMessageFrom(await response.json(), message);
    } catch {}
    throw new Error(message);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
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

export function combineLocalDateTime(date: string, time: string) {
  return new Date(`${date}T${time || "00:00"}`).toISOString();
}

const parseCalendarDate = (key: string) => {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
};

/** 期間の始まりと終わり (どちらも端を含む、端末のローカル時刻)。週は月曜始まり。 */
export function periodRange(period: MealPeriod, anchor: string) {
  const base = parseCalendarDate(anchor);
  const year = base.getFullYear();
  const month = base.getMonth();
  const day = base.getDate();
  const start =
    period === "day"
      ? new Date(year, month, day)
      : period === "week"
        ? new Date(year, month, day - ((base.getDay() + 6) % 7))
        : new Date(year, month, 1);
  const next =
    period === "day"
      ? new Date(year, month, day + 1)
      : period === "week"
        ? new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7)
        : new Date(year, month + 1, 1);
  return { start, end: new Date(next.getTime() - 1) };
}

/** 基準日を 1 期間ずらす。 */
export function shiftAnchor(period: MealPeriod, anchor: string, direction: 1 | -1) {
  const base = parseCalendarDate(anchor);
  if (period === "day") base.setDate(base.getDate() + direction);
  if (period === "week") base.setDate(base.getDate() + 7 * direction);
  if (period === "month") base.setMonth(base.getMonth() + direction, 1);
  return localCalendarDate(base);
}

/** "11月9日(月)〜11月15日(日)" / "2026年11月"。 */
export function periodLabel(period: MealPeriod, anchor: string) {
  const { start, end } = periodRange(period, anchor);
  if (period === "day") return formatDateJa(start);
  if (period === "month") return `${start.getFullYear()}年${start.getMonth() + 1}月`;
  return `${formatDateJa(start)}〜${formatDateJa(end)}`;
}

/**
 * 一覧の合計。栄養価の無い記録は栄養の合計から外し、その件数を `nutritionMissing` に数える。
 * 栄養価のある記録が 1 件も無ければ栄養の値は不明 (null)。
 */
export function summarizeMeals(meals: readonly Meal[]): MealTotals {
  let priceYen: number | null = null;
  let known = 0;
  let caloriesKcal = 0;
  let proteinG = 0;
  let fatG = 0;
  let carbohydrateG = 0;
  let fiberG: number | null = null;
  let saltEquivalentG: number | null = null;
  for (const meal of meals) {
    if (meal.totalPriceYen !== null) priceYen = (priceYen ?? 0) + meal.totalPriceYen;
    const facts = meal.totalNutrition;
    if (!facts) continue;
    known += 1;
    caloriesKcal += facts.caloriesKcal;
    proteinG += facts.proteinG;
    fatG += facts.fatG;
    carbohydrateG += facts.carbohydrateG;
    if (facts.fiberG !== null) fiberG = (fiberG ?? 0) + facts.fiberG;
    if (facts.saltEquivalentG !== null)
      saltEquivalentG = (saltEquivalentG ?? 0) + facts.saltEquivalentG;
  }
  const hasFacts = known > 0;
  return {
    priceYen,
    caloriesKcal: hasFacts ? caloriesKcal : null,
    proteinG: hasFacts ? proteinG : null,
    fatG: hasFacts ? fatG : null,
    carbohydrateG: hasFacts ? carbohydrateG : null,
    fiberG,
    saltEquivalentG,
    nutritionMissing: meals.length - known,
  };
}

export interface MealDay {
  key: string;
  date: Date;
  meals: Meal[];
  priceYen: number;
  caloriesKcal: number | null;
}

/** 端末の暦日ごとにまとめる。新しい日が先、日の中は時刻順。 */
export function groupMealsByDay(meals: readonly Meal[]): MealDay[] {
  const groups = new Map<string, MealDay>();
  for (const meal of meals) {
    const key = localCalendarDate(meal.eatenAt);
    const group = groups.get(key) ?? {
      key,
      date: parseCalendarDate(key),
      meals: [],
      priceYen: 0,
      caloriesKcal: null,
    };
    group.meals.push(meal);
    group.priceYen += meal.totalPriceYen ?? 0;
    if (meal.totalNutrition) {
      group.caloriesKcal = (group.caloriesKcal ?? 0) + meal.totalNutrition.caloriesKcal;
    }
    groups.set(key, group);
  }
  for (const group of groups.values()) {
    group.meals.sort((a, b) => (a.eatenAt < b.eatenAt ? -1 : 1));
  }
  return [...groups.values()].sort((a, b) => (a.key < b.key ? 1 : -1));
}
