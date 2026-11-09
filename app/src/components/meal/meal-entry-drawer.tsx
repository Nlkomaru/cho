import { Box, Checkbox, Flex, Input, SimpleGrid, Stack, Textarea, chakra } from "@chakra-ui/react";
import { Sparkles } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { NutritionInline } from "@/components/food/nutrition-inline";
import { Button } from "@/components/ui/button";
import { DateField } from "@/components/ui/date-field";
import { TimeField } from "@/components/ui/time-field";
import { Feedback } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import { FormDrawer } from "@/components/ui/form-drawer";
import { NativeSelect } from "@/components/ui/native-select";
import { NumberField } from "@/components/ui/number-field";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { toaster } from "@/components/ui/toaster";
import {
  calculateIngredientCost,
  calculateIngredientNutrition,
  type Ingredient,
} from "@/domain/ingredient";
import { scaleNutritionFacts } from "@/domain/nutrition";
import { formatYen } from "@/lib/format";

import { MealItemsEditor, blankMealItem } from "./meal-items-editor";
import { MealPhotoTiles, type MealPhoto } from "./meal-photo-tiles";
import {
  api,
  combineLocalDateTime,
  imageUrl,
  localCalendarDate,
  localTimeValue,
  sourceOptions,
  timingFromDate,
  timingOptions,
  type Analysis,
  type CreatedMeal,
  type Dish,
  type Meal,
  type MealItem,
  type Source,
  type Timing,
} from "./meal-shared";

export type MealEntryMethod = "ai" | "recipe" | "ingredient" | "manual";

const methodItems = [
  { value: "ai", label: "AI解析" },
  { value: "recipe", label: "レシピ" },
  { value: "ingredient", label: "材料" },
  { value: "manual", label: "手入力" },
] as const;

const MAX_PHOTOS = 4;

type PhotoEntry = MealPhoto & { file?: File; id?: string };

export interface MealEntryDrawerProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  /** 保存が終わったとき (在庫消費の失敗を閉じたときも含む)。 */
  onSaved(mealId: string): void | Promise<void>;
  /** 渡すと編集。品目・写真・共通項目を書き換える。 */
  meal?: Meal;
  /** レシピから記録するときの料理 ID (`/?dishId=` から)。 */
  initialDishId?: string;
  initialServings?: number;
  /** 開いたときの入力方法。既定は AI 解析 (料理 ID があればレシピ)。 */
  initialMethod?: MealEntryMethod;
}

/**
 * 食事の記録・編集ドロワー。上で入力方法を選び、その方法の項目 → 共通項目 → 写真の順に並べる。
 */
export function MealEntryDrawer({
  open,
  onOpenChange,
  onSaved,
  meal,
  initialDishId,
  initialServings = 1,
  initialMethod,
}: MealEntryDrawerProps) {
  const editing = Boolean(meal);
  const [method, setMethod] = useState<MealEntryMethod>("ai");
  const [source, setSource] = useState<Source>("other");
  const [title, setTitle] = useState("");
  const [place, setPlace] = useState("");
  const [dateValue, setDateValue] = useState("");
  const [timeValue, setTimeValue] = useState("");
  const [timing, setTiming] = useState<Timing>("lunch");
  const [price, setPrice] = useState("");
  const [items, setItems] = useState<MealItem[]>([]);
  const [itemsDirty, setItemsDirty] = useState(false);
  const [itemsGeneration, setItemsGeneration] = useState(0);
  const [analyzed, setAnalyzed] = useState(false);
  const [photos, setPhotos] = useState<PhotoEntry[]>([]);
  const [hint, setHint] = useState("");
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [dishId, setDishId] = useState("");
  const [servings, setServings] = useState("1");
  const [stock, setStock] = useState(false);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [ingredientId, setIngredientId] = useState("");
  const [ingredientQty, setIngredientQty] = useState("");
  const [working, setWorking] = useState<"" | "analyze" | "save">("");
  const [error, setError] = useState("");
  const [savedMealId, setSavedMealId] = useState<string | null>(null);
  const objectUrls = useRef(new Set<string>());

  // 開くたびに入力を初期化する
  useEffect(() => {
    if (!open) return;
    const now = new Date();
    const start: MealEntryMethod = meal
      ? "manual"
      : (initialMethod ?? (initialDishId ? "recipe" : "ai"));
    setMethod(start);
    setSource(meal?.sourceType ?? (initialDishId ? "self_cooked" : "other"));
    setTitle(meal?.title ?? "");
    setPlace(meal?.placeName ?? "");
    setDateValue(localCalendarDate(meal ? new Date(meal.eatenAt) : now));
    setTimeValue(localTimeValue(meal ? new Date(meal.eatenAt) : now));
    setTiming(meal?.mealTiming ?? timingFromDate(now));
    setPrice(meal?.totalPriceYen == null ? "" : String(meal.totalPriceYen));
    setItems(
      meal
        ? meal.items.map(({ ingredientCostBreakdown: _breakdown, ...item }) => ({ ...item }))
        : start === "manual"
          ? [blankMealItem()]
          : [],
    );
    setItemsDirty(false);
    setItemsGeneration((value) => value + 1);
    setAnalyzed(false);
    setPhotos((meal?.imageIds ?? []).map((id) => ({ key: id, id, src: imageUrl(id) })));
    setHint("");
    setDishes([]);
    setIngredients([]);
    setDishId(initialDishId ?? "");
    setServings(String(initialServings));
    setStock(false);
    setIngredientId("");
    setIngredientQty("");
    setWorking("");
    setError("");
    setSavedMealId(null);
  }, [open, meal, initialDishId, initialServings, initialMethod]);

  useEffect(() => {
    const urls = objectUrls.current;
    return () => {
      for (const url of urls) URL.revokeObjectURL(url);
      urls.clear();
    };
  }, []);

  useEffect(() => {
    if (!open || method !== "recipe" || dishes.length) return;
    let cancelled = false;
    api<Dish[]>("/api/dishes")
      .then((list) => {
        if (cancelled) return;
        setDishes(list);
        const dish = initialDishId ? list.find((entry) => entry.id === initialDishId) : undefined;
        if (dish) applyDish(dish, initialServings);
      })
      .catch((cause: unknown) =>
        setError(cause instanceof Error ? cause.message : "レシピを読み込めませんでした。"),
      );
    return () => {
      cancelled = true;
    };
    // applyDish は state 更新だけなので依存に含めない
  }, [open, method, dishes.length, initialDishId, initialServings]);

  useEffect(() => {
    if (!open || method !== "ingredient" || ingredients.length) return;
    let cancelled = false;
    api<Ingredient[]>("/api/ingredients")
      .then((list) => {
        if (!cancelled) setIngredients(list);
      })
      .catch((cause: unknown) =>
        setError(cause instanceof Error ? cause.message : "材料を読み込めませんでした。"),
      );
    return () => {
      cancelled = true;
    };
  }, [open, method, ingredients.length]);

  const dishOptions = useMemo(
    () => dishes.map((dish) => ({ value: dish.id, label: dish.name })),
    [dishes],
  );
  const ingredientOptions = useMemo(
    () => ingredients.map((item) => ({ value: item.id, label: item.name })),
    [ingredients],
  );
  const selectedIngredient = ingredients.find((entry) => entry.id === ingredientId);

  function replaceItems(next: MealItem[]) {
    setItems(next);
    setItemsDirty(true);
    setItemsGeneration((value) => value + 1);
  }

  function changeMethod(next: MealEntryMethod) {
    setMethod(next);
    setError("");
    if (next === "manual" && items.length === 0) replaceItems([blankMealItem()]);
  }

  function applyDish(dish: Dish, factor: number) {
    const servingsFactor = Number.isFinite(factor) && factor > 0 ? factor : 1;
    const cost =
      dish.totalCostYen === null || dish.costMissingCount > 0
        ? null
        : dish.totalCostYen * servingsFactor;
    setDishId(dish.id);
    setSource("self_cooked");
    setTitle(dish.name);
    setPrice(cost === null ? "" : String(Math.round(cost)));
    replaceItems([
      {
        name: dish.name,
        dishId: dish.id,
        servingsFactor,
        priceYen: cost,
        nutrition: dish.totalNutrition
          ? scaleNutritionFacts(dish.totalNutrition, servingsFactor)
          : null,
        estimationSource: "recipe",
      },
    ]);
  }

  function chooseDish(id: string, factor = Number(servings)) {
    const dish = dishes.find((entry) => entry.id === id);
    if (!dish) {
      setDishId("");
      return;
    }
    applyDish(dish, factor);
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
    if (!title.trim()) setTitle(ingredient.name);
    replaceItems([
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

  function addPhotos(files: File[]) {
    const added = files.map((file) => {
      const src = URL.createObjectURL(file);
      objectUrls.current.add(src);
      return { key: src, src, file };
    });
    setPhotos((current) => [...current, ...added].slice(0, MAX_PHOTOS));
  }

  function removePhoto(key: string) {
    setPhotos((current) => current.filter((photo) => photo.key !== key));
    if (objectUrls.current.has(key)) {
      URL.revokeObjectURL(key);
      objectUrls.current.delete(key);
    }
  }

  /** 未アップロードの写真を送り、並び順どおりの画像 ID を返す。 */
  async function uploadPhotos(): Promise<string[]> {
    const ids: string[] = [];
    const next: PhotoEntry[] = [];
    for (const photo of photos) {
      if (photo.id) {
        ids.push(photo.id);
        next.push(photo);
        continue;
      }
      if (!photo.file) continue;
      const form = new FormData();
      form.append("file", photo.file);
      const result = await api<{ id: string }>("/api/images/upload", {
        method: "POST",
        body: form,
      });
      ids.push(result.id);
      next.push({ ...photo, id: result.id });
    }
    setPhotos(next);
    return ids;
  }

  async function analyze() {
    setWorking("analyze");
    setError("");
    try {
      const imageIds = await uploadPhotos();
      const result = await api<Analysis>("/api/ai/analyze-meal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageIds, textHint: hint || undefined, sourceType: source }),
      });
      setTitle(result.suggestedTitle);
      setPlace(result.suggestedPlaceName ?? "");
      setPrice(result.totalPriceYen?.toString() ?? "");
      replaceItems(
        result.items.map((item) => ({
          name: item.name,
          priceYen: item.estimatedPriceYen,
          nutrition: item.nutrition,
          estimationSource: "ai",
        })),
      );
      setAnalyzed(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "AI解析に失敗しました。");
    } finally {
      setWorking("");
    }
  }

  async function submit() {
    if (savedMealId) {
      await retryStock(savedMealId);
      return;
    }
    const validItems = items.filter((item) => item.name.trim().length > 0);
    if (validItems.length === 0) {
      setError(
        method === "ai"
          ? "写真を解析するか、手入力で品目を入力してください。"
          : method === "recipe"
            ? "レシピを選択してください。"
            : method === "ingredient"
              ? "材料を選択してください。"
              : "品目名を1つ以上入力してください。",
      );
      return;
    }
    const consumeStock = !editing && stock && method === "recipe";
    if (consumeStock && source !== "self_cooked") {
      setError("在庫を消費するには、区分を「自炊」にしてください。");
      return;
    }
    setWorking("save");
    setError("");
    try {
      const imageIds = await uploadPhotos();
      const common = {
        eatenAt: combineLocalDateTime(dateValue, timeValue),
        mealTiming: timing,
        sourceType: source,
        placeName: place.trim() || null,
        title: title.trim(),
        totalPriceYen: price === "" ? null : Number(price),
        imageIds,
      };
      const payloadItems = validItems.map((item, index) => ({ ...item, sortOrder: index }));
      if (meal) {
        await api<Meal>(`/api/meals/${encodeURIComponent(meal.id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...common, ...(itemsDirty ? { items: payloadItems } : {}) }),
        });
        toaster.create({ type: "success", title: "食事記録を更新しました" });
        await onSaved(meal.id);
        return;
      }
      const created = await api<CreatedMeal>("/api/meals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...common,
          totalNutrition: null,
          rating: null,
          memo: null,
          consumeStock: consumeStock ? true : undefined,
          items: payloadItems,
        }),
      });
      if (created.stockConsumption?.status === "failed") {
        setSavedMealId(created.id);
        setError(
          `食事記録は保存しました。${created.stockConsumption.error ?? "在庫消費に失敗しました。"}`,
        );
        return;
      }
      toaster.create({ type: "success", title: "食事を記録しました" });
      await onSaved(created.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "食事記録を保存できませんでした。");
    } finally {
      setWorking("");
    }
  }

  async function retryStock(id: string) {
    setWorking("save");
    setError("");
    try {
      await api(`/api/meals/${encodeURIComponent(id)}/consume-stock`, { method: "POST" });
      toaster.create({ type: "success", title: "在庫を消費しました" });
      await onSaved(id);
    } catch (cause) {
      setError(
        `食事記録は保存しました。${cause instanceof Error ? cause.message : "在庫消費に失敗しました。"}`,
      );
    } finally {
      setWorking("");
    }
  }

  const busy = working !== "";
  const preview = items[0];
  const photoTiles = (
    <Field label="写真">
      <MealPhotoTiles
        photos={photos}
        onAdd={addPhotos}
        onRemove={removePhoto}
        max={MAX_PHOTOS}
        disabled={busy}
      />
    </Field>
  );

  return (
    <FormDrawer
      open={open}
      onOpenChange={(next) => {
        if (busy && !next) return;
        onOpenChange(next);
      }}
      title={editing ? "食事を編集" : "食事を記録"}
      size="md"
      onSubmit={() => void submit()}
      footer={
        <Flex gap="2" w="full" justify="flex-end" wrap="wrap">
          {savedMealId ? (
            <Button variant="ghost" onClick={() => void onSaved(savedMealId)} disabled={busy}>
              記録を閉じる
            </Button>
          ) : (
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
              キャンセル
            </Button>
          )}
          <Button
            type="submit"
            variant="primary"
            loading={working === "save"}
            disabled={busy || (!savedMealId && !title.trim())}
          >
            {savedMealId ? "在庫消費を再試行" : "保存"}
          </Button>
        </Flex>
      }
    >
      <Stack gap="6">
        {error ? (
          <Feedback tone={savedMealId ? "warning" : "error"} role="alert">
            {error}
          </Feedback>
        ) : null}

        {editing ? null : (
          <Box>
            <SegmentedControl
              label="入力方法"
              size="sm"
              value={method}
              onChange={changeMethod}
              items={methodItems}
            />
          </Box>
        )}

        {method === "ai" && !editing ? (
          <Stack gap="5">
            {photoTiles}
            <Field label="料理・レシートについて">
              <Textarea
                value={hint}
                rows={3}
                placeholder="例: 学食のカレー大盛り"
                onChange={(event) => setHint(event.currentTarget.value)}
              />
            </Field>
            <Button
              variant="secondary"
              size="sm"
              alignSelf="flex-start"
              loading={working === "analyze"}
              disabled={busy || (photos.length === 0 && !hint.trim())}
              onClick={() => void analyze()}
            >
              <Sparkles strokeWidth={1.75} />
              解析する
            </Button>
            {analyzed ? (
              <MealItemsEditor
                items={items}
                resetKey={itemsGeneration}
                disabled={busy}
                onChange={(next) => {
                  setItems(next);
                  setItemsDirty(true);
                }}
              />
            ) : null}
          </Stack>
        ) : null}

        {method === "recipe" && !editing ? (
          <Stack gap="5">
            <SimpleGrid columns={{ base: 1, sm: 3 }} gap="4">
              <Box gridColumn={{ sm: "span 2" }}>
                <Field label="レシピ" required>
                  <NativeSelect
                    value={dishId}
                    placeholder={dishes.length ? "選択" : "読み込み中"}
                    options={dishOptions}
                    onChange={(value) => chooseDish(value)}
                  />
                </Field>
              </Box>
              <NumberField
                label="人前数"
                unit="人前"
                value={servings}
                min={0.1}
                step={0.5}
                onChange={(value) => {
                  setServings(value);
                  if (dishId) chooseDish(dishId, Number(value));
                }}
              />
            </SimpleGrid>
            {preview?.dishId ? <ItemPreview item={preview} /> : null}
            <Checkbox.Root
              checked={stock}
              onCheckedChange={(details) => setStock(Boolean(details.checked))}
            >
              <Checkbox.HiddenInput />
              <Checkbox.Control />
              <Checkbox.Label>Inventia の在庫を消費する</Checkbox.Label>
            </Checkbox.Root>
          </Stack>
        ) : null}

        {method === "ingredient" && !editing ? (
          <Stack gap="5">
            <SimpleGrid columns={{ base: 1, sm: 3 }} gap="4">
              <Box gridColumn={{ sm: "span 2" }}>
                <Field label="材料" required>
                  <NativeSelect
                    value={ingredientId}
                    placeholder={ingredients.length ? "選択" : "読み込み中"}
                    options={ingredientOptions}
                    onChange={(value) => chooseIngredient(value)}
                  />
                </Field>
              </Box>
              <NumberField
                label="分量"
                unit={selectedIngredient?.baseUnit}
                value={ingredientQty}
                min={0}
                step={1}
                disabled={!selectedIngredient}
                onChange={(value) => {
                  setIngredientQty(value);
                  const quantity = Number(value);
                  if (quantity > 0) chooseIngredient(ingredientId, quantity);
                }}
              />
            </SimpleGrid>
            {preview?.ingredientId ? <ItemPreview item={preview} /> : null}
          </Stack>
        ) : null}

        {method === "manual" || editing ? (
          <MealItemsEditor
            items={items}
            resetKey={itemsGeneration}
            disabled={busy}
            onChange={(next) => {
              setItems(next);
              setItemsDirty(true);
            }}
          />
        ) : null}

        <Stack gap="5" pt="6" borderTopWidth="1px" borderColor="border">
          <Field label="料理名" required>
            <Input value={title} onChange={(event) => setTitle(event.currentTarget.value)} />
          </Field>
          <SimpleGrid templateColumns="minmax(0, 1.3fr) minmax(0, 1fr)" gap="4">
            <DateField label="日付" value={dateValue} onChange={setDateValue} />
            <TimeField label="時刻" value={timeValue} onChange={setTimeValue} />
          </SimpleGrid>
          <SimpleGrid columns={2} gap="4">
            <Field label="食事区分">
              <NativeSelect
                value={timing}
                options={timingOptions}
                onChange={(value) => setTiming(value as Timing)}
              />
            </Field>
            <Field label="区分">
              <NativeSelect
                value={source}
                options={sourceOptions}
                onChange={(value) => setSource(value as Source)}
              />
            </Field>
          </SimpleGrid>
          <SimpleGrid columns={2} gap="4">
            <Field label="場所">
              <Input value={place} onChange={(event) => setPlace(event.currentTarget.value)} />
            </Field>
            <NumberField
              label="合計料金"
              unit="円"
              value={price}
              min={0}
              step={1}
              onChange={setPrice}
            />
          </SimpleGrid>
          {method !== "ai" || editing ? photoTiles : null}
        </Stack>
      </Stack>
    </FormDrawer>
  );
}

/** レシピ・材料から作った品目の確認表示。 */
function ItemPreview({ item }: { item: MealItem }) {
  return (
    <Box bg="bg.subtle" px="4" py="3">
      <Flex justify="space-between" align="baseline" gap="3">
        <chakra.span fontWeight="500" color="fg.strong" minW="0" overflowWrap="anywhere">
          {item.name}
        </chakra.span>
        <chakra.span fontWeight="500" color="fg.strong" fontVariantNumeric="tabular-nums">
          {formatYen(item.priceYen)}
        </chakra.span>
      </Flex>
      <NutritionInline facts={item.nutrition} size="xs" />
    </Box>
  );
}
