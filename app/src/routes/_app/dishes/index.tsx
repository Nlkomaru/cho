import { Box, Button, Heading, Stack, Text } from "@chakra-ui/react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { computeRecipeGanttSchedule } from "../../../domain/recipe-scheduler";

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
  if (!response.ok)
    throw new Error(
      ((await response.json().catch(() => ({}))) as { error?: string }).error ??
        `通信に失敗しました (${response.status})`,
    );
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
    <Stack as="main" w="full" maxW="6xl" gap="7" px={{ base: "4", md: "8" }} py="8">
      <Stack
        direction={{ base: "column", sm: "row" }}
        align={{ base: "stretch", sm: "center" }}
        justify="space-between"
        gap="3"
      >
        <Heading as="h1" color="fg.subtle" fontSize="2xl" fontWeight="600">
          レシピ
        </Heading>
        <Link to="/dishes/new">
          <Button colorPalette="red">レシピを追加</Button>
        </Link>
      </Stack>
      <Stack as="section" aria-label="レシピ一覧" gap="4">
        <Box maxW="sm">
          <Text as="label" htmlFor="dish-search" fontSize="sm" fontWeight="600">
            料理名で検索
          </Text>
          <input
            id="dish-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            style={inputStyle}
          />
        </Box>
        {error ? (
          <Text role="alert" color="red.fg">
            {error}{" "}
            <Button variant="outline" onClick={() => void refresh()}>
              再読み込み
            </Button>
          </Text>
        ) : null}
        {loading ? (
          <Text role="status">レシピを読み込み中…</Text>
        ) : visible.length ? (
          <Box as="ul" m="0" p="0" listStyle="none" borderTopWidth="1px" borderColor="border">
            {visible.map((dish) => (
              <Box as="li" key={dish.id} borderBottomWidth="1px" borderColor="border" py="5">
                <Stack direction={{ base: "column", md: "row" }} justify="space-between" gap="3">
                  <Box minW="0">
                    <Heading as="h2" fontSize="lg" fontWeight="600" overflowWrap="anywhere">
                      <Link to="/dishes/$dishId" params={{ dishId: dish.id }}>
                        {dish.name}
                      </Link>
                    </Heading>
                    <Text color="fg.muted" fontSize="sm">
                      {dish.category ?? "カテゴリなし"} · {dish.servings}人前 ·{" "}
                      {dish.recipe.ingredients.length}材料 · {dish.recipe.steps.length}手順
                    </Text>
                  </Box>
                  <Stack
                    direction={{ base: "column", sm: "row" }}
                    gap={{ base: "1", sm: "6" }}
                    fontSize="sm"
                  >
                    <Text>
                      <strong>{yen(dish.totalCostYen)}</strong> / 人前
                    </Text>
                    <Text>
                      {dish.totalNutrition
                        ? `${fmt(dish.totalNutrition.caloriesKcal)} kcal · P ${fmt(dish.totalNutrition.proteinG)}g · F ${fmt(dish.totalNutrition.fatG)}g · C ${fmt(dish.totalNutrition.carbohydrateG)}g`
                        : "栄養価 —"}{" "}
                      / 人前
                    </Text>
                    <Text>調理時間 {duration(dish.recipe)}</Text>
                  </Stack>
                </Stack>
              </Box>
            ))}
          </Box>
        ) : (
          <Text role="status">
            {dishes.length ? "検索結果がありません。" : "レシピはまだ登録されていません。"}
          </Text>
        )}
      </Stack>
    </Stack>
  );
}
const inputStyle: React.CSSProperties = {
  width: "100%",
  minHeight: 40,
  border: "1px solid #d4d4d8",
  padding: 8,
  background: "white",
};
