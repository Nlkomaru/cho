import {
  Box,
  Button,
  Checkbox,
  Drawer,
  Field,
  Flex,
  Input,
  Portal,
  Stack,
  Textarea,
} from "@chakra-ui/react";
import { useEffect, useMemo, useState } from "react";

import { DateField } from "../../../components/ui/date-field";
import { Feedback } from "../../../components/ui/feedback";
import { List, ListItem } from "../../../components/ui/list";
import { NumberField } from "../../../components/ui/number-field";
import { SelectField } from "../../../components/ui/select-field";
import { scaleNutritionFacts, type NutritionFacts } from "../../../domain/nutrition";
import {
  calculateIngredientCost,
  calculateIngredientNutrition,
  type Ingredient,
} from "../../../domain/ingredient";
import {
  api,
  combineLocalDateTime,
  emptyFacts,
  localCalendarDate,
  localTimeValue,
  sources,
  timings,
  type Analysis,
  type CreatedMeal,
  type Dish,
  type MealItem,
  type Source,
  type Timing,
} from "./meal-shared";

const modeOptions = [
  { value: "ai", label: "AI解析" },
  { value: "dish", label: "レシピから選択" },
  { value: "direct", label: "直接入力" },
];
const sourceSelectOptions = sources
  .filter(([value]) => value)
  .map(([value, label]) => ({ value, label }));
const timingSelectOptions = timings
  .filter(([value]) => value)
  .map(([value, label]) => ({ value, label }));

export interface MealEntryDrawerProps {
  open: boolean;
  close: () => void;
  saved: () => Promise<void>;
  initialDishId?: string;
  initialServings: number;
}

export function MealEntryDrawer({
  open,
  close,
  saved,
  initialDishId,
  initialServings,
}: MealEntryDrawerProps) {
  const now = new Date();
  const [mode, setMode] = useState<"ai" | "dish" | "direct">(initialDishId ? "dish" : "ai");
  const [source, setSource] = useState<Source>(initialDishId ? "self_cooked" : "other");
  const [title, setTitle] = useState("");
  const [place, setPlace] = useState("");
  const [dateValue, setDateValue] = useState(localCalendarDate(now));
  const [timeValue, setTimeValue] = useState(localTimeValue(now));
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

  const dishOptions = useMemo(
    () => dishes.map((dish) => ({ value: dish.id, label: dish.name })),
    [dishes],
  );
  const ingredientOptions = useMemo(
    () => ingredients.map((item) => ({ value: item.id, label: item.name })),
    [ingredients],
  );

  useEffect(() => {
    if (!open) return;
    if (mode === "dish")
      void api<Dish[]>("/api/dishes")
        .then((list) => {
          setDishes(list);
          const dish = initialDishId ? list.find((entry) => entry.id === initialDishId) : undefined;
          if (!dish) return;
          const factor = initialServings;
          setTitle(dish.name);
          setPrice(dish.totalCostYen === null ? "" : String(dish.totalCostYen * factor));
          setItems([
            {
              name: dish.name,
              dishId: dish.id,
              servingsFactor: factor,
              priceYen: dish.totalCostYen === null ? null : dish.totalCostYen * factor,
              nutrition: dish.totalNutrition
                ? scaleNutritionFacts(dish.totalNutrition, factor)
                : null,
              estimationSource: "recipe",
            },
          ]);
        })
        .catch((cause: unknown) =>
          setError(cause instanceof Error ? cause.message : "レシピを読み込めませんでした。"),
        );
    if (mode === "direct")
      void api<Ingredient[]>("/api/ingredients")
        .then(setIngredients)
        .catch((cause: unknown) =>
          setError(cause instanceof Error ? cause.message : "材料を読み込めませんでした。"),
        );
  }, [open, mode, initialDishId, initialServings]);

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
    setItems([
      {
        name: dish.name,
        dishId: dish.id,
        servingsFactor,
        priceYen: dish.totalCostYen === null ? null : dish.totalCostYen * servingsFactor,
        nutrition: dish.totalNutrition
          ? scaleNutritionFacts(dish.totalNutrition, servingsFactor)
          : null,
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
        eatenAt: combineLocalDateTime(dateValue, timeValue),
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
    <Drawer.Root
      open={open}
      onOpenChange={(details) => {
        if (!details.open) close();
      }}
      placement="end"
      size="md"
    >
      <Portal>
        <Drawer.Backdrop />
        <Drawer.Positioner>
          <Drawer.Content>
            <Drawer.Header>
              <Drawer.Title textStyle="heading.md">食事を記録</Drawer.Title>
              <Drawer.CloseTrigger asChild>
                <Button variant="outline" size="sm" disabled={working}>
                  閉じる
                </Button>
              </Drawer.CloseTrigger>
            </Drawer.Header>
            <Drawer.Body>
              <Stack gap="5">
                <SelectField
                  label="入力方法"
                  value={mode}
                  onChange={(value) => setMode(value as typeof mode)}
                  options={modeOptions}
                />
                {mode === "ai" ? (
                  <Stack gap="3">
                    <Field.Root>
                      <Field.Label>写真を選択</Field.Label>
                      <Input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
                        multiple
                        onChange={(event) => {
                          setFiles(Array.from(event.target.files ?? []).slice(0, 4));
                          setImageIds([]);
                        }}
                      />
                    </Field.Root>
                    <Field.Root>
                      <Field.Label>料理・レシートについて</Field.Label>
                      <Textarea value={hint} onChange={(event) => setHint(event.target.value)} />
                    </Field.Root>
                    <Button
                      disabled={working}
                      variant="outline"
                      alignSelf="start"
                      onClick={() => void analyze()}
                    >
                      解析する
                    </Button>
                    <Feedback tone="status">{files.length} / 4 枚</Feedback>
                  </Stack>
                ) : null}
                {mode === "dish" ? (
                  <Stack gap="3">
                    <SelectField
                      label="レシピ"
                      value={dishId}
                      onChange={(value) => chooseDish(value)}
                      options={dishOptions}
                      placeholder="選択"
                    />
                    <NumberField
                      label="人前数"
                      value={servings}
                      min={0.1}
                      step={0.1}
                      onChange={(value) => {
                        setServings(value);
                        if (dishId) chooseDish(dishId, Number(value));
                      }}
                    />
                    <Checkbox.Root
                      checked={stock}
                      onCheckedChange={(details) => setStock(Boolean(details.checked))}
                    >
                      <Checkbox.HiddenInput />
                      <Checkbox.Control />
                      <Checkbox.Label>Inventiaの在庫を消費する</Checkbox.Label>
                    </Checkbox.Root>
                  </Stack>
                ) : null}
                {mode === "direct" ? (
                  <Stack gap="3">
                    <SelectField
                      label="材料マスタから選択"
                      value={ingredientId}
                      onChange={(value) => chooseIngredient(value)}
                      options={ingredientOptions}
                      placeholder="選択しない"
                    />
                    {ingredientId ? (
                      <NumberField
                        label={`分量（${ingredients.find((entry) => entry.id === ingredientId)?.baseUnit ?? "基準単位"}）`}
                        value={ingredientQty}
                        min={0}
                        step={0.1}
                        onChange={(value) => {
                          setIngredientQty(value);
                          const quantity = Number(value);
                          if (quantity > 0) chooseIngredient(ingredientId, quantity);
                        }}
                      />
                    ) : null}
                  </Stack>
                ) : null}
                <Stack gap="3">
                  <Field.Root>
                    <Field.Label>料理名</Field.Label>
                    <Input
                      required
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                    />
                  </Field.Root>
                  <Flex gap="3" align="flex-end" wrap="wrap">
                    <Box flex="1 1 12rem">
                      <DateField label="日付" value={dateValue} onChange={setDateValue} />
                    </Box>
                    <Box flex="0 0 8rem">
                      <Field.Root>
                        <Field.Label>時刻</Field.Label>
                        <Input
                          type="time"
                          aria-label="時刻"
                          value={timeValue}
                          onChange={(event) => setTimeValue(event.target.value)}
                        />
                      </Field.Root>
                    </Box>
                  </Flex>
                  <SelectField
                    label="食事区分"
                    value={timing}
                    onChange={(value) => setTiming(value as Timing)}
                    options={timingSelectOptions}
                  />
                  <SelectField
                    label="区分"
                    value={source}
                    onChange={(value) => setSource(value as Source)}
                    options={sourceSelectOptions}
                  />
                  <Field.Root>
                    <Field.Label>場所</Field.Label>
                    <Input value={place} onChange={(event) => setPlace(event.target.value)} />
                  </Field.Root>
                  <NumberField
                    label="合計料金（円）"
                    value={price}
                    min={0}
                    step={1}
                    onChange={setPrice}
                  />
                </Stack>
                <Box>
                  <Box textStyle="label" marginBottom="2">
                    品目
                  </Box>
                  <List>
                    {items.map((item, index) => (
                      <ListItem key={index}>
                        <Field.Root>
                          <Field.Label>品目名</Field.Label>
                          <Input
                            value={item.name}
                            onChange={(event) => updateItem(index, { name: event.target.value })}
                          />
                        </Field.Root>
                        <NumberField
                          label="料金（円）"
                          value={item.priceYen === null ? "" : String(item.priceYen)}
                          min={0}
                          step={1}
                          onChange={(value) =>
                            updateItem(index, {
                              priceYen: value === "" ? null : Number(value),
                            })
                          }
                        />
                        <NutritionFields
                          value={item.nutrition}
                          change={(nutrition) => updateItem(index, { nutrition })}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          alignSelf="start"
                          onClick={() =>
                            setItems((current) =>
                              current.filter((_, position) => index !== position),
                            )
                          }
                          disabled={items.length === 1}
                        >
                          品目を削除
                        </Button>
                      </ListItem>
                    ))}
                  </List>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      setItems((current) => [
                        ...current,
                        { name: "", priceYen: null, nutrition: null },
                      ])
                    }
                  >
                    品目を追加
                  </Button>
                </Box>
                {error ? (
                  <Feedback tone="error" role="alert">
                    {error}
                  </Feedback>
                ) : null}
              </Stack>
            </Drawer.Body>
            <Drawer.Footer>
              <Flex gap="3" wrap="wrap">
                <Button
                  colorPalette="red"
                  disabled={working || !title.trim()}
                  onClick={() => void save()}
                >
                  {working ? "処理中…" : savedMealId ? "在庫消費を再試行" : "食事を保存"}
                </Button>
                {savedMealId ? (
                  <Button variant="outline" onClick={() => void saved()}>
                    記録を閉じる
                  </Button>
                ) : null}
              </Flex>
            </Drawer.Footer>
          </Drawer.Content>
        </Drawer.Positioner>
      </Portal>
    </Drawer.Root>
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
      <Stack gap="2" marginTop="2">
        {fields.map(([key, label]) => (
          <NumberField
            key={key}
            label={label}
            value={draft[key]}
            min={0}
            step={0.1}
            onChange={(next) => update(key, next)}
          />
        ))}
      </Stack>
    </details>
  );
}
