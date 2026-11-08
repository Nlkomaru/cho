import { Box, Button, Input, Stack, Text, Textarea } from "@chakra-ui/react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { Feedback } from "../../../../components/ui/feedback";
import { ListItem } from "../../../../components/ui/list";
import { Page, PageHeader } from "../../../../components/ui/page";
import { Section } from "../../../../components/ui/section";
import { FormField } from "../../-components/form-field";
import { SelectControl } from "../../-components/select-control";
import { errorMessageFrom } from "../../../../lib/api-error";
import type { Ingredient, Dish } from "../../../../domain/ingredient";
import { recipeSchema, type RecipeJson, type RecipeStep } from "../../../../domain/recipe";
import { validateRecipeDag } from "../../../../domain/recipe-scheduler";

export const Route = createFileRoute("/_app/dishes/new/")({
  validateSearch: (search: Record<string, unknown>) => ({
    dishId: typeof search.dishId === "string" ? search.dishId : undefined,
  }),
  staticData: { breadcrumbs: [{ label: "レシピ作成" }] },
  component: NewDishPage,
});
const blankRecipe = (): RecipeJson => ({
  schemaVersion: "1.0",
  servings: 2,
  summary: null,
  equipment: [],
  ingredientGroups: [],
  ingredients: [],
  steps: [],
  globalCautions: [],
});
const makeId = (prefix: string) => `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => undefined);
    throw new Error(errorMessageFrom(body, `通信に失敗しました (${response.status})`));
  }
  return response.status === 204 ? (undefined as T) : (response.json() as Promise<T>);
}
const emptyStep = (number: number): RecipeStep => ({
  id: makeId("step"),
  stepNumber: number,
  phase: "prep",
  title: "",
  instruction: "",
  executionMode: "active",
  timing: {
    activeDurationSec: 60,
    passiveDurationSec: 0,
    minTotalDurationSec: null,
    maxTotalDurationSec: null,
    scalingMode: "fixed",
    timerLabel: null,
  },
  dependsOnStepIds: [],
  resourceTags: [],
  heatLevel: "none",
  targetTempCelsius: null,
  inputs: [],
  outputs: [],
  completionCue: null,
  cautions: [],
});
function NewDishPage() {
  const navigate = useNavigate();
  const { dishId } = Route.useSearch();
  const [ingredients, setIngredients] = useState<Ingredient[]>([]),
    [name, setName] = useState(""),
    [category, setCategory] = useState(""),
    [servings, setServings] = useState("2"),
    [recipe, setRecipe] = useState<RecipeJson>(blankRecipe),
    [rawText, setRawText] = useState(""),
    [selectedIngredient, setSelectedIngredient] = useState(""),
    [entryAmount, setEntryAmount] = useState(""),
    [entryUnit, setEntryUnit] = useState(""),
    [displayAmount, setDisplayAmount] = useState(""),
    [groupId, setGroupId] = useState(""),
    [groupSymbol, setGroupSymbol] = useState<RecipeJson["ingredientGroups"][number]["symbol"]>("★"),
    [groupLabel, setGroupLabel] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  useEffect(() => {
    let live = true;
    void Promise.all([
      api<Ingredient[]>("/api/ingredients"),
      dishId
        ? api<{ dish: Dish }>(`/api/dishes/${encodeURIComponent(dishId)}`)
        : Promise.resolve(null),
    ])
      .then(([items, detail]) => {
        if (!live) return;
        setIngredients(items);
        if (detail) {
          const dish = detail.dish;
          setName(dish.name);
          setCategory(dish.category ?? "");
          setServings(String(dish.servings));
          setRecipe(dish.recipe);
        }
      })
      .catch((cause) => {
        if (live)
          setError(cause instanceof Error ? cause.message : "レシピ情報を読み込めませんでした。");
      });
    return () => {
      live = false;
    };
  }, [dishId]);
  function changeRecipe(update: (current: RecipeJson) => RecipeJson) {
    setRecipe((current) => update(current));
  }
  function addEntry() {
    const ingredient = ingredients.find((item) => item.id === selectedIngredient);
    const amount = Number(entryAmount);
    const selectedGroup = recipe.ingredientGroups.some((group) => group.id === groupId)
      ? groupId
      : "";
    if (
      !ingredient ||
      !Number.isFinite(amount) ||
      amount <= 0 ||
      !displayAmount.trim() ||
      entryUnit !== ingredient.baseUnit
    ) {
      setError("材料、基準単位の量、表示用の分量を入力してください。");
      return;
    }
    const id = makeId("ing");
    changeRecipe((current) => ({
      ...current,
      ingredients: [
        ...current.ingredients,
        {
          id,
          ingredientId: ingredient.id,
          name: ingredient.name,
          amount,
          unit: entryUnit,
          displayAmount: displayAmount.trim(),
          role: "main",
          groupId: selectedGroup || null,
          prepNote: null,
        },
      ],
      ingredientGroups: current.ingredientGroups.map((group) =>
        group.id === selectedGroup
          ? { ...group, ingredientEntryIds: [...group.ingredientEntryIds, id] }
          : group,
      ),
    }));
    setSelectedIngredient("");
    setEntryAmount("");
    setEntryUnit("");
    setDisplayAmount("");
    setError("");
  }
  function updateCaution(index: number, patch: Partial<RecipeStep["cautions"][number]>) {
    changeRecipe((current) => ({
      ...current,
      steps: current.steps.map((step, i) => {
        if (i !== index) return step;
        const currentCaution = step.cautions[0] ?? {
          id: makeId("caution"),
          category: "quality" as const,
          severity: "warning" as const,
          title: "注意",
          description: "",
          triggerCondition: null,
        };
        return { ...step, cautions: [{ ...currentCaution, ...patch }] };
      }),
    }));
  }
  function updateGlobalCaution(
    index: number,
    patch: Partial<RecipeJson["globalCautions"][number]>,
  ) {
    changeRecipe((current) => ({
      ...current,
      globalCautions: current.globalCautions.map((caution, i) =>
        i === index ? { ...caution, ...patch } : caution,
      ),
    }));
  }
  function updateEntry(id: string, patch: Partial<RecipeJson["ingredients"][number]>) {
    changeRecipe((current) => {
      const entries = current.ingredients.map((entry) =>
        entry.id === id ? { ...entry, ...patch } : entry,
      );
      const groups = current.ingredientGroups.map((group) => ({
        ...group,
        ingredientEntryIds: entries
          .filter((entry) => entry.groupId === group.id)
          .map((entry) => entry.id),
      }));
      const activeIds = new Set(
        groups.filter((group) => group.ingredientEntryIds.length).map((group) => group.id),
      );
      return {
        ...current,
        ingredients: entries,
        ingredientGroups: groups.filter((group) => activeIds.has(group.id)),
        steps: current.steps.map((step) => ({
          ...step,
          inputs: step.inputs.filter(
            (input) => input.type !== "group" || activeIds.has(input.groupId),
          ),
        })),
      };
    });
  }
  function updateStep(index: number, patch: Partial<RecipeStep>) {
    changeRecipe((current) => ({
      ...current,
      steps: current.steps.map((step, i) => (i === index ? { ...step, ...patch } : step)),
    }));
  }
  function addGroup() {
    if (!groupLabel.trim()) {
      setError("グループ名を入力してください。");
      return;
    }
    const group = {
      id: makeId("grp"),
      symbol: groupSymbol,
      label: groupLabel.trim(),
      ingredientEntryIds: [] as string[],
    };
    changeRecipe((current) => ({
      ...current,
      ingredientGroups: [...current.ingredientGroups, group],
    }));
    setGroupId(group.id);
    setGroupLabel("");
    setError("");
  }
  function addStep() {
    changeRecipe((current) => ({
      ...current,
      steps: [...current.steps, emptyStep(current.steps.length + 1)],
    }));
  }
  async function structure() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (!name.trim() || !recipe.ingredients.length || !rawText.trim())
        throw new Error("料理名、登録材料、レシピ本文を入力してください。");
      const entries = recipe.ingredients.map((entry) => ({ ...entry }));
      const result = await api<RecipeJson>("/api/ai/structure-recipe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dishName: name.trim(),
          ingredients: entries,
          rawStepsText: rawText.trim(),
        }),
      });
      const checked = recipeSchema.safeParse({
        ...result,
        servings: Number(servings),
        ingredients: entries,
      });
      if (!checked.success)
        throw new Error(
          checked.error.issues
            .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
            .join("\n"),
        );
      setRecipe(checked.data);
      setNotice(
        "AI が作成した手順を確認・編集してください。保存前に材料と依存関係を確認できます。",
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "手順を構造化できませんでした。");
    } finally {
      setBusy(false);
    }
  }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const parsed = recipeSchema.safeParse({
        ...recipe,
        servings: Number(servings),
        ingredientGroups: recipe.ingredientGroups.filter(
          (group) => group.ingredientEntryIds.length > 0,
        ),
      });
      if (!parsed.success)
        throw new Error(
          parsed.error.issues
            .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
            .join("\n"),
        );
      const dag = validateRecipeDag(parsed.data);
      if (!dag.success) throw new Error(dag.errors.join("\n"));
      const common = {
        name: name.trim(),
        category: category.trim() || null,
        servings: Number(servings),
        recipe: parsed.data,
      };
      const payload = dishId ? common : { ...common, coverImageId: null, notes: null };
      const dish = await api<Dish>(
        dishId ? `/api/dishes/${encodeURIComponent(dishId)}` : "/api/dishes",
        {
          method: dishId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      await navigate({ to: "/dishes/$dishId", params: { dishId: dish.id } });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "レシピを保存できませんでした。");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Page>
      <PageHeader
        title={dishId ? "レシピ編集" : "レシピ作成"}
        actions={
          <Link to="/dishes">
            <Button variant="outline">一覧へ戻る</Button>
          </Link>
        }
      />
      {error ? (
        <Feedback tone="error" role="alert">
          {error}
        </Feedback>
      ) : null}
      {notice ? (
        <Feedback tone="status" role="status">
          {notice}
        </Feedback>
      ) : null}
      <Box as="form" onSubmit={save}>
        <Stack gap="7">
          <Section label="レシピ情報">
            <Stack direction={{ base: "column", sm: "row" }} gap="4">
              <FormField label="料理名">
                <Input
                  required
                  maxLength={120}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </FormField>
              <FormField label="カテゴリ">
                <Input
                  maxLength={64}
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                />
              </FormField>
              <FormField label="人前">
                <Input
                  type="number"
                  min="1"
                  max="100"
                  step="1"
                  required
                  value={servings}
                  onChange={(e) => {
                    setServings(e.target.value);
                    changeRecipe((r) => ({ ...r, servings: Number(e.target.value) || 1 }));
                  }}
                />
              </FormField>
            </Stack>
            <FormField label="レシピの概要">
              <Textarea
                maxLength={500}
                value={recipe.summary ?? ""}
                onChange={(e) => changeRecipe((r) => ({ ...r, summary: e.target.value || null }))}
              />
            </FormField>
            <FormField label="器具（カンマ区切り）">
              <Input
                value={recipe.equipment.join(", ")}
                onChange={(e) =>
                  changeRecipe((r) => ({
                    ...r,
                    equipment: e.target.value
                      .split(",")
                      .map((value) => value.trim())
                      .filter(Boolean),
                  }))
                }
                placeholder="フライパン, 包丁, ボウル"
              />
            </FormField>
          </Section>
          <Section title="材料・グループ" label="材料とグループ">
            <Stack
              direction={{ base: "column", md: "row" }}
              align={{ base: "stretch", md: "end" }}
              gap="3"
            >
              <FormField label="登録済み材料">
                <SelectControl
                  value={selectedIngredient}
                  onChange={(e) => {
                    const item = ingredients.find((candidate) => candidate.id === e.target.value);
                    setSelectedIngredient(e.target.value);
                    setEntryUnit(item?.baseUnit ?? "");
                  }}
                >
                  <option value="">材料を選択</option>
                  {ingredients.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} ({item.baseUnit})
                    </option>
                  ))}
                </SelectControl>
              </FormField>
              <FormField label="基準単位量">
                <Input
                  type="number"
                  min="0.001"
                  step="any"
                  value={entryAmount}
                  onChange={(e) => setEntryAmount(e.target.value)}
                />
              </FormField>
              <FormField label="単位（材料マスタ）">
                <Input readOnly value={entryUnit} />
              </FormField>
              <FormField label="表示する分量">
                <Input
                  placeholder="大さじ1 (15mL)"
                  value={displayAmount}
                  onChange={(e) => setDisplayAmount(e.target.value)}
                />
              </FormField>
              <FormField label="所属グループ">
                <SelectControl value={groupId} onChange={(e) => setGroupId(e.target.value)}>
                  <option value="">グループなし</option>
                  {recipe.ingredientGroups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.symbol} {group.label}
                    </option>
                  ))}
                </SelectControl>
              </FormField>
              <Button type="button" variant="outline" onClick={addEntry}>
                材料を追加
              </Button>
            </Stack>
            <Stack
              direction={{ base: "column", sm: "row" }}
              align={{ base: "stretch", sm: "end" }}
              gap="3"
            >
              <FormField label="グループ記号">
                <SelectControl
                  value={groupSymbol}
                  onChange={(e) => setGroupSymbol(e.target.value as typeof groupSymbol)}
                >
                  {["★", "☆", "◎", "●", "▲", "A", "B", "C"].map((symbol) => (
                    <option key={symbol} value={symbol}>
                      {symbol}
                    </option>
                  ))}
                </SelectControl>
              </FormField>
              <FormField label="グループ名">
                <Input
                  maxLength={64}
                  value={groupLabel}
                  onChange={(e) => setGroupLabel(e.target.value)}
                  placeholder="合わせ調味料、下味など"
                />
              </FormField>
              <Button type="button" variant="outline" onClick={addGroup}>
                グループを追加
              </Button>
            </Stack>
            {recipe.ingredients.map((entry, i) => (
              <ListItem layout="row" key={entry.id}>
                <Text textStyle="numeric.sm">
                  {entry.groupId
                    ? `${recipe.ingredientGroups.find((g) => g.id === entry.groupId)?.symbol ?? ""} `
                    : ""}
                  {entry.name} · {entry.displayAmount} ({entry.amount} {entry.unit})
                </Text>
                <Stack direction="row" gap="2">
                  <Input
                    aria-label={`${entry.name} 下ごしらえメモ`}
                    placeholder="下ごしらえメモ"
                    maxLength={120}
                    value={entry.prepNote ?? ""}
                    onChange={(e) =>
                      changeRecipe((r) => ({
                        ...r,
                        ingredients: r.ingredients.map((x, ix) =>
                          ix === i ? { ...x, prepNote: e.target.value || null } : x,
                        ),
                      }))
                    }
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      changeRecipe((r) => ({
                        ...r,
                        ingredients: r.ingredients.filter((x) => x.id !== entry.id),
                        ingredientGroups: r.ingredientGroups.map((g) => ({
                          ...g,
                          ingredientEntryIds: g.ingredientEntryIds.filter((id) => id !== entry.id),
                        })),
                        steps: r.steps.map((s) => ({
                          ...s,
                          inputs: s.inputs.filter(
                            (input) =>
                              input.type !== "ingredient" || input.ingredientEntryId !== entry.id,
                          ),
                        })),
                      }))
                    }
                  >
                    削除
                  </Button>
                </Stack>
              </ListItem>
            ))}
          </Section>
          {recipe.ingredients.length ? (
            <Section title="材料の分量・表示・単位を編集" label="材料エントリー編集" level={3}>
              {recipe.ingredients.map((entry) => (
                <Stack
                  key={entry.id}
                  direction={{ base: "column", md: "row" }}
                  gap="3"
                  align={{ base: "stretch", md: "end" }}
                >
                  <Text textStyle="label" minW={{ md: "10rem" }}>
                    {entry.name}
                  </Text>
                  <FormField label="基準量">
                    <Input
                      type="number"
                      min="0.001"
                      step="any"
                      value={entry.amount}
                      onChange={(e) => updateEntry(entry.id, { amount: Number(e.target.value) })}
                    />
                  </FormField>
                  <FormField label="単位（材料マスタ）">
                    <Input readOnly value={entry.unit} />
                  </FormField>
                  <FormField label="表示分量">
                    <Input
                      maxLength={64}
                      value={entry.displayAmount}
                      onChange={(e) => updateEntry(entry.id, { displayAmount: e.target.value })}
                    />
                  </FormField>
                  <FormField label="グループ">
                    <SelectControl
                      value={entry.groupId ?? ""}
                      onChange={(e) => updateEntry(entry.id, { groupId: e.target.value || null })}
                    >
                      <option value="">グループなし</option>
                      {recipe.ingredientGroups.map((group) => (
                        <option key={group.id} value={group.id}>
                          {group.symbol} {group.label}
                        </option>
                      ))}
                    </SelectControl>
                  </FormField>
                  <FormField label="役割">
                    <SelectControl
                      value={entry.role}
                      onChange={(e) =>
                        updateEntry(entry.id, {
                          role: e.target.value as RecipeJson["ingredients"][number]["role"],
                        })
                      }
                    >
                      {[
                        ["main", "主材料"],
                        ["seasoning", "調味料"],
                        ["topping", "トッピング"],
                        ["optional", "任意"],
                      ].map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </SelectControl>
                  </FormField>
                </Stack>
              ))}
            </Section>
          ) : null}
          <Section title="手順を構造化" label="AIによる手順構造化">
            <FormField label="レシピ本文">
              <Textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder="調理手順をそのまま入力"
              />
            </FormField>
            <Button
              type="button"
              colorPalette="red"
              alignSelf="start"
              loading={busy}
              disabled={!ingredients.length}
              onClick={() => void structure()}
            >
              入力した材料と本文から AI で手順を作成
            </Button>
            <Text textStyle="caption">
              AI 出力は保存前に下の手順エディターで確認・修正できます。
            </Text>
          </Section>
          <Section
            title="手順 DAG"
            label="手順 DAG 編集"
            actions={
              <Button type="button" variant="outline" onClick={addStep}>
                手順を追加
              </Button>
            }
          >
            {recipe.steps.map((step, i) => (
              <ListItem key={step.id}>
                <Stack gap="3">
                  <Text as="h3" textStyle="heading.xs">
                    Step {i + 1}
                  </Text>
                  <Stack direction={{ base: "column", md: "row" }} gap="3">
                    <FormField label="工程">
                      <SelectControl
                        value={step.phase}
                        onChange={(e) =>
                          updateStep(i, { phase: e.target.value as RecipeStep["phase"] })
                        }
                      >
                        {[
                          ["prep", "下ごしらえ"],
                          ["cook", "加熱調理"],
                          ["assemble", "組み立て"],
                          ["finish", "仕上げ"],
                          ["cleanup", "片付け"],
                        ].map(([v, label]) => (
                          <option key={v} value={v}>
                            {label}
                          </option>
                        ))}
                      </SelectControl>
                    </FormField>
                    <FormField label="タイトル">
                      <Input
                        required
                        value={step.title}
                        onChange={(e) => updateStep(i, { title: e.target.value })}
                      />
                    </FormField>
                    <FormField label="実行">
                      <SelectControl
                        value={step.executionMode}
                        onChange={(e) =>
                          updateStep(i, {
                            executionMode: e.target.value as RecipeStep["executionMode"],
                          })
                        }
                      >
                        <option value="active">作業</option>
                        <option value="passive">待機</option>
                        <option value="mixed">作業＋待機</option>
                      </SelectControl>
                    </FormField>
                    <FormField label="作業秒">
                      <Input
                        type="number"
                        min="0"
                        max="86400"
                        value={step.timing.activeDurationSec}
                        onChange={(e) =>
                          updateStep(i, {
                            timing: { ...step.timing, activeDurationSec: Number(e.target.value) },
                          })
                        }
                      />
                    </FormField>
                    <FormField label="待機秒">
                      <Input
                        type="number"
                        min="0"
                        max="604800"
                        value={step.timing.passiveDurationSec}
                        onChange={(e) =>
                          updateStep(i, {
                            timing: { ...step.timing, passiveDurationSec: Number(e.target.value) },
                          })
                        }
                      />
                    </FormField>
                  </Stack>
                  <Stack direction={{ base: "column", md: "row" }} gap="3" wrap="wrap">
                    <FormField label="最小合計秒">
                      <Input
                        type="number"
                        min="0"
                        max="604800"
                        value={step.timing.minTotalDurationSec ?? ""}
                        onChange={(e) =>
                          updateStep(i, {
                            timing: {
                              ...step.timing,
                              minTotalDurationSec:
                                e.target.value === "" ? null : Number(e.target.value),
                            },
                          })
                        }
                      />
                    </FormField>
                    <FormField label="最大合計秒">
                      <Input
                        type="number"
                        min="0"
                        max="604800"
                        value={step.timing.maxTotalDurationSec ?? ""}
                        onChange={(e) =>
                          updateStep(i, {
                            timing: {
                              ...step.timing,
                              maxTotalDurationSec:
                                e.target.value === "" ? null : Number(e.target.value),
                            },
                          })
                        }
                      />
                    </FormField>
                    <FormField label="時間の伸縮">
                      <SelectControl
                        value={step.timing.scalingMode}
                        onChange={(e) =>
                          updateStep(i, {
                            timing: {
                              ...step.timing,
                              scalingMode: e.target.value as RecipeStep["timing"]["scalingMode"],
                            },
                          })
                        }
                      >
                        {[
                          ["fixed", "固定"],
                          ["linear", "比例"],
                          ["sublinear", "逓減"],
                        ].map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </SelectControl>
                    </FormField>
                    <FormField label="タイマー名">
                      <Input
                        maxLength={64}
                        value={step.timing.timerLabel ?? ""}
                        onChange={(e) =>
                          updateStep(i, {
                            timing: {
                              ...step.timing,
                              timerLabel: e.target.value || null,
                            },
                          })
                        }
                        placeholder="豚肉焼き"
                      />
                    </FormField>
                    <FormField label="目標温度（℃）">
                      <Input
                        type="number"
                        min="-50"
                        max="350"
                        step="any"
                        value={step.targetTempCelsius ?? ""}
                        onChange={(e) =>
                          updateStep(i, {
                            targetTempCelsius:
                              e.target.value === "" ? null : Number(e.target.value),
                          })
                        }
                      />
                    </FormField>
                  </Stack>
                  <FormField label="手順">
                    <Textarea
                      required
                      maxLength={2000}
                      value={step.instruction}
                      onChange={(e) => updateStep(i, { instruction: e.target.value })}
                    />
                  </FormField>
                  <Stack direction={{ base: "column", md: "row" }} gap="3">
                    <FormField label="依存する手順">
                      <SelectControl
                        multiple
                        aria-label={`Step ${i + 1} の先行手順`}
                        value={step.dependsOnStepIds}
                        onChange={(e) =>
                          updateStep(i, {
                            dependsOnStepIds: Array.from(e.target.selectedOptions, (o) => o.value),
                          })
                        }
                      >
                        {recipe.steps
                          .filter((other) => other.id !== step.id)
                          .map((other) => (
                            <option key={other.id} value={other.id}>
                              Step {other.stepNumber}: {other.title || "（未入力）"}
                            </option>
                          ))}
                      </SelectControl>
                    </FormField>
                    <FormField label="器具・資源タグ（カンマ区切り）">
                      <Input
                        value={step.resourceTags.join(", ")}
                        onChange={(e) =>
                          updateStep(i, {
                            resourceTags: e.target.value
                              .split(",")
                              .map((x) => x.trim())
                              .filter(Boolean),
                          })
                        }
                        placeholder="フライパン, コンロ"
                      />
                    </FormField>
                    <FormField label="火加減">
                      <SelectControl
                        value={step.heatLevel}
                        onChange={(e) =>
                          updateStep(i, { heatLevel: e.target.value as RecipeStep["heatLevel"] })
                        }
                      >
                        {[
                          ["none", "なし"],
                          ["low", "弱火"],
                          ["medium_low", "弱めの中火"],
                          ["medium", "中火"],
                          ["medium_high", "強めの中火"],
                          ["high", "強火"],
                          ["boil", "沸騰"],
                          ["simmer", "煮立てる"],
                        ].map(([v, label]) => (
                          <option key={v} value={v}>
                            {label}
                          </option>
                        ))}
                      </SelectControl>
                    </FormField>
                  </Stack>
                  <Stack gap="2">
                    <Text textStyle="label">投入材料（分割投入は割合と表記を調整）</Text>
                    {step.inputs
                      .filter((x) => x.type === "ingredient")
                      .map((input) => {
                        if (input.type !== "ingredient") return null;
                        const entry = recipe.ingredients.find(
                          (x) => x.id === input.ingredientEntryId,
                        );
                        return (
                          <Stack
                            key={input.ingredientEntryId}
                            direction={{ base: "column", sm: "row" }}
                            align="center"
                          >
                            <Text flex="1">{entry?.name ?? input.ingredientEntryId}</Text>
                            <Box w="110px">
                              <FormField label="割合">
                                <Input
                                  aria-label={`${entry?.name ?? "材料"} 使用割合`}
                                  type="number"
                                  min="0.01"
                                  max="1"
                                  step="0.01"
                                  value={input.amountRatio}
                                  onChange={(e) =>
                                    updateStep(i, {
                                      inputs: step.inputs.map((x) =>
                                        x === input
                                          ? { ...input, amountRatio: Number(e.target.value) }
                                          : x,
                                      ),
                                    })
                                  }
                                />
                              </FormField>
                            </Box>
                            <FormField label="分量表記">
                              <Input
                                aria-label={`${entry?.name ?? "材料"} 投入量表記`}
                                value={input.amountText ?? ""}
                                placeholder={entry?.displayAmount}
                                onChange={(e) =>
                                  updateStep(i, {
                                    inputs: step.inputs.map((x) =>
                                      x === input
                                        ? { ...input, amountText: e.target.value || null }
                                        : x,
                                    ),
                                  })
                                }
                              />
                            </FormField>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() =>
                                updateStep(i, { inputs: step.inputs.filter((x) => x !== input) })
                              }
                            >
                              外す
                            </Button>
                          </Stack>
                        );
                      })}
                    <Stack direction={{ base: "column", md: "row" }} gap="3">
                      <FormField label="投入する個別材料">
                        <SelectControl
                          multiple
                          value={step.inputs
                            .filter((x) => x.type === "ingredient")
                            .map((x) => x.ingredientEntryId)}
                          onChange={(e) => {
                            const ids = Array.from(e.target.selectedOptions, (o) => o.value);
                            const rest = step.inputs.filter((x) => x.type !== "ingredient");
                            updateStep(i, {
                              inputs: [
                                ...rest,
                                ...ids.map(
                                  (id) =>
                                    step.inputs.find(
                                      (x) => x.type === "ingredient" && x.ingredientEntryId === id,
                                    ) ?? {
                                      type: "ingredient" as const,
                                      ingredientEntryId: id,
                                      amountRatio: 1,
                                      amountText: null,
                                    },
                                ),
                              ],
                            });
                          }}
                        >
                          {recipe.ingredients.map((entry) => (
                            <option key={entry.id} value={entry.id}>
                              {entry.name} ({entry.displayAmount})
                            </option>
                          ))}
                        </SelectControl>
                      </FormField>
                      <FormField label="一括投入グループ">
                        <SelectControl
                          multiple
                          value={step.inputs
                            .filter((x) => x.type === "group")
                            .map((x) => x.groupId)}
                          onChange={(e) => {
                            const ids = Array.from(e.target.selectedOptions, (o) => o.value);
                            const old = step.inputs.filter((x) => x.type !== "group");
                            updateStep(i, {
                              inputs: [
                                ...old,
                                ...ids.map((id) => ({ type: "group" as const, groupId: id })),
                              ],
                            });
                          }}
                        >
                          {recipe.ingredientGroups
                            .filter((g) => g.ingredientEntryIds.length)
                            .map((group) => (
                              <option key={group.id} value={group.id}>
                                {group.symbol} {group.label}
                              </option>
                            ))}
                        </SelectControl>
                      </FormField>
                      <FormField label="生成物（名前を入力）">
                        <Input
                          value={step.outputs.map((x) => x.label).join(", ")}
                          onChange={(e) =>
                            updateStep(i, {
                              outputs: e.target.value
                                .split(",")
                                .map((label, index) => ({
                                  id: step.outputs[index]?.id ?? makeId("out"),
                                  label: label.trim(),
                                }))
                                .filter((x) => x.label),
                            })
                          }
                          placeholder="下味をつけた肉"
                        />
                      </FormField>
                    </Stack>
                  </Stack>
                  <FormField label="前の手順からの中間生成物">
                    <SelectControl
                      multiple
                      aria-label={`Step ${i + 1} の中間生成物`}
                      value={step.inputs
                        .filter((x) => x.type === "intermediate")
                        .map((x) => `${x.fromStepId}::${x.outputId}`)}
                      onChange={(e) => {
                        const selected = Array.from(
                          e.target.selectedOptions,
                          (option) => option.value,
                        );
                        const rest = step.inputs.filter((x) => x.type !== "intermediate");
                        const refs = selected.map((value) => {
                          const [fromStepId, outputId] = value.split("::");
                          return { type: "intermediate" as const, fromStepId, outputId };
                        });
                        updateStep(i, { inputs: [...rest, ...refs] });
                      }}
                    >
                      {" "}
                      {recipe.steps
                        .filter((other) => other.id !== step.id)
                        .flatMap((other) =>
                          other.outputs.map((output) => (
                            <option
                              key={`${other.id}::${output.id}`}
                              value={`${other.id}::${output.id}`}
                            >
                              Step {other.stepNumber}: {output.label}
                            </option>
                          )),
                        )}
                    </SelectControl>
                    <Text textStyle="caption">参照元を依存する手順にも選択してください。</Text>
                  </FormField>
                  <Stack gap="3">
                    <FormField label="完了の目安">
                      <Input
                        maxLength={300}
                        value={step.completionCue ?? ""}
                        onChange={(e) => updateStep(i, { completionCue: e.target.value || null })}
                      />
                    </FormField>
                    <Text textStyle="label">注意事項</Text>
                    <Stack direction={{ base: "column", md: "row" }} gap="3">
                      <FormField label="注意の種類">
                        <SelectControl
                          value={step.cautions[0]?.category ?? "quality"}
                          onChange={(e) =>
                            updateCaution(i, {
                              category: e.target
                                .value as RecipeStep["cautions"][number]["category"],
                            })
                          }
                        >
                          {[
                            ["safety", "安全"],
                            ["quality", "品質"],
                            ["timing", "タイミング"],
                            ["substitution", "代替"],
                            ["storage", "保存"],
                          ].map(([v, label]) => (
                            <option key={v} value={v}>
                              {label}
                            </option>
                          ))}
                        </SelectControl>
                      </FormField>
                      <FormField label="重大度">
                        <SelectControl
                          value={step.cautions[0]?.severity ?? "warning"}
                          onChange={(e) =>
                            updateCaution(i, {
                              severity: e.target
                                .value as RecipeStep["cautions"][number]["severity"],
                            })
                          }
                        >
                          {[
                            ["info", "情報"],
                            ["warning", "注意"],
                            ["critical", "重要"],
                          ].map(([v, label]) => (
                            <option key={v} value={v}>
                              {label}
                            </option>
                          ))}
                        </SelectControl>
                      </FormField>
                      <FormField label="タイトル">
                        <Input
                          maxLength={120}
                          value={step.cautions[0]?.title ?? ""}
                          onChange={(e) => updateCaution(i, { title: e.target.value })}
                        />
                      </FormField>
                      <FormField label="発生条件">
                        <Input
                          maxLength={200}
                          value={step.cautions[0]?.triggerCondition ?? ""}
                          onChange={(e) =>
                            updateCaution(i, { triggerCondition: e.target.value || null })
                          }
                        />
                      </FormField>
                    </Stack>
                    <FormField label="注意の説明">
                      <Textarea
                        maxLength={1000}
                        value={step.cautions[0]?.description ?? ""}
                        onChange={(e) =>
                          e.target.value
                            ? updateCaution(i, { description: e.target.value })
                            : updateStep(i, { cautions: [] })
                        }
                      />
                    </FormField>
                  </Stack>
                  <Button
                    type="button"
                    variant="outline"
                    alignSelf="end"
                    onClick={() =>
                      changeRecipe((r) => ({
                        ...r,
                        steps: r.steps
                          .filter((x) => x.id !== step.id)
                          .map((x, ix) => ({
                            ...x,
                            stepNumber: ix + 1,
                            dependsOnStepIds: x.dependsOnStepIds.filter((id) => id !== step.id),
                            inputs: x.inputs.filter(
                              (input) =>
                                input.type !== "intermediate" || input.fromStepId !== step.id,
                            ),
                          })),
                      }))
                    }
                  >
                    手順を削除
                  </Button>
                </Stack>
              </ListItem>
            ))}
          </Section>
          <Section
            title="全体の注意事項"
            label="レシピ全体の注意"
            actions={
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  changeRecipe((r) => ({
                    ...r,
                    globalCautions: [
                      ...r.globalCautions,
                      {
                        id: makeId("caution"),
                        category: "quality",
                        severity: "warning",
                        title: "注意",
                        description: "",
                        triggerCondition: null,
                      },
                    ],
                  }))
                }
              >
                注意を追加
              </Button>
            }
          >
            {recipe.globalCautions.map((caution, index) => (
              <Stack key={caution.id} gap="3" borderBottomWidth="1px" borderColor="border" py="3">
                <Stack direction={{ base: "column", md: "row" }} gap="3">
                  <FormField label="注意の種類">
                    <SelectControl
                      value={caution.category}
                      onChange={(e) =>
                        updateGlobalCaution(index, {
                          category: e.target
                            .value as RecipeJson["globalCautions"][number]["category"],
                        })
                      }
                    >
                      {[
                        ["safety", "安全"],
                        ["quality", "品質"],
                        ["timing", "タイミング"],
                        ["substitution", "代替"],
                        ["storage", "保存"],
                      ].map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </SelectControl>
                  </FormField>
                  <FormField label="重大度">
                    <SelectControl
                      value={caution.severity}
                      onChange={(e) =>
                        updateGlobalCaution(index, {
                          severity: e.target
                            .value as RecipeJson["globalCautions"][number]["severity"],
                        })
                      }
                    >
                      {[
                        ["info", "情報"],
                        ["warning", "注意"],
                        ["critical", "重要"],
                      ].map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </SelectControl>
                  </FormField>
                  <FormField label="タイトル">
                    <Input
                      required
                      maxLength={120}
                      value={caution.title}
                      onChange={(e) => updateGlobalCaution(index, { title: e.target.value })}
                    />
                  </FormField>
                  <FormField label="発生条件">
                    <Input
                      maxLength={200}
                      value={caution.triggerCondition ?? ""}
                      onChange={(e) =>
                        updateGlobalCaution(index, { triggerCondition: e.target.value || null })
                      }
                    />
                  </FormField>
                </Stack>
                <FormField label="説明">
                  <Textarea
                    required
                    maxLength={1000}
                    value={caution.description}
                    onChange={(e) => updateGlobalCaution(index, { description: e.target.value })}
                  />
                </FormField>
                <Button
                  type="button"
                  variant="outline"
                  alignSelf="end"
                  onClick={() =>
                    changeRecipe((r) => ({
                      ...r,
                      globalCautions: r.globalCautions.filter((_, i) => i !== index),
                    }))
                  }
                >
                  注意を削除
                </Button>
              </Stack>
            ))}
          </Section>
          <Stack direction={{ base: "column", sm: "row" }}>
            <Button type="submit" colorPalette="red" loading={busy}>
              {dishId ? "レシピを更新" : "レシピを保存"}
            </Button>
            <Link to="/dishes">
              <Button variant="outline">キャンセル</Button>
            </Link>
          </Stack>
        </Stack>
      </Box>
    </Page>
  );
}
