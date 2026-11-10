import { Box, Checkbox, Flex, Input, SimpleGrid, Stack, Textarea, chakra } from "@chakra-ui/react";
import { Plus, Sparkles } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

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
import { formatYen } from "@/lib/format";

import { MealItemsEditor, blankMealItem } from "./meal-items-editor";
import { MealPhotoTiles, type MealPhoto } from "./meal-photo-tiles";
import {
  api,
  combineLocalDateTime,
  dishMealItem,
  imageUrl,
  localCalendarDate,
  localTimeValue,
  sourceOptions,
  sumItemPrices,
  timingFromDate,
  titleFromItems,
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
  { value: "manual", label: "手入力" },
  { value: "recipe", label: "レシピ" },
  { value: "ingredient", label: "材料" },
  { value: "ai", label: "AI解析" },
] as const;

const MAX_PHOTOS = 4;

type PhotoEntry = MealPhoto & { file?: File; id?: string };

const isBlank = (item: MealItem) =>
  !item.name.trim() && item.priceYen === null && item.nutrition === null;

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
  /** 開いたときの品目の追加方法。既定は手入力 (料理 ID があればレシピ)。 */
  initialMethod?: MealEntryMethod;
}

/**
 * 食事の記録・編集ドロワー。品目の一覧 → 品目の追加 (手入力・レシピ・材料・AI解析) → 共通項目 → 写真の順に並べる。
 * 1 食に複数の品目を持たせ、品目ごとにレシピとつなげる。
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
  const [method, setMethod] = useState<MealEntryMethod>("manual");
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
  const [photos, setPhotos] = useState<PhotoEntry[]>([]);
  const [hint, setHint] = useState("");
  const [dishes, setDishes] = useState<Dish[] | null>(null);
  const [dishError, setDishError] = useState("");
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
    setMethod(initialMethod ?? (initialDishId ? "recipe" : "manual"));
    setSource(meal?.sourceType ?? (initialDishId ? "self_cooked" : "other"));
    setTitle(meal?.title ?? "");
    setPlace(meal?.placeName ?? "");
    setDateValue(localCalendarDate(meal ? new Date(meal.eatenAt) : now));
    setTimeValue(localTimeValue(meal ? new Date(meal.eatenAt) : now));
    setTiming(meal?.mealTiming ?? timingFromDate(now));
    // 品目の合計と同じなら入力欄は空にし、品目を変えたときに合計が追従するようにする
    setPrice(
      meal?.totalPriceYen == null || meal.totalPriceYen === sumItemPrices(meal.items)
        ? ""
        : String(meal.totalPriceYen),
    );
    setItems(
      meal
        ? meal.items.map(({ ingredientCostBreakdown: _breakdown, ...item }) => ({ ...item }))
        : initialDishId
          ? []
          : [blankMealItem()],
    );
    setItemsDirty(false);
    setItemsGeneration((value) => value + 1);
    setPhotos((meal?.imageIds ?? []).map((id) => ({ key: id, id, src: imageUrl(id) })));
    setHint("");
    setDishes(null);
    setDishError("");
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

  // 品目ごとにレシピをつなげるので、開いたら常に読み込む
  useEffect(() => {
    if (!open || dishes || dishError) return;
    let cancelled = false;
    api<Dish[]>("/api/dishes")
      .then((list) => {
        if (cancelled) return;
        setDishes(list);
        const dish = initialDishId ? list.find((entry) => entry.id === initialDishId) : undefined;
        if (dish && !meal) appendItems([dishMealItem(dish, initialServings)]);
      })
      // 手入力だけなら困らないので、レシピの欄にだけ出す
      .catch((cause: unknown) => {
        if (!cancelled)
          setDishError(cause instanceof Error ? cause.message : "レシピを読み込めませんでした。");
      });
    return () => {
      cancelled = true;
    };
    // appendItems は state 更新だけなので依存に含めない
  }, [open, dishes, dishError, meal, initialDishId, initialServings]);

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
    () => (dishes ?? []).map((dish) => ({ value: dish.id, label: dish.name })),
    [dishes],
  );
  const ingredientOptions = useMemo(
    () => ingredients.map((item) => ({ value: item.id, label: item.name })),
    [ingredients],
  );
  const selectedIngredient = ingredients.find((entry) => entry.id === ingredientId);
  const itemsTotal = sumItemPrices(items);
  const suggestedTitle = titleFromItems(items);
  const hasDishItem = items.some((item) => item.dishId);

  function changeItems(next: MealItem[]) {
    setItems(next);
    setItemsDirty(true);
  }

  /** 空の品目を捨てて後ろに足す。入力途中の栄養価は作り直す。 */
  function appendItems(next: MealItem[], drop: (item: MealItem) => boolean = () => false) {
    setItems((current) => [...current.filter((item) => !isBlank(item) && !drop(item)), ...next]);
    setItemsDirty(true);
    setItemsGeneration((value) => value + 1);
  }

  function addDish() {
    const dish = dishes?.find((entry) => entry.id === dishId);
    if (!dish) {
      setError("レシピを選択してください。");
      return;
    }
    setError("");
    if (source === "other") setSource("self_cooked");
    appendItems([dishMealItem(dish, Number(servings))]);
    setDishId("");
    setServings("1");
  }

  function chooseIngredient(id: string) {
    setIngredientId(id);
    const ingredient = ingredients.find((entry) => entry.id === id);
    setIngredientQty(ingredient ? String(ingredient.nutritionBasisAmount) : "");
  }

  function addIngredient() {
    const quantity = Number(ingredientQty);
    if (!selectedIngredient || !(quantity > 0)) {
      setError("材料と分量を入力してください。");
      return;
    }
    setError("");
    appendItems([
      {
        name: selectedIngredient.name,
        ingredientId: selectedIngredient.id,
        servingsFactor: quantity / selectedIngredient.nutritionBasisAmount,
        priceYen: calculateIngredientCost(selectedIngredient, quantity),
        nutrition: calculateIngredientNutrition(selectedIngredient, quantity),
        estimationSource: "ingredient",
      },
    ]);
    setIngredientId("");
    setIngredientQty("");
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
      if (!title.trim()) setTitle(result.suggestedTitle);
      if (!place.trim()) setPlace(result.suggestedPlaceName ?? "");
      // 解析し直したときは前回の推定を置き換え、手で直した品目やレシピの品目は残す
      appendItems(
        result.items.map((item) => ({
          name: item.name,
          priceYen: item.estimatedPriceYen,
          nutrition: item.nutrition,
          estimationSource: "ai",
        })),
        (item) => item.estimationSource === "ai",
      );
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
      setError("品目を1つ以上追加してください。");
      return;
    }
    const consumeStock = !editing && stock && validItems.some((item) => item.dishId);
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
        title: title.trim() || titleFromItems(validItems),
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
            disabled={busy || (!savedMealId && !title.trim() && !suggestedTitle)}
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

        <Stack gap="3">
          <Flex justify="space-between" align="baseline" gap="3">
            <chakra.h3 textStyle="heading.group" color="fg.strong">
              品目
            </chakra.h3>
            <chakra.span textStyle="body.sm" color="fg.muted" fontVariantNumeric="tabular-nums">
              {items.length}品 · 合計 {formatYen(itemsTotal)}
            </chakra.span>
          </Flex>
          {items.length ? (
            <MealItemsEditor
              items={items}
              resetKey={itemsGeneration}
              disabled={busy}
              dishes={dishes ?? undefined}
              onChange={changeItems}
            />
          ) : (
            <chakra.p textStyle="body.sm" color="fg.muted">
              品目はまだありません。下から追加してください。
            </chakra.p>
          )}
        </Stack>

        <Stack gap="4" bg="bg.subtle" px="4" py="4">
          <SegmentedControl
            label="品目の追加方法"
            size="sm"
            value={method}
            onChange={(next) => {
              setMethod(next);
              setError("");
            }}
            items={methodItems}
          />

          {method === "manual" ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              alignSelf="flex-start"
              disabled={busy}
              onClick={() => {
                setItems((current) => [...current, blankMealItem()]);
                setItemsDirty(true);
              }}
            >
              <Plus strokeWidth={1.75} />
              品目を追加
            </Button>
          ) : null}

          {method === "recipe" && dishError ? <Feedback tone="error">{dishError}</Feedback> : null}

          {method === "recipe" && !dishError ? (
            <SimpleGrid columns={{ base: 1, sm: 3 }} gap="4" alignItems="end">
              <Box gridColumn={{ sm: "span 2" }}>
                <Field label="レシピ">
                  <NativeSelect
                    value={dishId}
                    placeholder={dishes ? "選択" : "読み込み中"}
                    options={dishOptions}
                    onChange={setDishId}
                  />
                </Field>
              </Box>
              <NumberField
                label="人前数"
                unit="人前"
                value={servings}
                min={0.1}
                step={0.5}
                onChange={setServings}
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                justifySelf="flex-start"
                disabled={busy || !dishId}
                onClick={addDish}
              >
                <Plus strokeWidth={1.75} />
                レシピを追加
              </Button>
            </SimpleGrid>
          ) : null}

          {method === "ingredient" ? (
            <SimpleGrid columns={{ base: 1, sm: 3 }} gap="4" alignItems="end">
              <Box gridColumn={{ sm: "span 2" }}>
                <Field label="材料">
                  <NativeSelect
                    value={ingredientId}
                    placeholder={ingredients.length ? "選択" : "読み込み中"}
                    options={ingredientOptions}
                    onChange={chooseIngredient}
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
                onChange={setIngredientQty}
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                justifySelf="flex-start"
                disabled={busy || !selectedIngredient}
                onClick={addIngredient}
              >
                <Plus strokeWidth={1.75} />
                材料を追加
              </Button>
            </SimpleGrid>
          ) : null}

          {method === "ai" ? (
            <Stack gap="5">
              {photoTiles}
              <Field label="料理・レシートについて">
                <Textarea
                  value={hint}
                  rows={3}
                  placeholder="例: サバの塩焼き定食。味噌汁とごはん付き"
                  onChange={(event) => setHint(event.currentTarget.value)}
                />
              </Field>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                alignSelf="flex-start"
                loading={working === "analyze"}
                disabled={busy || (photos.length === 0 && !hint.trim())}
                onClick={() => void analyze()}
              >
                <Sparkles strokeWidth={1.75} />
                解析して追加
              </Button>
            </Stack>
          ) : null}
        </Stack>

        {!editing && hasDishItem ? (
          <Checkbox.Root
            checked={stock}
            onCheckedChange={(details) => setStock(Boolean(details.checked))}
          >
            <Checkbox.HiddenInput />
            <Checkbox.Control />
            <Checkbox.Label>レシピの材料を Inventia の在庫から消費する</Checkbox.Label>
          </Checkbox.Root>
        ) : null}

        <Stack gap="5" pt="6" borderTopWidth="1px" borderColor="border">
          <Field label="タイトル" helperText="空欄なら品目名をつなげて付けます">
            <Input
              value={title}
              placeholder={suggestedTitle || "例: 夕ごはん"}
              onChange={(event) => setTitle(event.currentTarget.value)}
            />
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
              placeholder={itemsTotal === null ? undefined : String(Math.round(itemsTotal))}
              helperText="空欄なら品目の合計"
              min={0}
              step={1}
              onChange={setPrice}
            />
          </SimpleGrid>
          {method !== "ai" ? photoTiles : null}
        </Stack>
      </Stack>
    </FormDrawer>
  );
}
