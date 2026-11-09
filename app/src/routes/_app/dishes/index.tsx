import { Box, Button, Field, Input, Text, chakra } from "@chakra-ui/react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { createColumnHelper, FlexRender, tableFeatures, useTable } from "@tanstack/react-table";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  Dash,
  FoodBodyCell,
  FoodHeaderCell,
  formatNutritionAmount,
  formatPrice,
  TableFrame,
} from "../../../components/ui/food-table";
import { Feedback } from "../../../components/ui/feedback";
import { Page, PageHeader } from "../../../components/ui/page";
import { Section } from "../../../components/ui/section";
import { computeRecipeGanttSchedule } from "../../../domain/recipe-scheduler";
import type { Dish } from "../../../domain/ingredient";
import { errorMessageFrom } from "../../../lib/api-error";

export const Route = createFileRoute("/_app/dishes/")({
  staticData: { breadcrumbs: [{ label: "レシピ" }] },
  component: DishListPage,
});

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

const features = tableFeatures({});
const columnHelper = createColumnHelper<typeof features, Dish>();

const columns = columnHelper.columns([
  columnHelper.accessor("name", {
    id: "name",
    header: "品目名",
    cell: ({ row }) => {
      const dish = row.original;
      return (
        <Box minW="0">
          <Link to="/dishes/$dishId" params={{ dishId: dish.id }}>
            <Text
              fontWeight="medium"
              color="fg.subtle"
              _hover={{ color: "red.solid", textDecoration: "underline" }}
            >
              {dish.name}
            </Text>
          </Link>
          <Text textStyle="caption" color="fg.muted">
            {dish.category ?? "カテゴリなし"} · {dish.servings}人前 ·{" "}
            {dish.recipe.ingredients.length}材料 · 調理時間 {duration(dish.recipe)}
          </Text>
        </Box>
      );
    },
  }),
  columnHelper.display({
    id: "caloriesKcal",
    header: "エネルギー",
    cell: ({ row }) => formatNutritionAmount(row.original.totalNutrition?.caloriesKcal, "kcal"),
  }),
  columnHelper.display({
    id: "proteinG",
    header: "P",
    cell: ({ row }) => formatNutritionAmount(row.original.totalNutrition?.proteinG, "g"),
  }),
  columnHelper.display({
    id: "fatG",
    header: "F",
    cell: ({ row }) => formatNutritionAmount(row.original.totalNutrition?.fatG, "g"),
  }),
  columnHelper.display({
    id: "carbohydrateG",
    header: "C",
    cell: ({ row }) => formatNutritionAmount(row.original.totalNutrition?.carbohydrateG, "g"),
  }),
  columnHelper.display({
    id: "fiberG",
    header: "食物繊維",
    cell: ({ row }) => formatNutritionAmount(row.original.totalNutrition?.fiberG, "g"),
  }),
  columnHelper.display({
    id: "saltEquivalentG",
    header: "食塩",
    cell: ({ row }) => formatNutritionAmount(row.original.totalNutrition?.saltEquivalentG, "g"),
  }),
  columnHelper.display({
    id: "price",
    header: "価格",
    cell: ({ row }) => formatPrice(row.original.totalCostYen),
  }),
  columnHelper.display({
    id: "inventia",
    header: "Inventia",
    cell: () => <Dash />,
  }),
]);

function DishListPage() {
  const navigate = useNavigate();
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

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

  const table = useTable({
    features,
    columns,
    data: visible,
    getRowId: (row) => row.id,
  });

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
          <Field.Root>
            <Field.Label>料理名で検索</Field.Label>
            <Input
              id="dish-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </Field.Root>
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
        ) : (
          <TableFrame
            busy={loading}
            empty={visible.length === 0}
            emptyMessage={
              dishes.length ? "検索結果がありません。" : "レシピはまだ登録されていません。"
            }
            head={table.getHeaderGroups().map((group) => (
              <chakra.tr key={group.id}>
                {group.headers.map((header) => {
                  const id = header.column.id;
                  const align = id === "name" ? "left" : id === "inventia" ? "center" : "right";
                  const width =
                    id === "inventia"
                      ? "64px"
                      : id === "caloriesKcal"
                        ? "110px"
                        : id === "name"
                          ? undefined
                          : "88px";
                  return (
                    <FoodHeaderCell key={header.id} align={align} width={width}>
                      <FlexRender header={header} />
                    </FoodHeaderCell>
                  );
                })}
              </chakra.tr>
            ))}
          >
            {table.getRowModel().rows.map((row) => (
              <chakra.tr
                key={row.id}
                cursor="pointer"
                _hover={{ bg: "bg.subtle" }}
                transition="colors 0.15s ease"
                onClick={() => {
                  if (window.getSelection()?.isCollapsed === false) return;
                  void navigate({ to: "/dishes/$dishId", params: { dishId: row.original.id } });
                }}
              >
                {row.getAllCells().map((cell) => {
                  const id = cell.column.id;
                  const align = id === "name" ? "left" : id === "inventia" ? "center" : "right";
                  return (
                    <FoodBodyCell key={cell.id} align={align}>
                      <FlexRender cell={cell} />
                    </FoodBodyCell>
                  );
                })}
              </chakra.tr>
            ))}
          </TableFrame>
        )}
      </Section>
    </Page>
  );
}
