import { useCallback, useEffect, useState } from "react";
import { Box, Button, Flex, Heading, Stack, Text } from "@chakra-ui/react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { Card } from "../../components/ui/card";
import { DataTable, DataTableCell, DataTableRow } from "../../components/ui/data-table";
import { Feedback } from "../../components/ui/feedback";
import { Field, NativeInput, NativeSelect, NativeTextArea } from "../../components/ui/form";
import { Page, PageHeader } from "../../components/ui/page";
import { StatBar } from "../../components/ui/stat-bar";
import type { NutritionFacts } from "../../domain/nutrition";
import {
  calculateIngredientCost,
  calculateIngredientNutrition,
  type Ingredient,
} from "../../domain/ingredient";

const mealSearchSchema = z.object({
  dishId: z.string().trim().min(1).optional(),
  servings: z.coerce.number().positive().finite().optional(),
});

export const Route = createFileRoute("/_app/")({
  validateSearch: mealSearchSchema,
  staticData: { breadcrumbs: [{ label: "食事記録" }] },
  component: MealListPage,
});
type Source =
  | "self_cooked"
  | "cafeteria"
  | "convenience"
  | "supermarket"
  | "snack"
  | "restaurant"
  | "other";
type Timing = "breakfast" | "lunch" | "dinner" | "snack" | "late_snack";
type MealItem = {
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
type Meal = {
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
type PeriodTotals = {
  priceYen: number;
  caloriesKcal: number | null;
  proteinG: number | null;
  fatG: number | null;
  carbohydrateG: number | null;
  fiberG: number | null;
  saltEquivalentG: number | null;
};
type MealListResponse = {
  meals: Meal[];
  summary: { day: PeriodTotals; week: PeriodTotals; month: PeriodTotals };
};
type StockConsumption = {
  status: "succeeded" | "failed" | "skipped";
  results: unknown[];
  error: string | null;
};
type CreatedMeal = Meal & { stockConsumption?: StockConsumption };
type Dish = {
  id: string;
  name: string;
  servings: number;
  totalNutrition: NutritionFacts | null;
  totalCostYen: number | null;
};
type Analysis = {
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
const sources: [Source | "", string][] = [
  ["", "すべて"],
  ["self_cooked", "自炊"],
  ["cafeteria", "学食"],
  ["convenience", "コンビニ"],
  ["supermarket", "スーパー"],
  ["snack", "お菓子"],
  ["restaurant", "外食"],
  ["other", "その他"],
];
const timings: [Timing | "", string][] = [
  ["", "すべて"],
  ["breakfast", "朝食"],
  ["lunch", "昼食"],
  ["dinner", "夕食"],
  ["snack", "間食"],
  ["late_snack", "夜食"],
];
const sourceName: Record<Source, string> = Object.fromEntries(
  sources.filter(([id]) => id).map(([id, name]) => [id, name]),
) as Record<Source, string>;
const emptyFacts = (): NutritionFacts => ({
  caloriesKcal: 0,
  proteinG: 0,
  fatG: 0,
  carbohydrateG: 0,
  fiberG: null,
  saltEquivalentG: null,
  micronutrients: [],
});
function fmt(n: number | null | undefined, digits = 1) {
  return n == null ? "—" : n.toLocaleString("ja-JP", { maximumFractionDigits: digits });
}
function currency(n: number | null | undefined) {
  return n == null ? "—" : `¥${Math.round(n).toLocaleString("ja-JP")}`;
}
async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    let message = `通信に失敗しました (${response.status})`;
    try {
      message = ((await response.json()) as { error?: string }).error ?? message;
    } catch {}
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}
function nutritionText(nutrition: NutritionFacts | null) {
  if (!nutrition) return "栄養価 —";
  return `${fmt(nutrition.caloriesKcal)} kcal · P ${fmt(nutrition.proteinG)}g / F ${fmt(nutrition.fatG)}g / C ${fmt(nutrition.carbohydrateG)}g / 食塩 ${fmt(nutrition.saltEquivalentG)}g`;
}
function localDateTimeValue(date = new Date()) {
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}
function MealListPage() {
  const search = Route.useSearch();
  const requestedDishId = search.dishId;
  const requestedServings = search.servings ?? 1;
  const [open, setOpen] = useState(Boolean(requestedDishId));
  const [meals, setMeals] = useState<Meal[]>([]);
  const [summary, setSummary] = useState<MealListResponse["summary"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [period, setPeriod] = useState<"day" | "week" | "month">("day");
  const [source, setSource] = useState<Source | "">("");
  const [timing, setTiming] = useState<Timing | "">("");
  const [query, setQuery] = useState("");
  const [date, setDate] = useState("");
  const [view, setView] = useState<"cards" | "table">("cards");
  const refresh = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (source) params.set("sourceType", source);
    if (timing) params.set("mealTiming", timing);
    if (query.trim()) params.set("q", query.trim());
    if (date) params.set("date", date);
    const suffix = params.size ? `?${params}` : "";
    try {
      const result = await api<MealListResponse>(`/api/meals${suffix}`);
      setMeals(result.meals);
      setSummary(result.summary);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "食事記録を読み込めませんでした。");
    } finally {
      setLoading(false);
    }
  }, [source, timing, query, date]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  const totals = summary?.[period] ?? null;
  return (
    <Page size="lg">
      <PageHeader
        title="食事記録"
        actions={
          <Button colorPalette="red" onClick={() => setOpen(true)}>
            記録を追加
          </Button>
        }
      />
      <Flex gap="2" aria-label="集計期間">
        {(
          [
            ["day", "日"],
            ["week", "週"],
            ["month", "月"],
          ] as const
        ).map(([key, label]) => (
          <Button
            key={key}
            size="sm"
            variant={period === key ? "outline" : "ghost"}
            colorPalette={period === key ? "red" : "gray"}
            onClick={() => setPeriod(key)}
          >
            {label}
          </Button>
        ))}
      </Flex>
      <StatBar
        label="期間の集計"
        items={[
          { label: "料金", value: currency(totals?.priceYen) },
          { label: "エネルギー", value: `${fmt(totals?.caloriesKcal)} kcal` },
          {
            label: "PFC",
            value: `P ${fmt(totals?.proteinG)}g / F ${fmt(totals?.fatG)}g / C ${fmt(totals?.carbohydrateG)}g`,
          },
          {
            label: "食物繊維・食塩",
            value: `食物繊維 ${fmt(totals?.fiberG)}g / 食塩 ${fmt(totals?.saltEquivalentG)}g`,
          },
        ]}
      />
      <Flex as="section" aria-label="食事記録の絞り込み" gap="3" wrap="wrap" align="end">
        <Field label="区分">
          <NativeSelect
            value={source}
            onChange={(event) => setSource(event.target.value as Source | "")}
          >
            {sources.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="食事区分">
          <NativeSelect
            value={timing}
            onChange={(event) => setTiming(event.target.value as Timing | "")}
          >
            {timings.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="料理名・場所">
          <NativeInput
            aria-label="料理名・場所で検索"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </Field>
        <Field label="日付">
          <NativeInput
            type="date"
            aria-label="日付で絞り込み"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </Field>
        <Flex ml={{ base: "0", md: "auto" }} gap="2">
          <Button
            aria-pressed={view === "cards"}
            variant={view === "cards" ? "outline" : "ghost"}
            onClick={() => setView("cards")}
          >
            カード
          </Button>
          <Button
            aria-pressed={view === "table"}
            variant={view === "table" ? "outline" : "ghost"}
            onClick={() => setView("table")}
          >
            表
          </Button>
        </Flex>
      </Flex>
      {error && (
        <Feedback tone="error" role="alert">
          {error}{" "}
          <Button variant="outline" onClick={() => void refresh()}>
            再読み込み
          </Button>
        </Feedback>
      )}
      {loading ? (
        <Feedback tone="status" role="status">
          読み込み中
        </Feedback>
      ) : meals.length === 0 ? (
        <Text>該当する食事記録はありません。</Text>
      ) : view === "table" ? (
        <DataTable
          label="食事記録の表"
          columns={["画像", "日時", "区分", "料理名", "料金", "栄養価"]}
        >
          {meals.map((meal) => (
            <DataTableRow key={meal.id}>
              <DataTableCell>
                {meal.imageIds[0] ? (
                  <img
                    src={`/api/images/${encodeURIComponent(meal.imageIds[0])}`}
                    alt={`${meal.title}の写真`}
                    width={48}
                    height={48}
                  />
                ) : (
                  "—"
                )}
              </DataTableCell>
              <DataTableCell numeric>
                {new Date(meal.eatenAt).toLocaleString("ja-JP")}
              </DataTableCell>
              <DataTableCell>{sourceName[meal.sourceType]}</DataTableCell>
              <DataTableCell>
                <Link to="/meals/$mealId" params={{ mealId: meal.id }}>
                  {meal.title}
                </Link>
              </DataTableCell>
              <DataTableCell numeric>{currency(meal.totalPriceYen)}</DataTableCell>
              <DataTableCell numeric>{nutritionText(meal.totalNutrition)}</DataTableCell>
            </DataTableRow>
          ))}
        </DataTable>
      ) : (
        <Box
          display="grid"
          gridTemplateColumns="repeat(auto-fit,minmax(min(100%,260px),1fr))"
          gap="3"
        >
          {meals.map((meal) => (
            <Card
              as="article"
              key={meal.id}
              media={
                meal.imageIds[0] ? (
                  <img
                    src={`/api/images/${encodeURIComponent(meal.imageIds[0])}`}
                    alt={`${meal.title}の写真`}
                  />
                ) : undefined
              }
              title={
                <Link to="/meals/$mealId" params={{ mealId: meal.id }}>
                  {meal.title}
                </Link>
              }
              meta={`${new Date(meal.eatenAt).toLocaleString("ja-JP")}　${sourceName[meal.sourceType]}`}
            >
              <Text textStyle="numeric.sm">
                {currency(meal.totalPriceYen)}　·　{nutritionText(meal.totalNutrition)}
              </Text>
            </Card>
          ))}
        </Box>
      )}
      {open && (
        <MealDialog
          initialDishId={requestedDishId}
          initialServings={requestedServings}
          close={() => {
            setOpen(false);
            void refresh();
          }}
          saved={async () => {
            setOpen(false);
            await refresh();
          }}
        />
      )}
    </Page>
  );
}
function MealDialog({
  close,
  saved,
  initialDishId,
  initialServings,
}: {
  close: () => void;
  saved: () => Promise<void>;
  initialDishId?: string;
  initialServings: number;
}) {
  const [mode, setMode] = useState<"ai" | "dish" | "direct">(initialDishId ? "dish" : "ai");
  const [source, setSource] = useState<Source>(initialDishId ? "self_cooked" : "other");
  const [title, setTitle] = useState("");
  const [place, setPlace] = useState("");
  const [date, setDate] = useState(localDateTimeValue);
  const [timing, setTiming] = useState<Timing>("lunch");
  const [price, setPrice] = useState("");
  const [items, setItems] = useState<MealItem[]>([{ name: "", priceYen: null, nutrition: null }]);
  const [files, setFiles] = useState<File[]>([]);
  const [imageIds, setImageIds] = useState<string[]>([]);
  const [hint, setHint] = useState("");
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [dishId, setDishId] = useState(initialDishId ?? "");
  const [servings, setServings] = useState(String(initialServings));
  const [stock, setStock] = useState(false);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [ingredientId, setIngredientId] = useState("");
  const [ingredientQty, setIngredientQty] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [savedMealId, setSavedMealId] = useState<string | null>(null);
  useEffect(() => {
    if (mode === "dish")
      void api<Dish[]>("/api/dishes")
        .then((list) => {
          setDishes(list);
          const dish = initialDishId ? list.find((entry) => entry.id === initialDishId) : undefined;
          if (!dish) return;
          const factor = initialServings;
          setTitle(dish.name);
          setPrice(dish.totalCostYen === null ? "" : String(dish.totalCostYen * factor));
          const nutrition = dish.totalNutrition
            ? {
                ...dish.totalNutrition,
                caloriesKcal: dish.totalNutrition.caloriesKcal * factor,
                proteinG: dish.totalNutrition.proteinG * factor,
                fatG: dish.totalNutrition.fatG * factor,
                carbohydrateG: dish.totalNutrition.carbohydrateG * factor,
                fiberG:
                  dish.totalNutrition.fiberG === null ? null : dish.totalNutrition.fiberG * factor,
                saltEquivalentG:
                  dish.totalNutrition.saltEquivalentG === null
                    ? null
                    : dish.totalNutrition.saltEquivalentG * factor,
                micronutrients: dish.totalNutrition.micronutrients.map((entry) => ({
                  ...entry,
                  amount: entry.amount * factor,
                })),
              }
            : null;
          setItems([
            {
              name: dish.name,
              dishId: dish.id,
              servingsFactor: factor,
              priceYen: dish.totalCostYen === null ? null : dish.totalCostYen * factor,
              nutrition,
              estimationSource: "recipe",
            },
          ]);
        })
        .catch((cause) => setError(cause.message));
    if (mode === "direct")
      void api<Ingredient[]>("/api/ingredients")
        .then(setIngredients)
        .catch((cause) => setError(cause.message));
  }, [mode, initialDishId, initialServings]);
  function updateItem(index: number, patch: Partial<MealItem>) {
    const manual = "priceYen" in patch || "nutrition" in patch;
    setItems((current) =>
      current.map((item, i) =>
        i === index
          ? { ...item, ...patch, ...(manual ? { estimationSource: "manual" } : {}) }
          : item,
      ),
    );
  }
  async function analyze() {
    setWorking(true);
    setError("");
    try {
      const uploaded: string[] = [];
      for (const file of files) {
        const form = new FormData();
        form.append("file", file);
        const result = await api<{ id: string }>("/api/images/upload", {
          method: "POST",
          body: form,
        });
        uploaded.push(result.id);
      }
      setImageIds(uploaded);
      const result = await api<Analysis>("/api/ai/analyze-meal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageIds: uploaded,
          textHint: hint || undefined,
          sourceType: source,
        }),
      });
      setTitle(result.suggestedTitle);
      setPlace(result.suggestedPlaceName ?? "");
      setPrice(result.totalPriceYen?.toString() ?? "");
      setItems(
        result.items.map((item) => ({
          name: item.name,
          priceYen: item.estimatedPriceYen,
          nutrition: item.nutrition,
          estimationSource: "ai",
        })),
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "AI解析に失敗しました。");
    } finally {
      setWorking(false);
    }
  }
  function chooseDish(id: string, factor = Number(servings)) {
    setDishId(id);
    setSource("self_cooked");
    const dish = dishes.find((entry) => entry.id === id);
    if (!dish) return;
    const servingsFactor = Number.isFinite(factor) && factor > 0 ? factor : 1;
    setTitle(dish.name);
    setPrice(dish.totalCostYen === null ? "" : String(dish.totalCostYen * servingsFactor));
    const nutrition = dish.totalNutrition
      ? {
          ...dish.totalNutrition,
          caloriesKcal: dish.totalNutrition.caloriesKcal * servingsFactor,
          proteinG: dish.totalNutrition.proteinG * servingsFactor,
          fatG: dish.totalNutrition.fatG * servingsFactor,
          carbohydrateG: dish.totalNutrition.carbohydrateG * servingsFactor,
          fiberG:
            dish.totalNutrition.fiberG === null
              ? null
              : dish.totalNutrition.fiberG * servingsFactor,
          saltEquivalentG:
            dish.totalNutrition.saltEquivalentG === null
              ? null
              : dish.totalNutrition.saltEquivalentG * servingsFactor,
          micronutrients: dish.totalNutrition.micronutrients.map((entry) => ({
            ...entry,
            amount: entry.amount * servingsFactor,
          })),
        }
      : null;
    setItems([
      {
        name: dish.name,
        dishId: dish.id,
        servingsFactor,
        priceYen: dish.totalCostYen === null ? null : dish.totalCostYen * servingsFactor,
        nutrition,
        estimationSource: "recipe",
      },
    ]);
  }
  function chooseIngredient(id: string, amount = 0) {
    setIngredientId(id);
    const ingredient = ingredients.find((entry) => entry.id === id);
    if (!ingredient) {
      setIngredientQty("");
      return;
    }
    const quantity = amount > 0 ? amount : ingredient.nutritionBasisAmount;
    setIngredientQty(String(quantity));
    setItems([
      {
        name: ingredient.name,
        ingredientId: ingredient.id,
        servingsFactor: quantity / ingredient.nutritionBasisAmount,
        priceYen: calculateIngredientCost(ingredient, quantity),
        nutrition: calculateIngredientNutrition(ingredient, quantity),
        estimationSource: "ingredient",
      },
    ]);
  }
  async function save() {
    if (savedMealId) {
      await finishStockOrClose(savedMealId);
      return;
    }
    const validItems = items.filter((item) => item.name.trim().length > 0);
    if (validItems.length === 0) {
      setError("品目名を1つ以上入力してください。");
      return;
    }
    if (stock && mode === "dish" && source !== "self_cooked") {
      setError("在庫を消費するには、区分を「自炊」にしてください。");
      return;
    }
    setWorking(true);
    setError("");
    try {
      const payload = {
        eatenAt: new Date(date).toISOString(),
        mealTiming: timing,
        sourceType: source,
        placeName: place || null,
        title,
        totalPriceYen: price === "" ? null : Number(price),
        totalNutrition: null,
        rating: null,
        memo: null,
        imageIds: mode === "ai" ? imageIds : [],
        consumeStock: stock && mode === "dish" ? true : undefined,
        items: validItems.map((item, index) => ({
          ...item,
          sortOrder: index,
          priceYen: item.priceYen === null ? null : Number(item.priceYen),
        })),
      };
      const meal = await api<CreatedMeal>("/api/meals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (meal.stockConsumption?.status === "failed") {
        setSavedMealId(meal.id);
        setError(
          `食事記録は保存されました。${meal.stockConsumption.error ?? "在庫消費に失敗しました。"}在庫消費を再試行するか、記録を閉じてください。`,
        );
        return;
      }
      await saved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "食事記録を保存できませんでした。");
    } finally {
      setWorking(false);
    }
  }
  async function finishStockOrClose(id: string) {
    setWorking(true);
    setError("");
    try {
      await api(`/api/meals/${encodeURIComponent(id)}/consume-stock`, { method: "POST" });
      await saved();
    } catch (cause) {
      setError(
        `食事記録は保存されました。${cause instanceof Error ? cause.message : "在庫消費に失敗しました。"}在庫消費を再試行するか、記録を閉じてください。`,
      );
    } finally {
      setWorking(false);
    }
  }
  return (
    <Box
      role="presentation"
      position="fixed"
      inset="0"
      zIndex="overlay"
      bg="blackAlpha.500"
      display="flex"
      justifyContent="flex-end"
    >
      <Stack
        role="dialog"
        aria-modal="true"
        aria-labelledby="meal-dialog-title"
        bg="bg.panel"
        w="full"
        maxW="2xl"
        h="full"
        overflowY="auto"
        p={{ base: "4", md: "6" }}
        gap="5"
      >
        <Flex justify="space-between" align="center">
          <Heading id="meal-dialog-title" size="lg">
            食事を記録
          </Heading>
          <Button variant="outline" disabled={working} onClick={close}>
            閉じる
          </Button>
        </Flex>
        <Field label="入力方法">
          <NativeSelect
            value={mode}
            onChange={(event) => setMode(event.target.value as typeof mode)}
          >
            <option value="ai">AI解析</option>
            <option value="dish">レシピから選択</option>
            <option value="direct">直接入力</option>
          </NativeSelect>
        </Field>
        {mode === "ai" && (
          <Stack as="section" gap="3">
            <Heading as="h2" size="md">
              AI解析
            </Heading>
            <Field label="写真を選択">
              <NativeInput
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
                multiple
                onChange={(event) => {
                  setFiles(Array.from(event.target.files ?? []).slice(0, 4));
                  setImageIds([]);
                }}
              />
            </Field>
            <Field label="料理・レシートについて">
              <NativeTextArea value={hint} onChange={(event) => setHint(event.target.value)} />
            </Field>
            <Button disabled={working} variant="outline" onClick={() => void analyze()}>
              解析する
            </Button>
            <Feedback tone="status">{files.length} / 4 枚</Feedback>
          </Stack>
        )}
        {mode === "dish" && (
          <Stack as="section" gap="3">
            <Heading as="h2" size="md">
              レシピ
            </Heading>
            <Field label="レシピ">
              <NativeSelect value={dishId} onChange={(event) => chooseDish(event.target.value)}>
                <option value="">選択</option>
                {dishes.map((dish) => (
                  <option key={dish.id} value={dish.id}>
                    {dish.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="人前数">
              <NativeInput
                type="number"
                min="0.1"
                step="0.1"
                value={servings}
                onChange={(event) => {
                  setServings(event.target.value);
                  if (dishId) chooseDish(dishId, Number(event.target.value));
                }}
              />
            </Field>
            <label>
              <input
                type="checkbox"
                checked={stock}
                onChange={(event) => setStock(event.target.checked)}
              />{" "}
              Inventiaの在庫を消費する
            </label>
          </Stack>
        )}
        {mode === "direct" && (
          <Stack as="section" gap="3">
            <Heading as="h2" size="md">
              直接入力
            </Heading>
            <Field label="材料マスタから選択">
              <NativeSelect
                value={ingredientId}
                onChange={(event) => chooseIngredient(event.target.value)}
              >
                <option value="">選択しない</option>
                {ingredients.map((ingredient) => (
                  <option key={ingredient.id} value={ingredient.id}>
                    {ingredient.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            {ingredientId ? (
              <Field
                label={`分量（${ingredients.find((entry) => entry.id === ingredientId)?.baseUnit ?? "基準単位"}）`}
              >
                <NativeInput
                  type="number"
                  min="0"
                  step="0.1"
                  value={ingredientQty}
                  onChange={(event) => {
                    setIngredientQty(event.target.value);
                    const quantity = Number(event.target.value);
                    if (quantity > 0) chooseIngredient(ingredientId, quantity);
                  }}
                />
              </Field>
            ) : null}
          </Stack>
        )}
        <Stack as="fieldset" gap="3">
          <legend>食事の情報</legend>
          <Field label="料理名">
            <NativeInput
              required
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </Field>
          <Field label="日時">
            <NativeInput
              type="datetime-local"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </Field>
          <Field label="食事区分">
            <NativeSelect
              value={timing}
              onChange={(event) => setTiming(event.target.value as Timing)}
            >
              {timings
                .filter(([id]) => id)
                .map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
            </NativeSelect>
          </Field>
          <Field label="区分">
            <NativeSelect
              value={source}
              onChange={(event) => setSource(event.target.value as Source)}
            >
              {sources
                .filter(([id]) => id)
                .map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
            </NativeSelect>
          </Field>
          <Field label="場所">
            <NativeInput value={place} onChange={(event) => setPlace(event.target.value)} />
          </Field>
          <Field label="合計料金（円）">
            <NativeInput
              type="number"
              min="0"
              value={price}
              onChange={(event) => setPrice(event.target.value)}
            />
          </Field>
        </Stack>
        <Stack as="fieldset" gap="3">
          <legend>品目</legend>
          {items.map((item, index) => (
            <Stack key={index} borderBottomWidth="1px" borderColor="border" py="3" gap="2">
              <Field label="品目名">
                <NativeInput
                  value={item.name}
                  onChange={(event) => updateItem(index, { name: event.target.value })}
                />
              </Field>
              <Field label="料金（円）">
                <NativeInput
                  type="number"
                  min="0"
                  value={item.priceYen ?? ""}
                  onChange={(event) =>
                    updateItem(index, {
                      priceYen: event.target.value === "" ? null : Number(event.target.value),
                    })
                  }
                />
              </Field>
              <NutritionFields
                value={item.nutrition}
                change={(nutrition) => updateItem(index, { nutrition })}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  setItems((current) => current.filter((_, position) => index !== position))
                }
                disabled={items.length === 1}
              >
                品目を削除
              </Button>
            </Stack>
          ))}
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              setItems((current) => [...current, { name: "", priceYen: null, nutrition: null }])
            }
          >
            品目を追加
          </Button>
        </Stack>
        {error && (
          <Feedback tone="error" role="alert">
            {error}
          </Feedback>
        )}
        <Flex gap="3" wrap="wrap">
          <Button
            colorPalette="red"
            disabled={working || !title.trim()}
            onClick={() => void save()}
          >
            {working ? "処理中…" : savedMealId ? "在庫消費を再試行" : "食事を保存"}
          </Button>
          {savedMealId && (
            <Button variant="outline" onClick={() => void saved()}>
              記録を閉じる
            </Button>
          )}
        </Flex>
      </Stack>
    </Box>
  );
}
function NutritionFields({
  value,
  change,
}: {
  value: NutritionFacts | null;
  change: (nutrition: NutritionFacts) => void;
}) {
  const fields: [keyof Omit<NutritionFacts, "micronutrients">, string][] = [
    ["caloriesKcal", "エネルギー (kcal)"],
    ["proteinG", "たんぱく質 (g)"],
    ["fatG", "脂質 (g)"],
    ["carbohydrateG", "炭水化物 (g)"],
    ["fiberG", "食物繊維 (g)"],
    ["saltEquivalentG", "食塩相当量 (g)"],
  ];
  const [draft, setDraft] = useState<Record<keyof Omit<NutritionFacts, "micronutrients">, string>>(
    () => ({
      caloriesKcal: value ? String(value.caloriesKcal) : "",
      proteinG: value ? String(value.proteinG) : "",
      fatG: value ? String(value.fatG) : "",
      carbohydrateG: value ? String(value.carbohydrateG) : "",
      fiberG: value?.fiberG == null ? "" : String(value.fiberG),
      saltEquivalentG: value?.saltEquivalentG == null ? "" : String(value.saltEquivalentG),
    }),
  );
  function update(key: keyof Omit<NutritionFacts, "micronutrients">, next: string) {
    setDraft((current) => ({ ...current, [key]: next }));
    const nextFacts = value ?? emptyFacts();
    change({
      ...nextFacts,
      [key]: next === "" && (key === "fiberG" || key === "saltEquivalentG") ? null : Number(next),
    });
  }
  return (
    <details>
      <summary>栄養価を編集</summary>
      <Stack gap="2" mt="2">
        {fields.map(([key, label]) => (
          <Field key={key} label={label}>
            <NativeInput
              type="number"
              min="0"
              step="0.1"
              value={draft[key]}
              onChange={(event) => update(key, event.target.value)}
            />
          </Field>
        ))}
      </Stack>
    </details>
  );
}
