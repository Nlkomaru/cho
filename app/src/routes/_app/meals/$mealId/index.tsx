import { useCallback, useEffect, useState } from "react";
import { Box, Button, Flex, Table, Text } from "@chakra-ui/react";
import { createFileRoute, Link } from "@tanstack/react-router";

import { Card } from "../../../../components/ui/card";
import { Feedback } from "../../../../components/ui/feedback";
import { List, ListItem } from "../../../../components/ui/list";
import { Numeric } from "../../../../components/ui/numeric";
import { Page, PageHeader } from "../../../../components/ui/page";
import { Section } from "../../../../components/ui/section";
import { StatBar } from "../../../../components/ui/stat-bar";
import { errorMessageFrom } from "../../../../lib/api-error";
import type { NutritionFacts } from "../../../../domain/nutrition";
import { localCalendarDate, localTimeValue } from "../../-components/meal-shared";

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
    {
      label: "料金",
      value: (
        <Numeric size="lg" tone="strong">
          {yen(meal.totalPriceYen)}
        </Numeric>
      ),
    },
    {
      label: "エネルギー",
      value: (
        <>
          <Numeric size="lg" tone="strong">
            {facts ? num(facts.caloriesKcal) : "—"}
          </Numeric>
          <Box as="span">kcal</Box>
        </>
      ),
    },
    {
      label: "PFC",
      value: (
        <>
          <Box as="span">
            P{" "}
            <Numeric size="lg" tone="strong">
              {facts ? num(facts.proteinG) : "—"}
            </Numeric>{" "}
            g
          </Box>
          <Box as="span">
            F{" "}
            <Numeric size="lg" tone="strong">
              {facts ? num(facts.fatG) : "—"}
            </Numeric>{" "}
            g
          </Box>
          <Box as="span">
            C{" "}
            <Numeric size="lg" tone="strong">
              {facts ? num(facts.carbohydrateG) : "—"}
            </Numeric>{" "}
            g
          </Box>
        </>
      ),
    },
    {
      label: "食物繊維・食塩",
      value: (
        <>
          <Box as="span">
            食物繊維{" "}
            <Numeric size="lg" tone="strong">
              {facts ? num(facts.fiberG) : "—"}
            </Numeric>{" "}
            g
          </Box>
          <Box as="span">
            食塩{" "}
            <Numeric size="lg" tone="strong">
              {facts ? num(facts.saltEquivalentG) : "—"}
            </Numeric>{" "}
            g
          </Box>
        </>
      ),
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
      <Flex gap="3" wrap="wrap" align="baseline">
        <Numeric size="sm" tone="muted">
          {localCalendarDate(meal.eatenAt)} {localTimeValue(meal.eatenAt)}
        </Numeric>
        <Text textStyle="caption">
          {meal.placeName ?? ""}
          {meal.placeName ? " · " : ""}
          {sourceLabels[meal.sourceType] ?? meal.sourceType}
          {meal.mealTiming ? ` · ${timingLabels[meal.mealTiming] ?? meal.mealTiming}` : ""}
        </Text>
      </Flex>
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
        <Table.ScrollArea borderWidth="0">
          <Table.Root size="sm">
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeader>品目</Table.ColumnHeader>
                <Table.ColumnHeader>料金</Table.ColumnHeader>
                <Table.ColumnHeader>エネルギー</Table.ColumnHeader>
                <Table.ColumnHeader>P / F / C</Table.ColumnHeader>
                <Table.ColumnHeader>食物繊維・食塩</Table.ColumnHeader>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {meal.items.map((item) => (
                <Table.Row key={item.id}>
                  <Table.Cell>
                    {item.name}
                    {item.servingsFactor !== 1 ? (
                      <Text textStyle="caption">
                        人前係数 <Numeric size="sm">{num(item.servingsFactor)}</Numeric>
                      </Text>
                    ) : null}
                  </Table.Cell>
                  <Table.Cell whiteSpace="nowrap">
                    <Numeric size="sm">{yen(item.priceYen)}</Numeric>
                  </Table.Cell>
                  <Table.Cell whiteSpace="nowrap">
                    {item.nutrition ? (
                      <>
                        <Numeric size="sm">{num(item.nutrition.caloriesKcal)}</Numeric> kcal
                      </>
                    ) : (
                      "—"
                    )}
                  </Table.Cell>
                  <Table.Cell whiteSpace="nowrap">
                    {item.nutrition ? (
                      <>
                        P <Numeric size="sm">{num(item.nutrition.proteinG)}</Numeric> g / F{" "}
                        <Numeric size="sm">{num(item.nutrition.fatG)}</Numeric> g / C{" "}
                        <Numeric size="sm">{num(item.nutrition.carbohydrateG)}</Numeric> g
                      </>
                    ) : (
                      "—"
                    )}
                  </Table.Cell>
                  <Table.Cell whiteSpace="nowrap">
                    {item.nutrition ? (
                      <>
                        <Numeric size="sm">{num(item.nutrition.fiberG)}</Numeric> g /{" "}
                        <Numeric size="sm">{num(item.nutrition.saltEquivalentG)}</Numeric> g
                      </>
                    ) : (
                      "—"
                    )}
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
        </Table.ScrollArea>
      </Section>
      <Section title="材料原価">
        {costs.length ? (
          <List>
            {costs.map(({ key, item, cost }) => (
              <ListItem layout="row" key={key}>
                <Text textStyle="body.sm">
                  {item} / {cost.name} <Numeric size="sm">{num(cost.amount)}</Numeric> {cost.unit}
                </Text>
                <Numeric size="sm">{yen(cost.costYen)}</Numeric>
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
