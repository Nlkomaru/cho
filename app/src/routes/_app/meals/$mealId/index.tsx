import { useCallback, useEffect, useState } from "react";
import { Box, Button, Flex, Heading, Stack, Text } from "@chakra-ui/react";
import { createFileRoute, Link } from "@tanstack/react-router";
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
      message = ((await response.json()) as { error?: string }).error ?? message;
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
      <Stack as="main" px={{ base: "4", md: "8" }} py="8" role="status">
        <Text>読み込み中</Text>
      </Stack>
    );
  if (error && !meal)
    return (
      <Stack as="main" px={{ base: "4", md: "8" }} py="8">
        <Text role="alert" color="red.fg">
          {error}
        </Text>
        <Button alignSelf="start" variant="outline" onClick={() => void load()}>
          再読み込み
        </Button>
        <Link to="/">食事記録に戻る</Link>
      </Stack>
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
    ["料金", yen(meal.totalPriceYen)],
    ["エネルギー", facts ? `${num(facts.caloriesKcal)} kcal` : "—"],
    [
      "PFC",
      facts
        ? `P ${num(facts.proteinG)}g / F ${num(facts.fatG)}g / C ${num(facts.carbohydrateG)}g`
        : "—",
    ],
    [
      "食物繊維・食塩",
      facts ? `食物繊維 ${num(facts.fiberG)}g / 食塩 ${num(facts.saltEquivalentG)}g` : "—",
    ],
  ];
  const costs = meal.items.flatMap((item) =>
    item.ingredientCostBreakdown.map((cost, index) => ({
      key: `${item.id}-${index}`,
      item: item.name,
      cost,
    })),
  );
  return (
    <Stack as="main" w="full" maxW="7xl" gap="5" px={{ base: "4", md: "8" }} py="8" color="fg">
      <Text>
        <Link to="/">食事記録に戻る</Link>
      </Text>
      <Flex justify="space-between" align="center" wrap="wrap" gap="3">
        <Heading as="h1" color="fg.subtle" fontSize="2xl" fontWeight="600">
          {meal.title}
        </Heading>
        <Text>
          {sourceLabels[meal.sourceType] ?? meal.sourceType}
          {meal.mealTiming ? ` · ${timingLabels[meal.mealTiming] ?? meal.mealTiming}` : ""}
        </Text>
      </Flex>
      <Text>
        {new Date(meal.eatenAt).toLocaleString("ja-JP")}　{meal.placeName ?? ""}
      </Text>
      {meal.memo && <Text>{meal.memo}</Text>}
      {meal.imageIds.length > 0 && (
        <Flex as="section" aria-label="食事の写真" wrap="wrap" gap="3">
          {meal.imageIds.map((id, index) => (
            <Box
              key={id}
              as="img"
              src={`/api/images/${encodeURIComponent(id)}`}
              alt={`${meal.title}の写真 ${index + 1}`}
              width="full"
              maxW="320px"
              maxH="280px"
              objectFit="cover"
              borderWidth="1px"
              borderColor="border"
            />
          ))}
        </Flex>
      )}
      <Box
        as="section"
        aria-label="食事の集計"
        display="grid"
        gridTemplateColumns="repeat(auto-fit,minmax(min(100%,180px),1fr))"
        borderTopWidth="1px"
        borderLeftWidth="1px"
        borderColor="border"
      >
        {summary.map(([label, value]) => (
          <Box
            key={label}
            p="4"
            borderRightWidth="1px"
            borderBottomWidth="1px"
            borderColor="border"
          >
            <Text>{label}</Text>
            <Text mt="2" color="fg.subtle" fontWeight="600" fontVariantNumeric="tabular-nums">
              {value}
            </Text>
          </Box>
        ))}
      </Box>
      <Heading as="h2" size="lg">
        品目
      </Heading>
      <Box overflowX="auto">
        <table width="100%">
          <thead>
            <tr>
              {["品目", "料金", "エネルギー", "P / F / C", "食物繊維・食塩"].map((label) => (
                <th key={label}>{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {meal.items.map((item) => (
              <tr key={item.id}>
                <td>
                  {item.name}
                  {item.servingsFactor !== 1 && (
                    <Text as="small" display="block">
                      人前係数 {num(item.servingsFactor)}
                    </Text>
                  )}
                </td>
                <td>{yen(item.priceYen)}</td>
                <td>{item.nutrition ? `${num(item.nutrition.caloriesKcal)} kcal` : "—"}</td>
                <td>
                  {item.nutrition
                    ? `P ${num(item.nutrition.proteinG)}g / F ${num(item.nutrition.fatG)}g / C ${num(item.nutrition.carbohydrateG)}g`
                    : "—"}
                </td>
                <td>
                  {item.nutrition
                    ? `${num(item.nutrition.fiberG)}g / ${num(item.nutrition.saltEquivalentG)}g`
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Box>
      <Heading as="h2" size="lg">
        材料原価
      </Heading>
      {costs.length ? (
        <Stack gap="0">
          {costs.map(({ key, item, cost }) => (
            <Flex
              key={key}
              justify="space-between"
              gap="3"
              borderBottomWidth="1px"
              borderColor="border"
              py="3"
            >
              <Text>
                {item} / {cost.name}　{num(cost.amount)} {cost.unit}
              </Text>
              <Text>{yen(cost.costYen)}</Text>
            </Flex>
          ))}
        </Stack>
      ) : (
        <Text>材料原価の内訳はありません。</Text>
      )}
      <Stack as="section" borderTopWidth="1px" borderColor="border" pt="4" gap="3">
        <Heading as="h2" size="lg">
          在庫消費
        </Heading>
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
          <Text role="alert" color="red.fg">
            {error}
          </Text>
        )}
        {status && <Text role="status">{status}</Text>}
      </Stack>
    </Stack>
  );
}
