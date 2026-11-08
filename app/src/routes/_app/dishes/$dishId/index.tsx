import {
  Box,
  Button,
  Checkbox,
  chakra,
  Field,
  Input,
  Stack,
  Text,
  Textarea,
  useSlotRecipe,
} from "@chakra-ui/react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Feedback } from "../../../../components/ui/feedback";
import { List, ListItem } from "../../../../components/ui/list";
import { NumberField } from "../../../../components/ui/number-field";
import { Numeric } from "../../../../components/ui/numeric";
import { Page, PageHeader } from "../../../../components/ui/page";
import { Section } from "../../../../components/ui/section";
import { StatBar } from "../../../../components/ui/stat-bar";
import { errorMessageFrom } from "../../../../lib/api-error";
import { ganttChart } from "../../../../../theme/slot-recipes/gantt-chart";
import type { Dish, Ingredient } from "../../../../domain/ingredient";
import {
  calculateIngredientCost,
  calculateIngredientNutrition,
} from "../../../../domain/ingredient";
import { sumNutritionFacts, type NutritionFacts } from "../../../../domain/nutrition";
import type { RecipeJson, RecipeStep } from "../../../../domain/recipe";

export const Route = createFileRoute("/_app/dishes/$dishId/")({
  staticData: { breadcrumbs: [{ label: "レシピ詳細" }] },
  component: DishDetailPage,
});
type Bar = {
  stepId: string;
  stepNumber: number;
  title: string;
  laneId: string;
  laneLabel: string;
  startSec: number;
  activeEndSec: number;
  endSec: number;
  dependsOnStepIds: string[];
  inputsSummary: string[];
  outputLabel: string | null;
  isCriticalPath: boolean;
};
type Schedule = {
  totalDurationSec: number;
  serialDurationSec: number;
  savedDurationSec: number;
  lanes: { id: string; label: string }[];
  bars: Bar[];
};
type GanttProps = { recipe: RecipeJson; schedule: Schedule };
type Detail = { dish: Dish; schedule: Schedule };
const fmt = (value: number | null | undefined, digits = 1) =>
  value == null ? "—" : value.toLocaleString("ja-JP", { maximumFractionDigits: digits });
const yen = (value: number | null | undefined) =>
  value == null ? "—" : `¥${Math.round(value).toLocaleString("ja-JP")}`;
async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => undefined);
    throw new Error(errorMessageFrom(body, `通信に失敗しました (${response.status})`));
  }
  return response.status === 204 ? (undefined as T) : (response.json() as Promise<T>);
}
function duration(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
}
function sumFacts(facts: (NutritionFacts | null)[]): NutritionFacts | null {
  return facts.some((fact) => fact === null) ? null : sumNutritionFacts(facts as NutritionFacts[]);
}
function DishDetailPage() {
  const { dishId } = Route.useParams();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<Detail | null>(null),
    [master, setMaster] = useState<Ingredient[]>([]),
    [servings, setServings] = useState(1),
    [view, setView] = useState<"gantt" | "list">("gantt"),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [editing, setEditing] = useState(false),
    [name, setName] = useState(""),
    [category, setCategory] = useState(""),
    [notes, setNotes] = useState("");
  const [completedStepIds, setCompletedStepIds] = useState<string[]>([]);
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [data, ingredients] = await Promise.all([
        api<Detail>(`/api/dishes/${encodeURIComponent(dishId)}`),
        api<Ingredient[]>("/api/ingredients"),
      ]);
      setDetail(data);
      setMaster(ingredients);
      setServings(data.dish.servings);
      setName(data.dish.name);
      setCategory(data.dish.category ?? "");
      setNotes(data.dish.notes ?? "");
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "レシピを読み込めませんでした。");
    } finally {
      setLoading(false);
    }
  }, [dishId]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  const ingredientById = useMemo(() => new Map(master.map((item) => [item.id, item])), [master]);
  if (loading)
    return (
      <Page>
        <Feedback tone="status" role="status">
          レシピを読み込み中…
        </Feedback>
      </Page>
    );
  if (!detail)
    return (
      <Page>
        <Feedback tone="error" role="alert">
          {error || "レシピが見つかりません。"}
        </Feedback>
        <Link to="/dishes">
          <Button variant="outline" alignSelf="start">
            レシピ一覧
          </Button>
        </Link>
      </Page>
    );
  const { dish, schedule } = detail;
  const scale = servings / dish.servings;
  const entryData = dish.recipe.ingredients.map((entry) => {
    const ingredient = ingredientById.get(entry.ingredientId);
    const amount = entry.amount * scale;
    return {
      entry,
      ingredient,
      amount,
      nutrition: ingredient ? calculateIngredientNutrition(ingredient, amount) : null,
      cost: ingredient ? calculateIngredientCost(ingredient, amount) : null,
    };
  });
  const totalNutrition = sumFacts(entryData.map((entry) => entry.nutrition));
  const totalCost = entryData.some((entry) => entry.cost === null)
    ? null
    : entryData.reduce((sum, entry) => sum + (entry.cost ?? 0), 0);
  function displayEntryAmount(entry: RecipeJson["ingredients"][number], amount: number) {
    const factor = entry.amount > 0 ? amount / entry.amount : scale;
    if (Math.abs(factor - 1) < 1e-9) return entry.displayAmount;
    const scaled = entry.displayAmount.replace(/\d+(?:\.\d+)?/g, (token) =>
      String(Number((Number(token) * factor).toFixed(2))),
    );
    return scaled !== entry.displayAmount ? scaled : `${fmt(amount)} ${entry.unit}`;
  }
  function inputLabel(input: RecipeStep["inputs"][number]) {
    if (input.type === "ingredient") {
      const entry = dish.recipe.ingredients.find((x) => x.id === input.ingredientEntryId);
      if (!entry) return input.ingredientEntryId;
      const amount = entry.amount * scale * input.amountRatio;
      const splitNote = input.amountText ? ` · ${input.amountText}` : "";
      return `${entry.name} ${displayEntryAmount(entry, amount)}${input.amountRatio < 1 ? ` (${fmt(input.amountRatio * 100, 0)}%)` : ""}${splitNote}`;
    }
    if (input.type === "group") {
      const group = dish.recipe.ingredientGroups.find((x) => x.id === input.groupId);
      return group
        ? `${group.symbol} ${group.label}（${group.ingredientEntryIds
            .map((id) => {
              const entry = dish.recipe.ingredients.find((candidate) => candidate.id === id);
              return entry
                ? `${entry.name} ${displayEntryAmount(entry, entry.amount * scale)}`
                : id;
            })
            .join("・")}）`
        : input.groupId;
    }
    const source = dish.recipe.steps.find((x) => x.id === input.fromStepId);
    return `← Step ${source?.stepNumber ?? "?"}: ${source?.outputs.find((x) => x.id === input.outputId)?.label ?? input.outputId}`;
  }
  function ingredientUsages(entry: RecipeJson["ingredients"][number]) {
    return dish.recipe.steps.flatMap((step) =>
      step.inputs.flatMap((input) => {
        if (input.type === "ingredient" && input.ingredientEntryId === entry.id)
          return [
            {
              step,
              amount: entry.amount * scale * input.amountRatio,
              amountText: input.amountText,
            },
          ];
        if (
          input.type === "group" &&
          dish.recipe.ingredientGroups
            .find((group) => group.id === input.groupId)
            ?.ingredientEntryIds.includes(entry.id)
        )
          return [{ step, amount: entry.amount * scale, amountText: null }];
        return [];
      }),
    );
  }
  async function saveMeta(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api<Dish>(`/api/dishes/${encodeURIComponent(dish.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          category: category.trim() || null,
          notes: notes || null,
        }),
      });
      setEditing(false);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "変更を保存できませんでした。");
    } finally {
      setBusy(false);
    }
  }
  async function deleteDish() {
    if (!window.confirm(`「${dish.name}」を削除しますか？`)) return;
    setBusy(true);
    try {
      await api(`/api/dishes/${encodeURIComponent(dish.id)}`, { method: "DELETE" });
      await navigate({ to: "/dishes" });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "レシピを削除できませんでした。");
      setBusy(false);
    }
  }
  const ingredientSections = [
    ...(dish.recipe.ingredients.some((entry) => !entry.groupId)
      ? [
          {
            key: "__ungrouped",
            label: null,
            entries: dish.recipe.ingredients.filter((entry) => !entry.groupId),
          },
        ]
      : []),
    ...dish.recipe.ingredientGroups
      .map((group) => ({
        key: group.id,
        label: `${group.symbol} ${group.label}`,
        entries: dish.recipe.ingredients.filter((entry) => entry.groupId === group.id),
      }))
      .filter((section) => section.entries.length > 0),
  ];
  const mealUrl = `/?dishId=${encodeURIComponent(dish.id)}&servings=${servings}`;
  return (
    <Page>
      <Link to="/dishes">レシピ一覧</Link>
      <PageHeader
        title={dish.name}
        actions={
          <>
            <Link to="/dishes/new" search={{ dishId: dish.id }}>
              <Button variant="outline">レシピを編集</Button>
            </Link>
            <Button variant="outline" onClick={() => setEditing((v) => !v)}>
              {editing ? "編集を閉じる" : "情報を編集"}
            </Button>
            <Button variant="outline" onClick={() => void deleteDish()} loading={busy}>
              削除
            </Button>
            <a href={mealUrl}>
              <Button colorPalette="red">食事記録に追加</Button>
            </a>
          </>
        }
      />
      <Text textStyle="caption">
        {dish.category ?? "カテゴリなし"} · レシピ基準 {dish.servings}人前 ·{" "}
        {schedule.totalDurationSec ? duration(schedule.totalDurationSec) : "時間未設定"}
      </Text>
      {error ? (
        <Feedback tone="error" role="alert">
          {error}{" "}
          <Button variant="outline" onClick={() => void refresh()}>
            再読み込み
          </Button>
        </Feedback>
      ) : null}
      {editing ? (
        <Section title="レシピ情報を編集">
          <Box as="form" onSubmit={saveMeta}>
            <Stack gap="3">
              <Stack direction={{ base: "column", md: "row" }} gap="3">
                <Field.Root>
                  <Field.Label>料理名</Field.Label>
                  <Input
                    required
                    maxLength={120}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </Field.Root>
                <Field.Root>
                  <Field.Label>カテゴリ</Field.Label>
                  <Input
                    maxLength={64}
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  />
                </Field.Root>
              </Stack>
              <Field.Root>
                <Field.Label>メモ</Field.Label>
                <Textarea
                  maxLength={4000}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </Field.Root>
              <Button type="submit" colorPalette="red" alignSelf="start" loading={busy}>
                変更を保存
              </Button>
            </Stack>
          </Box>
        </Section>
      ) : null}
      <Section label="人前・栄養価・原価">
        <Stack
          direction={{ base: "column", sm: "row" }}
          align={{ base: "stretch", sm: "end" }}
          gap="3"
        >
          <Box minW="10rem">
            <NumberField
              label="表示人前数"
              value={String(servings)}
              min={1}
              max={100}
              step={1}
              onChange={(value) => setServings(Math.min(100, Math.max(1, Number(value) || 1)))}
            />
          </Box>
          <Text textStyle="caption">数量はこの画面と食事記録の追加に反映されます。</Text>
        </Stack>
        <StatBar
          items={[
            {
              label: "原価",
              value: (
                <Numeric size="lg" tone="strong">
                  {yen(totalCost)}
                </Numeric>
              ),
              note: (
                <>
                  1人前{" "}
                  <Numeric size="sm" tone="muted">
                    {yen(totalCost === null ? null : totalCost / servings)}
                  </Numeric>
                </>
              ),
            },
            {
              label: "エネルギー",
              value: totalNutrition ? (
                <>
                  <Numeric size="lg" tone="strong">
                    {fmt(totalNutrition.caloriesKcal)}
                  </Numeric>
                  <Box as="span">kcal</Box>
                </>
              ) : (
                "—"
              ),
              note: totalNutrition ? (
                <>
                  1人前{" "}
                  <Numeric size="sm" tone="muted">
                    {fmt(totalNutrition.caloriesKcal / servings)}
                  </Numeric>{" "}
                  kcal
                </>
              ) : (
                "1人前 —"
              ),
            },
            {
              label: "P / F / C",
              value: totalNutrition ? (
                <>
                  <Box as="span">
                    P{" "}
                    <Numeric size="lg" tone="strong">
                      {fmt(totalNutrition.proteinG)}
                    </Numeric>{" "}
                    g
                  </Box>
                  <Box as="span">
                    F{" "}
                    <Numeric size="lg" tone="strong">
                      {fmt(totalNutrition.fatG)}
                    </Numeric>{" "}
                    g
                  </Box>
                  <Box as="span">
                    C{" "}
                    <Numeric size="lg" tone="strong">
                      {fmt(totalNutrition.carbohydrateG)}
                    </Numeric>{" "}
                    g
                  </Box>
                </>
              ) : (
                "—"
              ),
              note: totalNutrition ? (
                <>
                  1人前 P{" "}
                  <Numeric size="sm" tone="muted">
                    {fmt(totalNutrition.proteinG / servings)}
                  </Numeric>{" "}
                  g / F{" "}
                  <Numeric size="sm" tone="muted">
                    {fmt(totalNutrition.fatG / servings)}
                  </Numeric>{" "}
                  g / C{" "}
                  <Numeric size="sm" tone="muted">
                    {fmt(totalNutrition.carbohydrateG / servings)}
                  </Numeric>{" "}
                  g
                </>
              ) : (
                "1人前 —"
              ),
            },
            {
              label: "食物繊維 / 食塩",
              value: totalNutrition ? (
                <>
                  <Box as="span">
                    <Numeric size="lg" tone="strong">
                      {fmt(totalNutrition.fiberG)}
                    </Numeric>{" "}
                    g /{" "}
                    <Numeric size="lg" tone="strong">
                      {fmt(totalNutrition.saltEquivalentG)}
                    </Numeric>{" "}
                    g
                  </Box>
                </>
              ) : (
                "—"
              ),
              note: totalNutrition ? (
                <>
                  1人前{" "}
                  <Numeric size="sm" tone="muted">
                    {fmt(totalNutrition.fiberG === null ? null : totalNutrition.fiberG / servings)}
                  </Numeric>{" "}
                  g /{" "}
                  <Numeric size="sm" tone="muted">
                    {fmt(
                      totalNutrition.saltEquivalentG === null
                        ? null
                        : totalNutrition.saltEquivalentG / servings,
                    )}
                  </Numeric>{" "}
                  g
                </>
              ) : (
                "1人前 —"
              ),
            },
          ]}
        />
      </Section>
      <Box
        display="grid"
        gridTemplateColumns={{ base: "1fr", lg: "minmax(0, 5fr) minmax(0, 7fr)" }}
        gap="8"
        alignItems="start"
      >
        <Stack gap="7">
          <Section title="材料" label="材料と栄養・原価内訳">
            <Stack gap="4">
              {ingredientSections.map((section) => (
                <Box key={section.key}>
                  {section.label ? (
                    <Text as="h3" textStyle="heading.xs">
                      {section.label}
                    </Text>
                  ) : null}
                  <List>
                    {section.entries.map((entry) => {
                      const data = entryData.find((item) => item.entry.id === entry.id)!;
                      const usages = ingredientUsages(entry);
                      return (
                        <ListItem layout="row" key={entry.id}>
                          <Box minW="0">
                            <Text textStyle="label">
                              {entry.name} · {displayEntryAmount(entry, data.amount)}
                            </Text>
                            <Text textStyle="caption">
                              {entry.prepNote ? `下ごしらえ: ${entry.prepNote} · ` : ""}
                              {data.nutrition
                                ? `${fmt(data.nutrition.caloriesKcal)} kcal · P ${fmt(data.nutrition.proteinG)}g / F ${fmt(data.nutrition.fatG)}g / C ${fmt(data.nutrition.carbohydrateG)}g`
                                : "栄養価未計算"}{" "}
                              · 原価 {yen(data.cost)}
                            </Text>
                          </Box>
                          <Stack gap="1" aria-label={`${entry.name} の手順別使用量`}>
                            <Text textStyle="label">手順別の使用</Text>
                            {usages.length ? (
                              usages.map((usage, index) => (
                                <Text textStyle="body.sm" key={`${usage.step.id}-${index}`}>
                                  <a href={`#${usage.step.id}`}>Step {usage.step.stepNumber}</a>:{" "}
                                  {displayEntryAmount(entry, usage.amount)}
                                  {usage.amountText ? ` · ${usage.amountText}` : ""}
                                </Text>
                              ))
                            ) : (
                              <Text textStyle="body.sm">未指定</Text>
                            )}
                          </Stack>
                        </ListItem>
                      );
                    })}
                  </List>
                </Box>
              ))}
            </Stack>
          </Section>
        </Stack>
        <Section
          label="調理手順スケジュール"
          title={
            <>
              調理手順 · {duration(schedule.totalDurationSec)}（直列{" "}
              {duration(schedule.serialDurationSec)} / 短縮 {duration(schedule.savedDurationSec)}）
            </>
          }
          actions={
            <Stack direction="row" aria-label="手順表示" gap="2">
              <Button
                variant={view === "gantt" ? "outline" : "ghost"}
                aria-pressed={view === "gantt"}
                onClick={() => setView("gantt")}
              >
                ガント
              </Button>
              <Button
                variant={view === "list" ? "outline" : "ghost"}
                aria-pressed={view === "list"}
                onClick={() => setView("list")}
              >
                リスト
              </Button>
            </Stack>
          }
        >
          {view === "gantt" ? <Gantt recipe={dish.recipe} schedule={schedule} /> : null}
          <Box style={{ display: view === "list" ? "flex" : "none" }}>
            <List divided={false}>
              {dish.recipe.steps.map((step) => {
                const bar = schedule.bars.find((item) => item.stepId === step.id);
                const completed = completedStepIds.includes(step.id);
                return (
                  <Box as="div" id={step.id} key={step.id}>
                    <ListItem>
                      <Stack gap="2">
                        <Stack
                          direction={{ base: "column", sm: "row" }}
                          justify="space-between"
                          align={{ base: "stretch", sm: "center" }}
                        >
                          <Text as="h3" textStyle="heading.xs">
                            Step {step.stepNumber} · {step.title}
                          </Text>
                          <Stack direction="row" align="center" gap="4">
                            <Text textStyle="body.sm">
                              作業 {duration(step.timing.activeDurationSec)} · 待機{" "}
                              {duration(step.timing.passiveDurationSec)}
                              {step.heatLevel !== "none" ? ` · 火加減 ${step.heatLevel}` : ""}
                            </Text>
                            <Checkbox.Root
                              checked={completed}
                              onCheckedChange={(details) =>
                                setCompletedStepIds((current) =>
                                  details.checked
                                    ? [...current, step.id]
                                    : current.filter((id) => id !== step.id),
                                )
                              }
                            >
                              <Checkbox.HiddenInput />
                              <Checkbox.Control />
                              <Checkbox.Label>完了</Checkbox.Label>
                            </Checkbox.Root>
                          </Stack>
                        </Stack>
                        <Text>{step.instruction}</Text>
                        {step.inputs.length ? (
                          <Text textStyle="body.sm">
                            <strong>投入:</strong>{" "}
                            {step.inputs.map((input) => inputLabel(input)).join(" · ")}
                          </Text>
                        ) : null}
                        {step.outputs.length ? (
                          <Text textStyle="body.sm">
                            <strong>生成:</strong>{" "}
                            {step.outputs.map((output) => output.label).join(" · ")}
                          </Text>
                        ) : null}
                        {step.completionCue ? (
                          <Text textStyle="body.sm">
                            <strong>完了の目安:</strong> {step.completionCue}
                          </Text>
                        ) : null}
                        {step.cautions.map((caution) => (
                          <Text key={caution.id} textStyle="caution">
                            <strong>{caution.title}:</strong> {caution.description}
                          </Text>
                        ))}
                        {step.resourceTags.length ? (
                          <Text textStyle="caption">器具: {step.resourceTags.join(" · ")}</Text>
                        ) : null}
                        {step.dependsOnStepIds.length ? (
                          <Text textStyle="caption">
                            前提:{" "}
                            {step.dependsOnStepIds
                              .map((id) => {
                                const dependency = dish.recipe.steps.find((item) => item.id === id);
                                return `Step ${dependency?.stepNumber ?? "?"} ${dependency?.title ?? ""}`;
                              })
                              .join(" · ")}
                            （先行手順の終了後に開始）
                          </Text>
                        ) : null}
                        {bar ? (
                          <Text textStyle="caption">
                            予定 {duration(bar.startSec)}–{duration(bar.endSec)}
                            {bar.isCriticalPath ? " · クリティカルパス" : ""}
                          </Text>
                        ) : null}
                      </Stack>
                    </ListItem>
                  </Box>
                );
              })}
            </List>
          </Box>
        </Section>
      </Box>
    </Page>
  );
}
function Gantt(props: GanttProps) {
  const { recipe, schedule } = props;
  const chart = useSlotRecipe({ recipe: ganttChart });
  const styles = chart();
  const width = 960;
  const left = 150;
  const right = 58;
  const laneHeader = 26;
  const row = 46;
  const top = 24;
  const plotWidth = width - left - right;
  const total = Math.max(schedule.totalDurationSec, 1);
  const px = plotWidth / total;
  const laneRows = schedule.lanes
    .map((lane) => ({ lane, bars: schedule.bars.filter((bar) => bar.laneId === lane.id) }))
    .filter((entry) => entry.bars.length > 0);
  const laneTop = new Map<string, number>();
  const barTop = new Map<string, { laneTop: number; index: number }>();
  let cursor = top;
  for (const { lane, bars } of laneRows) {
    laneTop.set(lane.id, cursor);
    bars.forEach((bar, index) => barTop.set(bar.stepId, { laneTop: cursor, index }));
    cursor += laneHeader + bars.length * row;
  }
  const height = Math.max(120, cursor + 12);
  const tickStep =
    [10, 15, 30, 60, 120, 180, 300, 600, 900, 1800, 3600].find((step) => total / step <= 10) ??
    3600;
  const ticks = Array.from(
    { length: Math.floor(total / tickStep) + 1 },
    (_, index) => index * tickStep,
  );
  const barY = (stepId: string) => {
    const position = barTop.get(stepId);
    return position
      ? position.laneTop + laneHeader + position.index * row + 8
      : top + laneHeader + 8;
  };
  const barEnd = (stepId: string, endSec: number) => ({
    x: left + endSec * px,
    y: barY(stepId) + 8,
  });

  return (
    <Box
      role="img"
      aria-label="並列調理ガントチャート。実線は作業、点線枠は待機。矢印は依存関係。"
      css={styles.root}
    >
      <chakra.svg
        width="100%"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMinYMin meet"
        css={styles.canvas}
      >
        <defs>
          <marker
            id="dependency-arrow"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <chakra.path d="M 0 0 L 10 5 L 0 10 z" css={styles.arrowHead} />
          </marker>
        </defs>
        {ticks.map((second) => (
          <g key={second}>
            <chakra.line
              x1={left + second * px}
              x2={left + second * px}
              y1={top - 4}
              y2={height}
              css={styles.gridLine}
            />
            <chakra.text x={left + second * px + 3} y={top - 10} css={styles.axisLabel}>
              {duration(second)}
            </chakra.text>
          </g>
        ))}
        {laneRows.map(({ lane }) => {
          const y = laneTop.get(lane.id) ?? top;
          return (
            <g key={lane.id}>
              <chakra.text x="4" y={y + 16} css={styles.rowLabel}>
                {lane.label}
              </chakra.text>
              <chakra.line x1="4" x2={width - 4} y1={y} y2={y} css={styles.rowLine} />
            </g>
          );
        })}
        {schedule.bars.map((bar) => {
          const step = recipe.steps.find((candidate) => candidate.id === bar.stepId);
          if (!step) return null;
          const y = barY(bar.stepId);
          const activeWidth = Math.max(0, (bar.activeEndSec - bar.startSec) * px);
          const passiveWidth = Math.max(0, (bar.endSec - bar.activeEndSec) * px);
          const startX = left + bar.startSec * px;
          const endX = left + bar.endSec * px;
          const summary = bar.inputsSummary.join(" · ");
          const summaryChars = Math.max(0, Math.floor((width - 6 - startX) / 5.4));
          return (
            <g key={bar.stepId}>
              <title>
                {`Step ${bar.stepNumber} ${bar.title}\n投入: ${summary || "—"}\n予定 ${duration(bar.startSec)}–${duration(bar.endSec)}`}
              </title>
              <chakra.text x="4" y={y + 12} css={styles.rowLabel}>
                {`Step ${bar.stepNumber} ${bar.title}`.slice(0, 24)}
              </chakra.text>
              {bar.dependsOnStepIds.map((dependencyId) => {
                const dependency = schedule.bars.find(
                  (candidate) => candidate.stepId === dependencyId,
                );
                if (!dependency) return null;
                const from = barEnd(dependency.stepId, dependency.endSec);
                const to = { x: startX, y: y + 8 };
                return (
                  <chakra.path
                    key={dependencyId}
                    d={`M ${from.x} ${from.y} H ${Math.max(from.x + 8, to.x - 8)} V ${to.y} H ${to.x}`}
                    css={styles.arrow}
                    markerEnd="url(#dependency-arrow)"
                  />
                );
              })}
              {activeWidth > 0 ? (
                <chakra.rect x={startX} y={y} width={activeWidth} height="16" css={styles.bar} />
              ) : null}
              {passiveWidth > 0 ? (
                <chakra.rect
                  x={left + bar.activeEndSec * px}
                  y={y}
                  width={passiveWidth}
                  height="16"
                  css={styles.waitBar}
                />
              ) : null}
              <chakra.text x={endX + 3} y={y + 12} css={styles.endLabel}>
                {duration(bar.endSec)}
              </chakra.text>
              {summary && summaryChars > 6 ? (
                <chakra.text x={startX} y={y + 30} css={styles.endLabel}>
                  {summary.length > summaryChars
                    ? `${summary.slice(0, summaryChars - 1)}…`
                    : summary}
                </chakra.text>
              ) : null}
            </g>
          );
        })}
      </chakra.svg>
      <Box css={styles.legend}>
        <Box as="span">
          <Box as="span" css={styles.swatch} /> 作業時間
        </Box>
        <Box as="span">
          <Box as="span" css={styles.swatchOutline} /> 待機・放置
        </Box>
        <Box as="span">矢印: 前提ステップの完了から開始</Box>
      </Box>
    </Box>
  );
}
