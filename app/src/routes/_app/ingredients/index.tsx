import { Box, Button, chakra, Input, Stack, Text, Textarea } from "@chakra-ui/react";
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { z } from "zod";

import { Feedback } from "../../../components/ui/feedback";
import { List, ListItem } from "../../../components/ui/list";
import { Numeric } from "../../../components/ui/numeric";
import { Page, PageHeader } from "../../../components/ui/page";
import { NutritionLine } from "../-components/nutrition-line";
import { Section } from "../../../components/ui/section";
import { FormField } from "../-components/form-field";
import { SelectControl } from "../-components/select-control";
import { errorMessageFrom } from "../../../lib/api-error";

export const Route = createFileRoute("/_app/ingredients/")({
  staticData: { breadcrumbs: [{ label: "材料" }] },
  component: IngredientsPage,
});

type Dimension = "mass" | "volume" | "count";
type Micro = { key: string; label: string; amount: number; unit: "g" | "mg" | "ug" | "kcal" };
type Nutrition = {
  caloriesKcal: number;
  proteinG: number;
  fatG: number;
  carbohydrateG: number;
  fiberG: number | null;
  saltEquivalentG: number | null;
  micronutrients: Micro[];
};
type Ingredient = {
  id: string;
  name: string;
  normalizedName: string | null;
  baseDimension: Dimension;
  baseUnit: string;
  nutritionBasisAmount: number;
  nutritionPerBasis: Nutrition;
  gramPerUnit: number | null;
  inventiaItemId: string | null;
  latestUnitPriceYen: number | null;
  latestPriceUpdatedAt: string | null;
  memo: string | null;
};
type InventiaItem = {
  id: string;
  name: string;
  baseUnit: string;
  baseDimension: Dimension;
  currentQuantity: number;
};
type StockResult = { found: boolean; currentQuantity: number | null; baseUnit: string | null };
const stockResultResponseSchema = z
  .object({
    found: z.boolean(),
    currentQuantity: z.number().nullable(),
    baseUnit: z.string().nullable(),
  })
  .strict();
const stockAdjustResponseSchema = z
  .object({ currentQuantity: z.number(), allocations: z.array(z.unknown()) })
  .strict();
type Form = {
  name: string;
  baseDimension: Dimension;
  baseUnit: string;
  nutritionBasisAmount: string;
  gramPerUnit: string;
  caloriesKcal: string;
  proteinG: string;
  fatG: string;
  carbohydrateG: string;
  fiberG: string;
  saltEquivalentG: string;
  memo: string;
  micronutrients: Micro[];
};
const emptyForm = (): Form => ({
  name: "",
  baseDimension: "mass",
  baseUnit: "g",
  nutritionBasisAmount: "100",
  gramPerUnit: "",
  caloriesKcal: "0",
  proteinG: "0",
  fatG: "0",
  carbohydrateG: "0",
  fiberG: "",
  saltEquivalentG: "",
  memo: "",
  micronutrients: [],
});
const numberField = (value: string, label: string) => {
  const number = Number(value);
  if (!value.trim() || !Number.isFinite(number) || number < 0)
    throw new Error(`${label}には0以上の数値を入力してください。`);
  return number;
};

function IngredientsPage() {
  const [items, setItems] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState<Form>(emptyForm);
  const [editing, setEditing] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [estimating, setEstimating] = useState(false);
  const [inventiaQuery, setInventiaQuery] = useState("");
  const [matches, setMatches] = useState<InventiaItem[]>([]);
  const [selectedMatch, setSelectedMatch] = useState("");
  const [busyId, setBusyId] = useState("");
  const [stock, setStock] = useState<Record<string, StockResult>>({});
  const [stockAmount, setStockAmount] = useState<Record<string, string>>({});
  const [stockRequestKeys, setStockRequestKeys] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadIngredients = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/ingredients");
      if (!response.ok) throw new Error("材料を読み込めませんでした。");
      setItems((await response.json()) as Ingredient[]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "材料を読み込めませんでした。");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void loadIngredients();
  }, [loadIngredients]);

  const visible = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    return term
      ? items.filter((item) =>
          `${item.name} ${item.baseUnit} ${item.inventiaItemId ?? ""}`
            .toLocaleLowerCase()
            .includes(term),
        )
      : items;
  }, [items, query]);
  function setField<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }
  function startEdit(item: Ingredient) {
    setEditing(item.id);
    setForm({
      name: item.name,
      baseDimension: item.baseDimension,
      baseUnit: item.baseUnit,
      nutritionBasisAmount: String(item.nutritionBasisAmount),
      gramPerUnit: item.gramPerUnit === null ? "" : String(item.gramPerUnit),
      caloriesKcal: String(item.nutritionPerBasis.caloriesKcal),
      proteinG: String(item.nutritionPerBasis.proteinG),
      fatG: String(item.nutritionPerBasis.fatG),
      carbohydrateG: String(item.nutritionPerBasis.carbohydrateG),
      fiberG: item.nutritionPerBasis.fiberG === null ? "" : String(item.nutritionPerBasis.fiberG),
      saltEquivalentG:
        item.nutritionPerBasis.saltEquivalentG === null
          ? ""
          : String(item.nutritionPerBasis.saltEquivalentG),
      memo: item.memo ?? "",
      micronutrients: item.nutritionPerBasis.micronutrients.map((micro) => ({ ...micro })),
    });
    setNotice("");
    setError("");
  }
  function newIngredient() {
    setEditing(null);
    setForm(emptyForm());
    setNotice("");
    setError("");
  }
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const payload = {
        name: form.name.trim(),
        baseDimension: form.baseDimension,
        baseUnit: form.baseUnit.trim(),
        nutritionBasisAmount: numberField(form.nutritionBasisAmount, "基準量"),
        nutritionPerBasis: {
          caloriesKcal: numberField(form.caloriesKcal, "エネルギー"),
          proteinG: numberField(form.proteinG, "たんぱく質"),
          fatG: numberField(form.fatG, "脂質"),
          carbohydrateG: numberField(form.carbohydrateG, "炭水化物"),
          fiberG: form.fiberG.trim() ? numberField(form.fiberG, "食物繊維") : null,
          saltEquivalentG: form.saltEquivalentG.trim()
            ? numberField(form.saltEquivalentG, "食塩相当量")
            : null,
          micronutrients: form.micronutrients.map((micro) => ({
            ...micro,
            key: micro.key.trim(),
            label: micro.label.trim(),
          })),
        },
        gramPerUnit: form.gramPerUnit.trim()
          ? numberField(form.gramPerUnit, "1単位あたりのグラム数")
          : null,
        memo: form.memo.trim() || null,
      };
      const response = await fetch(
        editing ? `/api/ingredients/${encodeURIComponent(editing)}` : "/api/ingredients",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        throw new Error(body.error ?? "材料を保存できませんでした。");
      }
      const ingredient = (await response.json()) as Ingredient;
      setItems((current) =>
        editing
          ? current.map((item) => (item.id === ingredient.id ? ingredient : item))
          : [...current, ingredient],
      );
      setNotice("材料を保存しました。");
      setEditing(ingredient.id);
      startEdit(ingredient);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "材料を保存できませんでした。");
    } finally {
      setSaving(false);
    }
  }
  async function estimate() {
    setEstimating(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/ai/estimate-ingredient", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          baseDimension: form.baseDimension,
          baseUnit: form.baseUnit.trim(),
        }),
      });
      const result = (await response.json()) as Nutrition & { gramPerUnit?: number };
      if (!response.ok)
        throw new Error(
          "error" in result
            ? ((result as Nutrition & { error?: string }).error ?? "栄養価を推定できませんでした。")
            : "栄養価を推定できませんでした。",
        );
      setForm((current) => ({
        ...current,
        caloriesKcal: String(result.caloriesKcal),
        proteinG: String(result.proteinG),
        fatG: String(result.fatG),
        carbohydrateG: String(result.carbohydrateG),
        fiberG: result.fiberG === null ? "" : String(result.fiberG),
        saltEquivalentG: result.saltEquivalentG === null ? "" : String(result.saltEquivalentG),
        micronutrients: result.micronutrients,
        gramPerUnit:
          result.gramPerUnit === undefined ? current.gramPerUnit : String(result.gramPerUnit),
      }));
      setNotice("栄養価をフォームに反映しました。内容を確認して保存してください。");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "栄養価を推定できませんでした。");
    } finally {
      setEstimating(false);
    }
  }
  async function searchInventia(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/ingredients/search-inventia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: inventiaQuery.trim() }),
      });
      const result = (await response.json()) as InventiaItem[] | { error?: string };
      if (!response.ok)
        throw new Error(
          "error" in result
            ? (result.error ?? "Inventia を検索できませんでした。")
            : "Inventia を検索できませんでした。",
        );
      setMatches(result as InventiaItem[]);
      setSelectedMatch("");
      if (!(result as InventiaItem[]).length) setNotice("一致する品目はありません。");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Inventia を検索できませんでした。");
    }
  }
  async function syncInventia(ingredient: Ingredient) {
    const selected = matches.find((match) => match.id === selectedMatch);
    if (!selected) {
      setError("Inventia 品目を選択してください。");
      return;
    }
    setBusyId(ingredient.id);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/ingredients/sync-inventia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ingredientId: ingredient.id, itemId: selected.id }),
      });
      const result = (await response.json()) as
        | { synced: boolean; ingredient: Ingredient; reason?: string }
        | { error?: string };
      if (!response.ok)
        throw new Error(
          "error" in result
            ? (result.error ?? "価格を同期できませんでした。")
            : "価格を同期できませんでした。",
        );
      const success = result as { synced: boolean; ingredient: Ingredient; reason?: string };
      setItems((current) =>
        current.map((item) => (item.id === success.ingredient.id ? success.ingredient : item)),
      );
      setNotice(
        success.synced
          ? "Inventia の価格を同期しました。"
          : "品目を紐付けましたが、価格記録はありません。",
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "価格を同期できませんでした。");
    } finally {
      setBusyId("");
    }
  }
  async function readStock(ingredient: Ingredient) {
    setBusyId(ingredient.id);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/ingredients/${encodeURIComponent(ingredient.id)}/stock`);
      const body: unknown = await response.json();
      if (!response.ok) throw new Error(errorMessageFrom(body, "在庫を取得できませんでした。"));
      const result = stockResultResponseSchema.parse(body);
      setStock((current) => ({ ...current, [ingredient.id]: result }));
      if (!result.found)
        setNotice("Inventia の検索結果に紐付け品目が見つからないため、在庫を表示できません。");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "在庫を取得できませんでした。");
    } finally {
      setBusyId("");
    }
  }
  async function consumeStock(ingredient: Ingredient) {
    const amount = Number(stockAmount[ingredient.id] ?? "");
    if (!Number.isInteger(amount) || amount <= 0) {
      setError("消費量は1以上の整数で入力してください。");
      return;
    }
    const requestKey = stockRequestKeys[ingredient.id] ?? crypto.randomUUID();
    setStockRequestKeys((current) => ({ ...current, [ingredient.id]: requestKey }));
    setBusyId(ingredient.id);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/ingredients/${encodeURIComponent(ingredient.id)}/stock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, idempotencyKey: requestKey }),
      });
      const body: unknown = await response.json();
      if (!response.ok) throw new Error(errorMessageFrom(body, "在庫を消費できませんでした。"));
      const result = stockAdjustResponseSchema.parse(body);
      const baseUnit = stock[ingredient.id]?.baseUnit ?? ingredient.baseUnit;
      setStock((current) => ({
        ...current,
        [ingredient.id]: {
          found: true,
          currentQuantity: result.currentQuantity,
          baseUnit,
        },
      }));
      setStockAmount((current) => ({ ...current, [ingredient.id]: "" }));
      setStockRequestKeys((current) => {
        const next = { ...current };
        delete next[ingredient.id];
        return next;
      });
      setNotice(`在庫を消費しました。残り ${result.currentQuantity} ${baseUnit}。`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "在庫を消費できませんでした。");
    } finally {
      setBusyId("");
    }
  }
  function addMicro() {
    setField("micronutrients", [
      ...form.micronutrients,
      { key: "", label: "", amount: 0, unit: "mg" },
    ]);
  }
  function updateMicro(index: number, key: keyof Micro, value: string) {
    setField(
      "micronutrients",
      form.micronutrients.map((micro, i) =>
        i === index
          ? ({ ...micro, [key]: key === "amount" ? Number(value) : value } as Micro)
          : micro,
      ),
    );
  }

  return (
    <Page>
      <PageHeader
        title="材料"
        actions={
          <Button colorPalette="red" onClick={newIngredient}>
            材料を追加
          </Button>
        }
      />
      {error ? (
        <Feedback tone="error" role="alert" ariaLive="assertive">
          {error}
        </Feedback>
      ) : null}
      {notice ? (
        <Feedback tone="status" role="status" ariaLive="polite">
          {notice}
        </Feedback>
      ) : null}
      <Section label="材料一覧" divided={false}>
        <Box maxW="sm">
          <FormField label="材料を検索" htmlFor="ingredient-search">
            <Input
              id="ingredient-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </FormField>
        </Box>
        {loading ? (
          <Feedback tone="status" role="status" ariaLive="polite">
            材料を読み込み中…
          </Feedback>
        ) : visible.length === 0 ? (
          <Feedback tone="status" role="status">
            {items.length ? "検索結果がありません。" : "材料はまだ登録されていません。"}
          </Feedback>
        ) : (
          <List>
            {visible.map((item) => (
              <ListItem key={item.id}>
                <Stack
                  direction={{ base: "column", sm: "row" }}
                  justify="space-between"
                  align={{ base: "stretch", sm: "flex-start" }}
                  gap="3"
                >
                  <Box minW="0">
                    <Text as="h2" textStyle="heading.sm">
                      {item.name}
                    </Text>
                    <Text textStyle="caption">
                      基準: {item.nutritionBasisAmount} {item.baseUnit} · {item.baseDimension}
                      {item.gramPerUnit !== null ? ` · 1単位 ${item.gramPerUnit} g` : ""}
                    </Text>
                  </Box>
                  <Button variant="outline" onClick={() => startEdit(item)}>
                    編集
                  </Button>
                </Stack>
                <Text textStyle="body.sm">
                  <NutritionLine nutrition={item.nutritionPerBasis} />
                </Text>
                {item.nutritionPerBasis.micronutrients.length ? (
                  <Text textStyle="caption">
                    {item.nutritionPerBasis.micronutrients
                      .map((micro) => `${micro.label} ${micro.amount} ${micro.unit}`)
                      .join(" · ")}
                  </Text>
                ) : null}
                <Text textStyle="caption">
                  最新価格:{" "}
                  {item.latestUnitPriceYen === null ? (
                    "未取得"
                  ) : (
                    <Numeric size="sm">¥{item.latestUnitPriceYen}</Numeric>
                  )}{" "}
                  ·{" "}
                  {item.latestPriceUpdatedAt ? (
                    <Numeric size="sm">
                      {new Date(item.latestPriceUpdatedAt).toLocaleString("ja-JP")}
                    </Numeric>
                  ) : (
                    "更新日時なし"
                  )}{" "}
                  · Inventia ID: {item.inventiaItemId ?? "未連携"}
                </Text>
                {item.inventiaItemId ? (
                  <Stack as="section" aria-label={`${item.name} の在庫`} gap="2">
                    <Text textStyle="caption">
                      在庫:{" "}
                      {stock[item.id]
                        ? stock[item.id].found
                          ? `${stock[item.id].currentQuantity ?? "—"} ${stock[item.id].baseUnit ?? item.baseUnit}`
                          : "取得できません（検索結果に紐付け品目なし）"
                        : "未取得"}
                    </Text>
                    <Stack
                      direction={{ base: "column", sm: "row" }}
                      gap="2"
                      align={{ base: "stretch", sm: "end" }}
                    >
                      <Button
                        variant="outline"
                        onClick={() => void readStock(item)}
                        loading={busyId === item.id}
                      >
                        在庫を確認
                      </Button>
                      <FormField label={`消費量（${stock[item.id]?.baseUnit ?? item.baseUnit}）`}>
                        <Input
                          type="number"
                          min="1"
                          step="1"
                          inputMode="numeric"
                          value={stockAmount[item.id] ?? ""}
                          onChange={(event) => {
                            setStockAmount((current) => ({
                              ...current,
                              [item.id]: event.target.value,
                            }));
                            setStockRequestKeys((current) => {
                              const next = { ...current };
                              delete next[item.id];
                              return next;
                            });
                          }}
                        />
                      </FormField>
                      <Button
                        variant="outline"
                        onClick={() => void consumeStock(item)}
                        loading={busyId === item.id}
                      >
                        在庫を消費
                      </Button>
                    </Stack>
                  </Stack>
                ) : null}
                <chakra.form onSubmit={searchInventia}>
                  <Stack
                    direction={{ base: "column", sm: "row" }}
                    gap="2"
                    align={{ base: "stretch", sm: "end" }}
                  >
                    <FormField label="Inventia 品目検索" htmlFor={`inventia-query-${item.id}`}>
                      <Input
                        id={`inventia-query-${item.id}`}
                        value={inventiaQuery}
                        onChange={(event) => setInventiaQuery(event.target.value)}
                        placeholder={item.name}
                      />
                    </FormField>
                    <Button type="submit" variant="outline">
                      品目を検索
                    </Button>
                  </Stack>
                </chakra.form>
                {matches.length ? (
                  <Stack
                    direction={{ base: "column", sm: "row" }}
                    gap="2"
                    align={{ base: "stretch", sm: "end" }}
                  >
                    <FormField label="検索結果から選択" htmlFor={`inventia-match-${item.id}`}>
                      <SelectControl
                        id={`inventia-match-${item.id}`}
                        value={selectedMatch}
                        onChange={(event) => setSelectedMatch(event.target.value)}
                      >
                        <option value="">品目を選択</option>
                        {matches.map((match) => (
                          <option key={match.id} value={match.id}>
                            {match.name} · {match.baseUnit} · 在庫 {match.currentQuantity}
                          </option>
                        ))}
                      </SelectControl>
                    </FormField>
                    <Button
                      colorPalette="red"
                      onClick={() => void syncInventia(item)}
                      disabled={!selectedMatch}
                      loading={busyId === item.id}
                    >
                      価格を同期
                    </Button>
                  </Stack>
                ) : null}
                {item.memo ? <Text textStyle="caption">メモ: {item.memo}</Text> : null}
              </ListItem>
            ))}
          </List>
        )}
      </Section>
      <Section title={editing ? "材料を編集" : "材料を登録"} label="材料の登録・編集">
        <chakra.form onSubmit={save}>
          <Stack gap="5">
            <FormField label="材料名" htmlFor="ingredient-name">
              <Input
                id="ingredient-name"
                required
                maxLength={120}
                value={form.name}
                onChange={(e) => setField("name", e.target.value)}
              />
            </FormField>
            <Stack direction={{ base: "column", sm: "row" }} gap="4">
              <FormField label="次元" htmlFor="dimension">
                <SelectControl
                  id="dimension"
                  value={form.baseDimension}
                  onChange={(e) => {
                    const dimension = e.target.value as Dimension;
                    setForm((current) => ({
                      ...current,
                      baseDimension: dimension,
                      baseUnit: dimension === "mass" ? "g" : dimension === "volume" ? "mL" : "個",
                      nutritionBasisAmount: dimension === "count" ? "1" : "100",
                    }));
                    setMatches([]);
                    setSelectedMatch("");
                  }}
                >
                  <option value="mass">質量</option>
                  <option value="volume">体積</option>
                  <option value="count">個数</option>
                </SelectControl>
              </FormField>
              <FormField label="基準単位" htmlFor="base-unit">
                <Input
                  id="base-unit"
                  required
                  maxLength={50}
                  value={form.baseUnit}
                  onChange={(e) => setField("baseUnit", e.target.value)}
                  readOnly={form.baseDimension !== "count"}
                />
              </FormField>
              <FormField label="栄養価の基準量" htmlFor="basis">
                <Input id="basis" type="number" value={form.nutritionBasisAmount} readOnly />
              </FormField>
              <FormField label="1単位あたりのグラム数（任意）" htmlFor="gram-unit">
                <Input
                  id="gram-unit"
                  type="number"
                  min="0.001"
                  step="any"
                  value={form.gramPerUnit}
                  onChange={(e) => setField("gramPerUnit", e.target.value)}
                />
              </FormField>
            </Stack>
            <Section level={3} title="基準量あたりの栄養価">
              <Button
                type="button"
                variant="outline"
                alignSelf="flex-start"
                onClick={() => void estimate()}
                loading={estimating}
              >
                AI で栄養価を推定
              </Button>
              <Stack direction={{ base: "column", sm: "row" }} gap="4" flexWrap="wrap">
                {(
                  [
                    ["caloriesKcal", "エネルギー (kcal)"],
                    ["proteinG", "たんぱく質 (g)"],
                    ["fatG", "脂質 (g)"],
                    ["carbohydrateG", "炭水化物 (g)"],
                    ["fiberG", "食物繊維 (g)"],
                    ["saltEquivalentG", "食塩相当量 (g)"],
                  ] as const
                ).map(([key, label]) => (
                  <FormField key={key} label={label} htmlFor={`nutrition-${key}`}>
                    <Input
                      id={`nutrition-${key}`}
                      type="number"
                      min="0"
                      step="any"
                      value={form[key]}
                      onChange={(e) => setField(key, e.target.value)}
                    />
                  </FormField>
                ))}
              </Stack>
              <Stack gap="3">
                <Stack
                  direction={{ base: "column", sm: "row" }}
                  align={{ base: "stretch", sm: "center" }}
                  justify="space-between"
                >
                  <Text textStyle="label">微量栄養素</Text>
                  <Button type="button" variant="outline" onClick={addMicro}>
                    項目を追加
                  </Button>
                </Stack>
                <List>
                  {form.micronutrients.map((micro, index) => (
                    <ListItem layout="row" key={`${index}-${micro.key}`}>
                      <FormField label="キー" htmlFor={`micro-key-${index}`}>
                        <Input
                          id={`micro-key-${index}`}
                          value={micro.key}
                          onChange={(e) => updateMicro(index, "key", e.target.value)}
                          required
                        />
                      </FormField>
                      <FormField label="表示名" htmlFor={`micro-label-${index}`}>
                        <Input
                          id={`micro-label-${index}`}
                          value={micro.label}
                          onChange={(e) => updateMicro(index, "label", e.target.value)}
                          required
                        />
                      </FormField>
                      <FormField label="量" htmlFor={`micro-amount-${index}`}>
                        <Input
                          id={`micro-amount-${index}`}
                          type="number"
                          min="0"
                          step="any"
                          value={micro.amount}
                          onChange={(e) => updateMicro(index, "amount", e.target.value)}
                          required
                        />
                      </FormField>
                      <FormField label="単位" htmlFor={`micro-unit-${index}`}>
                        <SelectControl
                          id={`micro-unit-${index}`}
                          value={micro.unit}
                          onChange={(e) => updateMicro(index, "unit", e.target.value)}
                        >
                          <option value="g">g</option>
                          <option value="mg">mg</option>
                          <option value="ug">µg</option>
                          <option value="kcal">kcal</option>
                        </SelectControl>
                      </FormField>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                          setField(
                            "micronutrients",
                            form.micronutrients.filter((_, i) => i !== index),
                          )
                        }
                      >
                        削除
                      </Button>
                    </ListItem>
                  ))}
                </List>
              </Stack>
            </Section>
            <FormField label="メモ" htmlFor="ingredient-memo">
              <Textarea
                id="ingredient-memo"
                maxLength={2000}
                value={form.memo}
                onChange={(e) => setField("memo", e.target.value)}
              />
            </FormField>
            <Stack direction={{ base: "column", sm: "row" }} gap="3">
              <Button type="submit" colorPalette="red" loading={saving}>
                保存
              </Button>
              {editing ? (
                <Button type="button" variant="outline" onClick={newIngredient}>
                  新しい材料
                </Button>
              ) : null}
            </Stack>
          </Stack>
        </chakra.form>
      </Section>
    </Page>
  );
}
