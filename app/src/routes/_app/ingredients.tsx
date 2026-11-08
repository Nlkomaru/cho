import { Box, Button, Heading, Input, Stack, Text } from "@chakra-ui/react";
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";

export const Route = createFileRoute("/_app/ingredients")({
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
    if (
      !selected ||
      selected.baseDimension !== ingredient.baseDimension ||
      selected.baseUnit !== ingredient.baseUnit
    ) {
      setError("材料と同じ次元・単位の Inventia 品目を選択してください。");
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
    <Stack as="main" w="full" maxW="6xl" gap="7" px={{ base: "4", md: "8" }} py="8">
      <Stack
        direction={{ base: "column", sm: "row" }}
        align={{ base: "stretch", sm: "center" }}
        justify="space-between"
        gap="3"
      >
        <Heading as="h1" color="fg.subtle" fontSize="2xl" fontWeight="600">
          材料
        </Heading>
        <Button colorPalette="red" onClick={newIngredient}>
          材料を追加
        </Button>
      </Stack>
      {error ? (
        <Text role="alert" aria-live="assertive" color="red.fg">
          {error}
        </Text>
      ) : null}
      {notice ? (
        <Text role="status" aria-live="polite">
          {notice}
        </Text>
      ) : null}
      <Stack as="section" aria-label="材料一覧" gap="4">
        <Stack gap="1">
          <Text as="label" htmlFor="ingredient-search" fontSize="sm" fontWeight="600">
            材料を検索
          </Text>
          <Input
            id="ingredient-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </Stack>
        {loading ? (
          <Text role="status" aria-live="polite">
            材料を読み込み中…
          </Text>
        ) : visible.length === 0 ? (
          <Text role="status">
            {items.length ? "検索結果がありません。" : "材料はまだ登録されていません。"}
          </Text>
        ) : (
          <Stack
            as="ul"
            gap="0"
            listStyle="none"
            m="0"
            p="0"
            borderTopWidth="1px"
            borderColor="border"
          >
            {visible.map((item) => (
              <Box as="li" key={item.id} borderBottomWidth="1px" borderColor="border" py="4">
                <Stack gap="3">
                  <Stack
                    direction={{ base: "column", sm: "row" }}
                    justify="space-between"
                    align={{ base: "stretch", sm: "flex-start" }}
                    gap="3"
                  >
                    <Box minW="0">
                      <Heading as="h2" fontSize="lg" fontWeight="600" overflowWrap="anywhere">
                        {item.name}
                      </Heading>
                      <Text color="fg.muted" fontSize="sm">
                        基準: {item.nutritionBasisAmount} {item.baseUnit} · {item.baseDimension}
                        {item.gramPerUnit !== null ? ` · 1単位 ${item.gramPerUnit} g` : ""}
                      </Text>
                    </Box>
                    <Button variant="outline" onClick={() => startEdit(item)}>
                      編集
                    </Button>
                  </Stack>
                  <Text fontSize="sm" color="fg">
                    {item.nutritionPerBasis.caloriesKcal} kcal · P {item.nutritionPerBasis.proteinG}{" "}
                    g · F {item.nutritionPerBasis.fatG} g · C {item.nutritionPerBasis.carbohydrateG}{" "}
                    g · 食物繊維 {item.nutritionPerBasis.fiberG ?? "—"} g · 食塩{" "}
                    {item.nutritionPerBasis.saltEquivalentG ?? "—"} g
                  </Text>
                  {item.nutritionPerBasis.micronutrients.length ? (
                    <Text fontSize="sm" color="fg.muted">
                      {item.nutritionPerBasis.micronutrients
                        .map((micro) => `${micro.label} ${micro.amount} ${micro.unit}`)
                        .join(" · ")}
                    </Text>
                  ) : null}
                  <Text fontSize="sm" color="fg.muted">
                    最新価格:{" "}
                    {item.latestUnitPriceYen === null ? "未取得" : `¥${item.latestUnitPriceYen}`} ·{" "}
                    {item.latestPriceUpdatedAt
                      ? new Date(item.latestPriceUpdatedAt).toLocaleString()
                      : "更新日時なし"}{" "}
                    · Inventia ID: {item.inventiaItemId ?? "未連携"}
                  </Text>
                  <Stack
                    as="form"
                    onSubmit={searchInventia}
                    direction={{ base: "column", sm: "row" }}
                    gap="2"
                    align={{ base: "stretch", sm: "end" }}
                  >
                    <Box flex="1">
                      <Text as="label" htmlFor={`inventia-query-${item.id}`} fontSize="sm">
                        Inventia 品目検索
                      </Text>
                      <Input
                        id={`inventia-query-${item.id}`}
                        value={inventiaQuery}
                        onChange={(event) => setInventiaQuery(event.target.value)}
                        placeholder={item.name}
                      />
                    </Box>
                    <Button type="submit" variant="outline">
                      品目を検索
                    </Button>
                  </Stack>
                  {matches.length ? (
                    <Stack
                      direction={{ base: "column", sm: "row" }}
                      gap="2"
                      align={{ base: "stretch", sm: "end" }}
                    >
                      <Box flex="1">
                        <Text as="label" htmlFor={`inventia-match-${item.id}`} fontSize="sm">
                          検索結果から選択
                        </Text>
                        <select
                          id={`inventia-match-${item.id}`}
                          value={selectedMatch}
                          onChange={(event) => setSelectedMatch(event.target.value)}
                          style={{
                            width: "100%",
                            minHeight: "40px",
                            border: "1px solid #d4d4d8",
                            padding: "8px",
                            background: "white",
                          }}
                        >
                          <option value="">品目を選択</option>
                          {matches.map((match) => (
                            <option key={match.id} value={match.id}>
                              {match.name} · {match.baseUnit} · 在庫 {match.currentQuantity}
                            </option>
                          ))}
                        </select>
                      </Box>
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
                  {item.memo ? (
                    <Text fontSize="sm" color="fg.muted">
                      メモ: {item.memo}
                    </Text>
                  ) : null}
                </Stack>
              </Box>
            ))}
          </Stack>
        )}
      </Stack>
      <Box
        as="section"
        aria-labelledby="ingredient-form-heading"
        borderTopWidth="1px"
        borderColor="border"
        pt="6"
      >
        <Heading id="ingredient-form-heading" as="h2" fontSize="xl" fontWeight="600" mb="5">
          {editing ? "材料を編集" : "材料を登録"}
        </Heading>
        <Box as="form" onSubmit={save}>
          <Stack gap="5">
            <Field label="材料名" id="ingredient-name">
              <Input
                id="ingredient-name"
                required
                maxLength={120}
                value={form.name}
                onChange={(e) => setField("name", e.target.value)}
              />
            </Field>
            <Stack direction={{ base: "column", sm: "row" }} gap="4">
              <Field label="次元" id="dimension">
                <select
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
                  style={selectStyle}
                >
                  <option value="mass">質量</option>
                  <option value="volume">体積</option>
                  <option value="count">個数</option>
                </select>
              </Field>
              <Field label="基準単位" id="base-unit">
                <Input
                  id="base-unit"
                  required
                  maxLength={50}
                  value={form.baseUnit}
                  onChange={(e) => setField("baseUnit", e.target.value)}
                  readOnly={form.baseDimension !== "count"}
                />
              </Field>
              <Field label="栄養価の基準量" id="basis">
                <Input id="basis" type="number" value={form.nutritionBasisAmount} readOnly />
              </Field>
              <Field label="1単位あたりのグラム数（任意）" id="gram-unit">
                <Input
                  id="gram-unit"
                  type="number"
                  min="0.001"
                  step="any"
                  value={form.gramPerUnit}
                  onChange={(e) => setField("gramPerUnit", e.target.value)}
                />
              </Field>
            </Stack>
            <Stack
              as="section"
              aria-labelledby="nutrition-heading"
              gap="3"
              borderTopWidth="1px"
              borderColor="border"
              pt="4"
            >
              <Heading id="nutrition-heading" as="h3" fontSize="md" fontWeight="600">
                基準量あたりの栄養価
              </Heading>
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
                  <Field key={key} label={label} id={`nutrition-${key}`}>
                    <Input
                      id={`nutrition-${key}`}
                      type="number"
                      min="0"
                      step="any"
                      value={form[key]}
                      onChange={(e) => setField(key, e.target.value)}
                    />
                  </Field>
                ))}
              </Stack>
              <Stack gap="3">
                <Stack
                  direction={{ base: "column", sm: "row" }}
                  align={{ base: "stretch", sm: "center" }}
                  justify="space-between"
                >
                  <Text fontWeight="600">微量栄養素</Text>
                  <Button type="button" variant="outline" onClick={addMicro}>
                    項目を追加
                  </Button>
                </Stack>
                {form.micronutrients.map((micro, index) => (
                  <Stack
                    key={`${index}-${micro.key}`}
                    direction={{ base: "column", md: "row" }}
                    gap="3"
                    align={{ base: "stretch", md: "end" }}
                    borderBottomWidth="1px"
                    borderColor="border"
                    pb="3"
                  >
                    <Field label="キー" id={`micro-key-${index}`}>
                      <Input
                        id={`micro-key-${index}`}
                        value={micro.key}
                        onChange={(e) => updateMicro(index, "key", e.target.value)}
                        required
                      />
                    </Field>
                    <Field label="表示名" id={`micro-label-${index}`}>
                      <Input
                        id={`micro-label-${index}`}
                        value={micro.label}
                        onChange={(e) => updateMicro(index, "label", e.target.value)}
                        required
                      />
                    </Field>
                    <Field label="量" id={`micro-amount-${index}`}>
                      <Input
                        id={`micro-amount-${index}`}
                        type="number"
                        min="0"
                        step="any"
                        value={micro.amount}
                        onChange={(e) => updateMicro(index, "amount", e.target.value)}
                        required
                      />
                    </Field>
                    <Field label="単位" id={`micro-unit-${index}`}>
                      <select
                        id={`micro-unit-${index}`}
                        value={micro.unit}
                        onChange={(e) => updateMicro(index, "unit", e.target.value)}
                        style={selectStyle}
                      >
                        <option value="g">g</option>
                        <option value="mg">mg</option>
                        <option value="ug">µg</option>
                        <option value="kcal">kcal</option>
                      </select>
                    </Field>
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
                  </Stack>
                ))}
              </Stack>
            </Stack>
            <Field label="メモ" id="ingredient-memo">
              <textarea
                id="ingredient-memo"
                maxLength={2000}
                value={form.memo}
                onChange={(e) => setField("memo", e.target.value)}
                style={{ ...selectStyle, minHeight: "88px", resize: "vertical" }}
              />
            </Field>
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
        </Box>
      </Box>
    </Stack>
  );
}

const selectStyle: React.CSSProperties = {
  width: "100%",
  minHeight: "40px",
  border: "1px solid #d4d4d8",
  padding: "8px",
  background: "white",
};
function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <Stack gap="1" flex="1" minW={{ base: "0", sm: "10rem" }}>
      <Text as="label" htmlFor={id} fontSize="sm" fontWeight="600">
        {label}
      </Text>
      {children}
    </Stack>
  );
}
