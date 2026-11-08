import { useCallback, useEffect, useState } from "react";
import { Button, Flex, Text } from "@chakra-ui/react";
import { createFileRoute, Link } from "@tanstack/react-router";

import { Card } from "../../../../components/ui/card";
import { DataTable, DataTableCell, DataTableRow } from "../../../../components/ui/data-table";
import { Feedback } from "../../../../components/ui/feedback";
import { List, ListItem } from "../../../../components/ui/list";
import { Page, PageHeader } from "../../../../components/ui/page";
import { Section } from "../../../../components/ui/section";
import { StatBar } from "../../../../components/ui/stat-bar";
import { errorMessageFrom } from "../../../../lib/api-error";
import type { NutritionFacts } from "../../../../domain/nutrition";

export const Route = createFileRoute("/_app/meals/$mealId/")({
  staticData: { breadcrumbs: [{ label: "食事詳細" }] },
  component: MealDetailPage,
});
type Cost = { ingredientId: string; name: string; amount: number; unit: string; costYen: number };
type Item = {
  id: string;
  name: string;
  dishId: string | null;
  ingredientId: string | null;
  servingsFactor: number;
  priceYen: number | null;
  nutrition: NutritionFacts | null;
  ingredientCostBreakdown: Cost[];
  estimationSource: string;
};
type Meal = {
  id: string;
  eatenAt: string;
  mealTiming: string | null;
  sourceType: string;
  placeName: string | null;
  title: string;
  totalPriceYen: number | null;
  totalNutrition: NutritionFacts | null;
  imageIds: string[];
  items: Item[];
  memo: string | null;
  inventiaConsumptionStatus?: string | null;
};
const sourceLabels: Record<string, string> = {
  self_cooked: "自炊",
  cafeteria: "学食",
  convenience: "コンビニ",
  supermarket: "スーパー",
  snack: "お菓子",
  restaurant: "外食",
  other: "その他",
};
const timingLabels: Record<string, string> = {
  breakfast: "朝食",
  lunch: "昼食",
  dinner: "夕食",
  snack: "間食",
  late_snack: "夜食",
};
async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    let message = `通信に失敗しました (${response.status})`;
    try {
      message = errorMessageFrom(await response.json(), message);
    } catch {}
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}
function yen(value: number | null) {
  return value === null ? "—" : `¥${Math.round(value).toLocaleString("ja-JP")}`;
}
function num(value: number | null) {
  return value === null ? "—" : value.toLocaleString("ja-JP", { maximumFractionDigits: 1 });
}
function MealDetailPage() {
  const { mealId } = Route.useParams();
  const [meal, setMeal] = useState<Meal | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [status, setStatus] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    try {
      setMeal(await request<Meal>(`/api/meals/${encodeURIComponent(mealId)}`));
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "食事記録を読み込めませんでした。");
    } finally {
      setLoading(false);
    }
  }, [mealId]);
  useEffect(() => {
    void load();
  }, [load]);
  async function consume() {
    setWorking(true);
    setStatus("");
    setError("");
    try {
      await request<unknown>(`/api/meals/${encodeURIComponent(mealId)}/consume-stock`, {
        method: "POST",
      });
      setStatus("在庫消費を実行しました。");
      await load();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "在庫消費に失敗しました。";
      await load();
      setError(message);
    } finally {
      setWorking(false);
    }
  }
  if (loading)
    return (
      <Page size="lg">
        <Feedback tone="status" role="status">
          読み込み中
        </Feedback>
      </Page>
    );
  if (error && !meal)
    return (
      <Page size="lg">
        <Feedback tone="error" role="alert">
          {error}
        </Feedback>
        <Button alignSelf="start" variant="outline" onClick={() => void load()}>
          再読み込み
        </Button>
        <Link to="/">食事記録に戻る</Link>
      </Page>
    );
  if (!meal) return null;
  const facts = meal.totalNutrition;
  const stockStatus =
    meal.inventiaConsumptionStatus == null
      ? "未実行"
      : (({ pending: "処理中", succeeded: "消費済み", failed: "失敗" } as Record<string, string>)[
          meal.inventiaConsumptionStatus
        ] ?? meal.inventiaConsumptionStatus);
  const summary = [
    { label: "料金", value: yen(meal.totalPriceYen) },
    { label: "エネルギー", value: facts ? `${num(facts.caloriesKcal)} kcal` : "—" },
    {
      label: "PFC",
      value: facts
        ? `P ${num(facts.proteinG)}g / F ${num(facts.fatG)}g / C ${num(facts.carbohydrateG)}g`
        : "—",
    },
    {
      label: "食物繊維・食塩",
      value: facts ? `食物繊維 ${num(facts.fiberG)}g / 食塩 ${num(facts.saltEquivalentG)}g` : "—",
    },
  ];
  const costs = meal.items.flatMap((item) =>
    item.ingredientCostBreakdown.map((cost, index) => ({
      key: `${item.id}-${index}`,
      item: item.name,
      cost,
    })),
  );
  return (
    <Page size="lg">
      <Link to="/">食事記録に戻る</Link>
      <PageHeader title={meal.title} />
      <Text textStyle="numeric.sm">
        {new Date(meal.eatenAt).toLocaleString("ja-JP")}　{meal.placeName ?? ""}　
        {sourceLabels[meal.sourceType] ?? meal.sourceType}
        {meal.mealTiming ? ` · ${timingLabels[meal.mealTiming] ?? meal.mealTiming}` : ""}
      </Text>
      {meal.memo && <Text>{meal.memo}</Text>}
      {meal.imageIds.length > 0 && (
        <Flex as="section" aria-label="食事の写真" wrap="wrap" gap="3">
          {meal.imageIds.map((id, index) => (
            <Card
              key={id}
              media={
                <img
                  src={`/api/images/${encodeURIComponent(id)}`}
                  alt={`${meal.title}の写真 ${index + 1}`}
                />
              }
            />
          ))}
        </Flex>
      )}
      <StatBar label="食事の集計" items={summary} />
      <Section title="品目">
        <DataTable
          label="品目の内訳"
          columns={["品目", "料金", "エネルギー", "P / F / C", "食物繊維・食塩"]}
        >
          {meal.items.map((item) => (
            <DataTableRow key={item.id}>
              <DataTableCell>
                {item.name}
                {item.servingsFactor !== 1 && (
                  <Text textStyle="caption">人前係数 {num(item.servingsFactor)}</Text>
                )}
              </DataTableCell>
              <DataTableCell numeric>{yen(item.priceYen)}</DataTableCell>
              <DataTableCell numeric>
                {item.nutrition ? `${num(item.nutrition.caloriesKcal)} kcal` : "—"}
              </DataTableCell>
              <DataTableCell numeric>
                {item.nutrition
                  ? `P ${num(item.nutrition.proteinG)}g / F ${num(item.nutrition.fatG)}g / C ${num(item.nutrition.carbohydrateG)}g`
                  : "—"}
              </DataTableCell>
              <DataTableCell numeric>
                {item.nutrition
                  ? `${num(item.nutrition.fiberG)}g / ${num(item.nutrition.saltEquivalentG)}g`
                  : "—"}
              </DataTableCell>
            </DataTableRow>
          ))}
        </DataTable>
      </Section>
      <Section title="材料原価">
        {costs.length ? (
          <List>
            {costs.map(({ key, item, cost }) => (
              <ListItem layout="row" key={key}>
                <Text textStyle="numeric.sm">
                  {item} / {cost.name}　{num(cost.amount)} {cost.unit}
                </Text>
                <Text textStyle="numeric.sm">{yen(cost.costYen)}</Text>
              </ListItem>
            ))}
          </List>
        ) : (
          <Text>材料原価の内訳はありません。</Text>
        )}
      </Section>
      <Section title="在庫消費">
        <Text>Inventiaの消費状況: {stockStatus}</Text>
        {meal.sourceType === "self_cooked" && (
          <Button
            alignSelf="start"
            colorPalette="red"
            disabled={
              working ||
              meal.inventiaConsumptionStatus === "pending" ||
              meal.inventiaConsumptionStatus === "succeeded"
            }
            onClick={() => void consume()}
          >
            {meal.inventiaConsumptionStatus === "succeeded"
              ? "消費済み"
              : working || meal.inventiaConsumptionStatus === "pending"
                ? "処理中…"
                : meal.inventiaConsumptionStatus === "failed"
                  ? "在庫消費を再試行"
                  : "在庫を消費する"}
          </Button>
        )}
        {error && (
          <Feedback tone="error" role="alert">
            {error}
          </Feedback>
        )}
        {status && (
          <Feedback tone="status" role="status">
            {status}
          </Feedback>
        )}
      </Section>
    </Page>
  );
}
