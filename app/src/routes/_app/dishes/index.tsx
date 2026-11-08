import { Box, Button, Heading, Stack, Text } from "@chakra-ui/react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Feedback } from "../../../components/ui/feedback";
import { Field, NativeInput } from "../../../components/ui/form";
import { List, ListItem } from "../../../components/ui/list";
import { Page, PageHeader } from "../../../components/ui/page";
import { Section } from "../../../components/ui/section";
import { errorMessageFrom } from "../../../lib/api-error";
import { computeRecipeGanttSchedule } from "../../../domain/recipe-scheduler";
import type { Dish } from "../../../domain/ingredient";

export const Route = createFileRoute("/_app/dishes/")({
  staticData: { breadcrumbs: [{ label: "レシピ" }] },
  component: DishListPage,
});
const fmt = (value: number | null | undefined, digits = 1) =>
  value == null ? "—" : value.toLocaleString("ja-JP", { maximumFractionDigits: digits });
const yen = (value: number | null | undefined) =>
  value == null ? "—" : `¥${Math.round(value).toLocaleString("ja-JP")}`;
async function api<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => undefined);
    throw new Error(errorMessageFrom(body, `通信に失敗しました (${response.status})`));
  }
  return response.json() as Promise<T>;
}
function duration(recipe: Dish["recipe"]) {
  const seconds = computeRecipeGanttSchedule(recipe).totalDurationSec;
  return `${Math.floor(seconds / 3600) ? `${Math.floor(seconds / 3600)}時間` : ""}${Math.floor((seconds % 3600) / 60)}分`;
}
function DishListPage() {
  const [dishes, setDishes] = useState<Dish[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [query, setQuery] = useState("");
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setDishes(await api<Dish[]>("/api/dishes"));
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "レシピを読み込めませんでした。");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  const visible = useMemo(
    () =>
      dishes.filter((dish) => dish.name.toLocaleLowerCase().includes(query.toLocaleLowerCase())),
    [dishes, query],
  );
  return (
    <Page>
      <PageHeader
        title="レシピ"
        actions={
          <Link to="/dishes/new" search={{ dishId: undefined }}>
            <Button colorPalette="red">レシピを追加</Button>
          </Link>
        }
      />
      <Section label="レシピ一覧" divided={false}>
        <Box maxW="sm">
          <Field label="料理名で検索" htmlFor="dish-search">
            <NativeInput
              id="dish-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </Field>
        </Box>
        {error ? (
          <Feedback tone="error" role="alert">
            {error}{" "}
            <Button variant="outline" onClick={() => void refresh()}>
              再読み込み
            </Button>
          </Feedback>
        ) : null}
        {loading ? (
          <Feedback tone="status" role="status">
            レシピを読み込み中…
          </Feedback>
        ) : visible.length ? (
          <List>
            {visible.map((dish) => (
              <ListItem layout="row" key={dish.id}>
                <Box minW="0">
                  <Heading as="h2" textStyle="heading.sm" overflowWrap="anywhere">
                    <Link to="/dishes/$dishId" params={{ dishId: dish.id }}>
                      {dish.name}
                    </Link>
                  </Heading>
                  <Text textStyle="caption">
                    {dish.category ?? "カテゴリなし"} · {dish.servings}人前 ·{" "}
                    {dish.recipe.ingredients.length}材料 · {dish.recipe.steps.length}手順
                  </Text>
                </Box>
                <Stack direction={{ base: "column", sm: "row" }} gap={{ base: "1", sm: "6" }}>
                  <Text textStyle="numeric.sm">
                    <strong>{yen(dish.totalCostYen)}</strong> / 人前
                  </Text>
                  <Text textStyle="numeric.sm">
                    {dish.totalNutrition
                      ? `${fmt(dish.totalNutrition.caloriesKcal)} kcal · P ${fmt(dish.totalNutrition.proteinG)}g · F ${fmt(dish.totalNutrition.fatG)}g · C ${fmt(dish.totalNutrition.carbohydrateG)}g`
                      : "栄養価 —"}{" "}
                    / 人前
                  </Text>
                  <Text textStyle="numeric.sm">調理時間 {duration(dish.recipe)}</Text>
                </Stack>
              </ListItem>
            ))}
          </List>
        ) : (
          <Feedback tone="status" role="status">
            {dishes.length ? "検索結果がありません。" : "レシピはまだ登録されていません。"}
          </Feedback>
        )}
      </Section>
    </Page>
  );
}
