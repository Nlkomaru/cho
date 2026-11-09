import { Box, Text, chakra } from "@chakra-ui/react";
import { Link } from "@tanstack/react-router";
import {
  createColumnHelper,
  createSortedRowModel,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import type { ReactNode } from "react";

import {
  DataTable,
  type DataTableColumnMeta,
  Dash,
  SortableHeader,
} from "@/components/ui/data-table";
import type { Dish } from "@/domain/ingredient";
import type { NutritionFacts } from "@/domain/nutrition";
import { computeRecipeGanttSchedule } from "@/domain/recipe-scheduler";
import { formatMinutes, formatFixed, formatNumber, formatYen } from "@/lib/format";

/** 一覧表示用に整えたレシピ 1 行分。 */
export interface DishRow {
  id: string;
  name: string;
  category: string | null;
  servings: number;
  /** 並行作業を考慮した所要時間 (秒)。DAG が不正なら null。 */
  durationSec: number | null;
  ingredientCount: number;
  /** 1 人前の栄養価。 */
  facts: NutritionFacts | null;
  /** 1 人前の原価。 */
  costYen: number | null;
}

const durationOf = (recipe: Dish["recipe"]): number | null => {
  try {
    return computeRecipeGanttSchedule(recipe).totalDurationSec;
  } catch {
    return null;
  }
};

/** API の Dish を表の行に変換する。totalNutrition / totalCostYen は 1 人前の値。 */
export const toDishRow = (dish: Dish): DishRow => ({
  id: dish.id,
  name: dish.name,
  category: dish.category,
  servings: dish.servings,
  durationSec: durationOf(dish.recipe),
  ingredientCount: dish.recipe.ingredients.length,
  facts: dish.totalNutrition,
  costYen: dish.totalCostYen,
});

const features = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { alphanumeric: sortFn_alphanumeric, basic: sortFn_basic },
  columnMeta: {} as DataTableColumnMeta,
});
const columnHelper = createColumnHelper<typeof features, DishRow>();

const grams = (value: number | null | undefined) => (value == null ? <Dash /> : formatFixed(value));

const unit = (text: string) => (
  <chakra.span color="fg.subtle" ms="1" textStyle="caption">
    {text}
  </chakra.span>
);

const columns = columnHelper.columns([
  columnHelper.accessor("name", {
    header: ({ column }) => (
      <SortableHeader
        label="料理名"
        sorted={column.getIsSorted()}
        onToggle={column.getToggleSortingHandler()}
      />
    ),
    cell: ({ row }) => (
      <Box minW="0">
        <chakra.span
          asChild
          color="fg.strong"
          fontWeight="500"
          _hover={{ textDecoration: "underline", textUnderlineOffset: "3px" }}
        >
          <Link to="/dishes/$dishId" params={{ dishId: row.original.id }}>
            {row.original.name}
          </Link>
        </chakra.span>
        <Text textStyle="caption" color="fg.subtle">
          {[row.original.category, `${row.original.servings}人前`].filter(Boolean).join(" · ")}
        </Text>
      </Box>
    ),
  }),
  columnHelper.accessor((row) => row.durationSec ?? undefined, {
    id: "duration",
    header: ({ column }) => (
      <SortableHeader
        label={
          <>
            <chakra.span hideFrom="md">時間</chakra.span>
            <chakra.span hideBelow="md">調理時間</chakra.span>
          </>
        }
        align="end"
        sorted={column.getIsSorted()}
        onToggle={column.getToggleSortingHandler()}
      />
    ),
    cell: ({ getValue }) => {
      const value = getValue();
      return value == null ? <Dash /> : formatMinutes(value);
    },
    sortUndefined: "last",
    meta: { numeric: true, width: { base: "72px", md: "96px" } },
  }),
  columnHelper.accessor("ingredientCount", {
    header: "材料数",
    cell: ({ getValue }) => getValue(),
    meta: { numeric: true, width: "80px", hideBelow: "md" },
  }),
  columnHelper.accessor((row) => row.facts?.caloriesKcal ?? undefined, {
    id: "kcal",
    header: ({ column }) => (
      <SortableHeader
        label={
          <>
            <chakra.span hideFrom="md">kcal</chakra.span>
            <chakra.span hideBelow="md">エネルギー</chakra.span>
          </>
        }
        align="end"
        sorted={column.getIsSorted()}
        onToggle={column.getToggleSortingHandler()}
      />
    ),
    cell: ({ getValue }) => {
      const value = getValue();
      return value == null ? (
        <Dash />
      ) : (
        <>
          {formatNumber(value, 0)}
          <chakra.span hideBelow="md">{unit("kcal")}</chakra.span>
        </>
      );
    },
    sortUndefined: "last",
    meta: { numeric: true, width: { base: "72px", md: "112px" } },
  }),
  columnHelper.accessor((row) => row.facts?.proteinG, {
    id: "p",
    header: "P",
    cell: ({ getValue }) => grams(getValue()),
    meta: { numeric: true, width: "72px", hideBelow: "md" },
  }),
  columnHelper.accessor((row) => row.facts?.fatG, {
    id: "f",
    header: "F",
    cell: ({ getValue }) => grams(getValue()),
    meta: { numeric: true, width: "72px", hideBelow: "md" },
  }),
  columnHelper.accessor((row) => row.facts?.carbohydrateG, {
    id: "c",
    header: "C",
    cell: ({ getValue }) => grams(getValue()),
    meta: { numeric: true, width: "72px", hideBelow: "md" },
  }),
  columnHelper.accessor((row) => row.costYen ?? undefined, {
    id: "cost",
    header: ({ column }) => (
      <SortableHeader
        label="原価"
        align="end"
        sorted={column.getIsSorted()}
        onToggle={column.getToggleSortingHandler()}
      />
    ),
    cell: ({ getValue }) => {
      const value = getValue();
      return value == null ? <Dash /> : formatYen(value);
    },
    sortUndefined: "last",
    meta: { numeric: true, width: "88px", hideBelow: "md" },
  }),
]);

export interface DishTableProps {
  rows: readonly DishRow[];
  loading?: boolean;
  onSelect?(row: DishRow): void;
  /** 0 件のときに表示する内容。 */
  empty?: ReactNode;
}

/**
 * レシピ一覧の表。エネルギー・PFC・原価は 1 人前。
 */
export function DishTable({ rows, loading, onSelect, empty }: DishTableProps) {
  const table = useTable({
    features,
    columns,
    data: rows as DishRow[],
    getRowId: (row) => row.id,
  });

  return (
    <DataTable
      table={table}
      label="レシピ一覧 (栄養価・原価は 1 人前)"
      loading={loading}
      onRowClick={onSelect}
      empty={empty}
      minW="0"
    />
  );
}
