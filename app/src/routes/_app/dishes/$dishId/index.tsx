import { Box, Button, Heading, Input, Stack, Text } from "@chakra-ui/react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
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
const fmt = (value: number | null | undefined, digits = 1) =>
  value == null ? "—" : value.toLocaleString("ja-JP", { maximumFractionDigits: digits });
const yen = (value: number | null | undefined) =>
  value == null ? "—" : `¥${Math.round(value).toLocaleString("ja-JP")}`;
const inputStyle: React.CSSProperties = {
  width: "100%",
  minHeight: 40,
  border: "1px solid #d4d4d8",
  padding: 8,
  background: "white",
};
async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok)
    throw new Error(
      ((await response.json().catch(() => ({}))) as { error?: string }).error ??
        `通信に失敗しました (${response.status})`,
    );
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
      <Stack as="main" px="6" py="8">
        <Text role="status">レシピを読み込み中…</Text>
      </Stack>
    );
  if (!detail)
    return (
      <Stack as="main" px="6" py="8">
        <Text role="alert" color="red.fg">
          {error || "レシピが見つかりません。"}
        </Text>
        <Link to="/dishes">
          <Button variant="outline">レシピ一覧</Button>
        </Link>
      </Stack>
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
    return scale === 1 && amount === entry.amount
      ? entry.displayAmount
      : `${fmt(amount)} ${entry.unit}`;
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
  const mealUrl = `/?dishId=${encodeURIComponent(dish.id)}&servings=${servings}`;
  return (
    <Stack as="main" w="full" maxW="6xl" gap="7" px={{ base: "4", md: "8" }} py="8">
      <Stack
        direction={{ base: "column", sm: "row" }}
        align={{ base: "stretch", sm: "center" }}
        justify="space-between"
        gap="3"
      >
        <Box>
          <Link to="/dishes">レシピ一覧</Link>
          <Heading as="h1" fontSize="2xl" fontWeight="600" mt="2">
            {dish.name}
          </Heading>
          <Text color="fg.muted">
            {dish.category ?? "カテゴリなし"} · レシピ基準 {dish.servings}人前 ·{" "}
            {schedule.totalDurationSec ? duration(schedule.totalDurationSec) : "時間未設定"}
          </Text>
        </Box>
        <Stack direction="row" flexWrap="wrap">
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
        </Stack>
      </Stack>
      {error ? (
        <Text role="alert" color="red.fg" whiteSpace="pre-wrap">
          {error}{" "}
          <Button variant="outline" onClick={() => void refresh()}>
            再読み込み
          </Button>
        </Text>
      ) : null}
      {editing ? (
        <Box as="form" onSubmit={saveMeta} borderTopWidth="1px" borderColor="border" pt="4">
          <Stack gap="3">
            <Heading as="h2" fontSize="lg">
              レシピ情報を編集
            </Heading>
            <Stack direction={{ base: "column", md: "row" }}>
              <label>
                料理名
                <Input
                  required
                  maxLength={120}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <label>
                カテゴリ
                <Input
                  maxLength={64}
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                />
              </label>
            </Stack>
            <label>
              メモ
              <textarea
                style={{ ...inputStyle, minHeight: 80 }}
                maxLength={4000}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </label>
            <Button type="submit" colorPalette="red" alignSelf="start" loading={busy}>
              変更を保存
            </Button>
          </Stack>
        </Box>
      ) : null}
      <Stack
        as="section"
        aria-label="人前・栄養価・原価"
        gap="4"
        borderTopWidth="1px"
        borderColor="border"
        pt="4"
      >
        <Stack
          direction={{ base: "column", sm: "row" }}
          align={{ base: "stretch", sm: "end" }}
          gap="3"
        >
          <label>
            表示人前数
            <Input
              type="number"
              min="1"
              max="100"
              step="1"
              value={servings}
              onChange={(e) => setServings(Math.min(100, Math.max(1, Number(e.target.value) || 1)))}
            />
          </label>
          <Text color="fg.muted">数量はこの画面と食事記録の追加に反映されます。</Text>
        </Stack>
        <Box style={metricGrid}>
          {[
            [
              "原価",
              yen(totalCost),
              `1人前 ${yen(totalCost === null ? null : totalCost / servings)}`,
            ],
            [
              "エネルギー",
              totalNutrition ? `${fmt(totalNutrition.caloriesKcal)} kcal` : "—",
              `1人前 ${totalNutrition ? `${fmt(totalNutrition.caloriesKcal / servings)} kcal` : "—"}`,
            ],
            [
              "P / F / C",
              totalNutrition
                ? `${fmt(totalNutrition.proteinG)}g / ${fmt(totalNutrition.fatG)}g / ${fmt(totalNutrition.carbohydrateG)}g`
                : "—",
              totalNutrition
                ? `1人前 P ${fmt(totalNutrition.proteinG / servings)}g / F ${fmt(totalNutrition.fatG / servings)}g / C ${fmt(totalNutrition.carbohydrateG / servings)}g`
                : "1人前 —",
            ],
            [
              "食物繊維 / 食塩",
              totalNutrition
                ? `${fmt(totalNutrition.fiberG)}g / ${fmt(totalNutrition.saltEquivalentG)}g`
                : "—",
              totalNutrition
                ? `1人前 ${fmt(totalNutrition.fiberG === null ? null : totalNutrition.fiberG / servings)}g / ${fmt(totalNutrition.saltEquivalentG === null ? null : totalNutrition.saltEquivalentG / servings)}g`
                : "1人前 —",
            ],
          ].map(([label, value, perServing]) => (
            <Box key={label} p="3" borderWidth="1px" borderColor="border">
              <Text fontSize="sm">{label}</Text>
              <Text fontWeight="600" mt="1">
                {value}
              </Text>
              <Text fontSize="xs" color="fg.muted">
                {perServing}
              </Text>
            </Box>
          ))}
        </Box>
      </Stack>
      <Stack
        as="section"
        aria-label="材料と栄養・原価内訳"
        gap="3"
        borderTopWidth="1px"
        borderColor="border"
        pt="4"
      >
        <Heading as="h2" fontSize="xl" fontWeight="600">
          材料
        </Heading>
        {dish.recipe.ingredients.map((entry) => {
          const data = entryData.find((item) => item.entry.id === entry.id)!;
          const group = dish.recipe.ingredientGroups.find((item) => item.id === entry.groupId);
          const usages = ingredientUsages(entry);
          return (
            <Box key={entry.id} borderBottomWidth="1px" borderColor="border" py="3">
              <Stack direction={{ base: "column", md: "row" }} justify="space-between" gap="2">
                <Box>
                  <Text fontWeight="600">
                    {group ? `${group.symbol} ${group.label} · ` : ""}
                    {entry.name} · {displayEntryAmount(entry, data.amount)}
                  </Text>
                  <Text fontSize="sm" color="fg.muted">
                    {entry.prepNote ? `下ごしらえ: ${entry.prepNote} · ` : ""}
                    {data.nutrition
                      ? `${fmt(data.nutrition.caloriesKcal)} kcal · P ${fmt(data.nutrition.proteinG)}g / F ${fmt(data.nutrition.fatG)}g / C ${fmt(data.nutrition.carbohydrateG)}g`
                      : "栄養価未計算"}{" "}
                    · 原価 {yen(data.cost)}
                  </Text>
                </Box>
                <Stack gap="1" fontSize="sm" aria-label={`${entry.name} の手順別使用量`}>
                  <Text fontWeight="600">手順別の使用</Text>
                  {usages.length ? (
                    usages.map((usage, index) => (
                      <Text key={`${usage.step.id}-${index}`}>
                        <a href={`#${usage.step.id}`}>Step {usage.step.stepNumber}</a>:{" "}
                        {displayEntryAmount(entry, usage.amount)}
                        {usage.amountText ? ` · ${usage.amountText}` : ""}
                      </Text>
                    ))
                  ) : (
                    <Text>未指定</Text>
                  )}
                </Stack>
              </Stack>
            </Box>
          );
        })}
      </Stack>
      <Stack
        as="section"
        aria-label="調理手順スケジュール"
        gap="4"
        borderTopWidth="1px"
        borderColor="border"
        pt="4"
      >
        <Stack
          direction={{ base: "column", sm: "row" }}
          justify="space-between"
          align={{ base: "stretch", sm: "center" }}
        >
          <Heading as="h2" fontSize="xl" fontWeight="600">
            調理手順 · {duration(schedule.totalDurationSec)}（直列{" "}
            {duration(schedule.serialDurationSec)} / 短縮 {duration(schedule.savedDurationSec)}）
          </Heading>
          <Stack direction="row" aria-label="手順表示">
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
        </Stack>
        {view === "gantt" ? <Gantt recipe={dish.recipe} schedule={schedule} /> : null}
        <Stack gap="0" style={{ display: view === "list" ? "flex" : "none" }}>
          {dish.recipe.steps.map((step) => {
            const bar = schedule.bars.find((item) => item.stepId === step.id);
            const completed = completedStepIds.includes(step.id);
            return (
              <Box id={step.id} key={step.id} borderBottomWidth="1px" borderColor="border" py="4">
                <Stack gap="2">
                  <Stack
                    direction={{ base: "column", sm: "row" }}
                    justify="space-between"
                    align={{ base: "stretch", sm: "center" }}
                  >
                    <Heading as="h3" fontSize="md" fontWeight="600">
                      Step {step.stepNumber} · {step.title}
                    </Heading>
                    <Stack direction="row" align="center" gap="4">
                      <Text fontSize="sm" color="fg.muted">
                        作業 {duration(step.timing.activeDurationSec)} · 待機{" "}
                        {duration(step.timing.passiveDurationSec)}
                        {step.heatLevel !== "none" ? ` · 火加減 ${step.heatLevel}` : ""}
                      </Text>
                      <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <input
                          type="checkbox"
                          aria-label={`Step ${step.stepNumber} を完了`}
                          checked={completed}
                          onChange={(event) =>
                            setCompletedStepIds((current) =>
                              event.target.checked
                                ? [...current, step.id]
                                : current.filter((id) => id !== step.id),
                            )
                          }
                        />
                        完了
                      </label>
                    </Stack>
                  </Stack>
                  <Text>{step.instruction}</Text>
                  {step.inputs.length ? (
                    <Text fontSize="sm">
                      <strong>投入:</strong>{" "}
                      {step.inputs.map((input) => inputLabel(input)).join(" · ")}
                    </Text>
                  ) : null}
                  {step.outputs.length ? (
                    <Text fontSize="sm">
                      <strong>生成:</strong>{" "}
                      {step.outputs.map((output) => output.label).join(" · ")}
                    </Text>
                  ) : null}
                  {step.completionCue ? (
                    <Text fontSize="sm">
                      <strong>完了の目安:</strong> {step.completionCue}
                    </Text>
                  ) : null}
                  {step.cautions.map((caution) => (
                    <Text key={caution.id} color="red.fg">
                      <strong>{caution.title}:</strong> {caution.description}
                    </Text>
                  ))}
                  {step.resourceTags.length ? (
                    <Text fontSize="sm" color="fg.muted">
                      器具: {step.resourceTags.join(" · ")}
                    </Text>
                  ) : null}
                  {step.dependsOnStepIds.length ? (
                    <Text fontSize="sm" color="fg.muted">
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
                    <Text fontSize="xs" color="fg.muted">
                      予定 {duration(bar.startSec)}–{duration(bar.endSec)}
                      {bar.isCriticalPath ? " · クリティカルパス" : ""}
                    </Text>
                  ) : null}
                </Stack>
              </Box>
            );
          })}
        </Stack>
      </Stack>
    </Stack>
  );
}
function Gantt(props: GanttProps) {
  const { recipe, schedule } = props;
  const px = 2.5;
  const left = 150;
  const row = 58;
  const width = Math.max(620, schedule.totalDurationSec * px + left + 40);
  const height = Math.max(80, schedule.bars.length * row + 30);
  const stepRows = new Map<string, number>(
    schedule.bars.map((bar, index): [string, number] => [bar.stepId, index]),
  );

  return (
    <Box
      role="img"
      aria-label="並列調理ガントチャート。実線は作業、点線枠は待機。矢印は依存関係。"
      overflowX="auto"
      borderWidth="1px"
      borderColor="border"
      p="2"
    >
      <svg width={width} height={height} style={{ display: "block", fontFamily: "inherit" }}>
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
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#71717a" />
          </marker>
        </defs>
        {Array.from({ length: Math.floor(schedule.totalDurationSec / 60) + 1 }, (_, minute) => (
          <g key={minute}>
            <line
              x1={left + minute * 60 * px}
              x2={left + minute * 60 * px}
              y1="20"
              y2={height}
              stroke="#e4e4e7"
            />
            <text x={left + minute * 60 * px + 3} y="15" fontSize="11" fill="#52525b">
              {minute}:00
            </text>
          </g>
        ))}
        {schedule.bars.map((bar, index) => {
          const y = 28 + index * row;
          const step = recipe.steps.find((candidate) => candidate.id === bar.stepId);
          if (!step) return null;
          return (
            <g key={bar.stepId}>
              <text x="4" y={y + 16} fontSize="12" fill="#18181b">
                {`Step ${bar.stepNumber} ${bar.title}`.slice(0, 22)}
              </text>
              <line x1={left} x2={width - 10} y1={y + 36} y2={y + 36} stroke="#f4f4f5" />
              {bar.dependsOnStepIds.map((dependencyId) => {
                const dependencyRow = stepRows.get(dependencyId);
                const dependency = schedule.bars.find(
                  (candidate) => candidate.stepId === dependencyId,
                );
                if (dependencyRow === undefined || !dependency) return null;
                const x1 = left + dependency.endSec * px;
                const x2 = left + bar.startSec * px;
                const y1 = 28 + dependencyRow * row + 23;
                const y2 = y + 23;
                return (
                  <path
                    key={dependencyId}
                    d={`M ${x1} ${y1} H ${Math.max(x1 + 8, x2 - 8)} V ${y2} H ${x2}`}
                    fill="none"
                    stroke="#71717a"
                    strokeWidth="1.4"
                    markerEnd="url(#dependency-arrow)"
                  />
                );
              })}
              <rect
                x={left + bar.startSec * px}
                y={y + 8}
                width={Math.max(2, step.timing.activeDurationSec * px)}
                height="16"
                fill="#dc2626"
              />
              <rect
                x={left + bar.activeEndSec * px}
                y={y + 8}
                width={Math.max(0, step.timing.passiveDurationSec * px)}
                height="16"
                fill="#fef2f2"
                stroke="#dc2626"
                strokeDasharray="4 3"
              />
              <text x={left + bar.endSec * px + 3} y={y + 20} fontSize="10" fill="#52525b">
                {duration(bar.endSec)}
              </text>
            </g>
          );
        })}
      </svg>
      <Stack direction="row" gap="4" fontSize="sm" px="2">
        <Text>
          <span style={{ color: "#dc2626" }}>■</span> 作業時間
        </Text>
        <Text>
          <span style={{ border: "1px dashed #dc2626", color: "#fef2f2" }}>　</span> 待機・放置
        </Text>
        <Text>矢印: 前提ステップの完了から開始</Text>
      </Stack>
    </Box>
  );
}
const metricGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))",
  gap: 0,
};
