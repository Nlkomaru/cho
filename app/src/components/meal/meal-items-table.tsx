import { Box, chakra } from "@chakra-ui/react";
import { Link } from "@tanstack/react-router";
import { createColumnHelper, tableFeatures, useTable } from "@tanstack/react-table";

import { DataTable, type DataTableColumnMeta, Dash } from "@/components/ui/data-table";
import { formatFixed, formatNumber, formatYen } from "@/lib/format";

import type { MealItem } from "./meal-shared";

const features = tableFeatures({ columnMeta: {} as DataTableColumnMeta });
const columnHelper = createColumnHelper<typeof features, MealItem>();

const estimationName: Record<NonNullable<MealItem["estimationSource"]>, string | null> = {
  recipe: "レシピ",
  ingredient: "材料",
  ai: "AI推定",
  manual: null,
  unknown: null,
};

const grams = (value: number | null | undefined) => (value == null ? <Dash /> : formatFixed(value));

const columns = columnHelper.columns([
  columnHelper.accessor("name", {
    header: "品目",
    cell: ({ row }) => {
      const item = row.original;
      const notes = [
        item.estimationSource ? estimationName[item.estimationSource] : null,
        item.servingsFactor !== undefined && item.servingsFactor !== 1
          ? `${formatNumber(item.servingsFactor, 2)}倍`
          : null,
      ].filter(Boolean);
      return (
        <Box minW="0">
          {item.dishId ? (
            <chakra.span
              asChild
              color="fg.strong"
              fontWeight="500"
              _hover={{ textDecoration: "underline", textUnderlineOffset: "3px" }}
            >
              <Link to="/dishes/$dishId" params={{ dishId: item.dishId }}>
                {item.name}
              </Link>
            </chakra.span>
          ) : (
            <chakra.span color="fg.strong" fontWeight="500">
              {item.name}
            </chakra.span>
          )}
          {notes.length ? (
            <chakra.span display="block" textStyle="caption" color="fg.subtle">
              {notes.join(" · ")}
            </chakra.span>
          ) : null}
        </Box>
      );
    },
  }),
  columnHelper.accessor("priceYen", {
    header: "料金",
    cell: ({ getValue }) => (getValue() == null ? <Dash /> : formatYen(getValue())),
    meta: { numeric: true, width: "88px" },
  }),
  columnHelper.accessor((row) => row.nutrition?.caloriesKcal, {
    id: "kcal",
    header: "エネルギー",
    cell: ({ getValue }) =>
      getValue() == null ? (
        <Dash />
      ) : (
        <>
          {formatNumber(getValue(), 0)}
          <chakra.span color="fg.subtle" ms="1" textStyle="caption">
            kcal
          </chakra.span>
        </>
      ),
    meta: { numeric: true, width: "112px" },
  }),
  columnHelper.accessor((row) => row.nutrition?.proteinG, {
    id: "p",
    header: "P",
    cell: ({ getValue }) => grams(getValue()),
    meta: { numeric: true, width: "64px", hideBelow: "md" },
  }),
  columnHelper.accessor((row) => row.nutrition?.fatG, {
    id: "f",
    header: "F",
    cell: ({ getValue }) => grams(getValue()),
    meta: { numeric: true, width: "64px", hideBelow: "md" },
  }),
  columnHelper.accessor((row) => row.nutrition?.carbohydrateG, {
    id: "c",
    header: "C",
    cell: ({ getValue }) => grams(getValue()),
    meta: { numeric: true, width: "64px", hideBelow: "md" },
  }),
  columnHelper.accessor((row) => row.nutrition?.fiberG, {
    id: "fiber",
    header: "食物繊維",
    cell: ({ getValue }) => grams(getValue()),
    meta: { numeric: true, width: "80px", hideBelow: "lg" },
  }),
  columnHelper.accessor((row) => row.nutrition?.saltEquivalentG, {
    id: "salt",
    header: "食塩",
    cell: ({ getValue }) => grams(getValue()),
    meta: { numeric: true, width: "64px", hideBelow: "lg" },
  }),
]);

export interface MealItemsTableProps {
  items: readonly MealItem[];
}

/** 1 食の品目ごとの料金と栄養価。P/F/C 以降の単位は g。 */
export function MealItemsTable({ items }: MealItemsTableProps) {
  const table = useTable({
    features,
    columns,
    data: items as MealItem[],
    getRowId: (row, index) => row.id ?? String(index),
  });
  return <DataTable table={table} label="品目" minW="0" />;
}
