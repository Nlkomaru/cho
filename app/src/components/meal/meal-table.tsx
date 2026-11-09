import { Box, chakra } from "@chakra-ui/react";
import {
  createColumnHelper,
  createSortedRowModel,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import { Link, useNavigate } from "@tanstack/react-router";
import { UtensilsCrossed } from "lucide-react";
import type { ReactNode } from "react";

import {
  DataTable,
  type DataTableColumnMeta,
  Dash,
  SortableHeader,
} from "@/components/ui/data-table";
import { formatDateJa, formatFixed, formatNumber, formatTime, formatYen } from "@/lib/format";

import { imageUrl, mealPlace, sourceName, timingName, type Meal } from "./meal-shared";

const features = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { alphanumeric: sortFn_alphanumeric, basic: sortFn_basic },
  columnMeta: {} as DataTableColumnMeta,
});
const columnHelper = createColumnHelper<typeof features, Meal>();

const grams = (value: number | null | undefined) => (value == null ? <Dash /> : formatFixed(value));

const columns = columnHelper.columns([
  columnHelper.accessor("eatenAt", {
    header: ({ column }) => (
      <SortableHeader
        label="日時"
        sorted={column.getIsSorted()}
        onToggle={column.getToggleSortingHandler()}
      />
    ),
    cell: ({ getValue }) => (
      <chakra.span whiteSpace="nowrap" fontVariantNumeric="tabular-nums" color="fg.muted">
        {formatDateJa(getValue())} {formatTime(getValue())}
      </chakra.span>
    ),
    sortFn: "alphanumeric",
    meta: { width: "152px" },
  }),
  columnHelper.accessor("sourceType", {
    header: "区分",
    cell: ({ row }) => (
      <chakra.span whiteSpace="nowrap">
        {row.original.mealTiming ? `${timingName[row.original.mealTiming]} · ` : ""}
        {sourceName[row.original.sourceType]}
      </chakra.span>
    ),
    enableSorting: false,
    meta: { width: "120px", hideBelow: "md" },
  }),
  columnHelper.accessor("title", {
    header: "料理名",
    cell: ({ row }) => (
      <Box display="flex" alignItems="center" gap="3" minW="0">
        <Box
          boxSize="8"
          flexShrink="0"
          bg="bg.muted"
          color="navy.400"
          overflow="hidden"
          display="flex"
          alignItems="center"
          justifyContent="center"
        >
          {row.original.imageIds[0] ? (
            <chakra.img
              src={imageUrl(row.original.imageIds[0])}
              alt=""
              w="full"
              h="full"
              objectFit="cover"
            />
          ) : (
            <UtensilsCrossed size={14} strokeWidth={1.75} aria-hidden="true" />
          )}
        </Box>
        <chakra.span
          color="fg.strong"
          fontWeight="500"
          _hover={{ textDecoration: "underline", textUnderlineOffset: "3px" }}
          asChild
        >
          <Link to="/meals/$mealId" params={{ mealId: row.original.id }}>
            {row.original.title}
          </Link>
        </chakra.span>
        {mealPlace(row.original) ? (
          <chakra.span textStyle="caption" color="fg.subtle" truncate>
            {mealPlace(row.original)}
          </chakra.span>
        ) : null}
      </Box>
    ),
    enableSorting: false,
  }),
  columnHelper.accessor((row) => row.totalPriceYen ?? -1, {
    id: "price",
    header: ({ column }) => (
      <SortableHeader
        label="料金"
        align="end"
        sorted={column.getIsSorted()}
        onToggle={column.getToggleSortingHandler()}
      />
    ),
    cell: ({ row }) =>
      row.original.totalPriceYen == null ? <Dash /> : formatYen(row.original.totalPriceYen),
    sortFn: "basic",
    meta: { numeric: true, width: "96px" },
  }),
  columnHelper.accessor((row) => row.totalNutrition?.caloriesKcal ?? -1, {
    id: "kcal",
    header: ({ column }) => (
      <SortableHeader
        label="エネルギー"
        align="end"
        sorted={column.getIsSorted()}
        onToggle={column.getToggleSortingHandler()}
      />
    ),
    cell: ({ row }) =>
      row.original.totalNutrition ? (
        <>
          {formatNumber(row.original.totalNutrition.caloriesKcal, 0)}
          <chakra.span color="fg.subtle" ms="1" textStyle="caption">
            kcal
          </chakra.span>
        </>
      ) : (
        <Dash />
      ),
    sortFn: "basic",
    meta: { numeric: true, width: "120px" },
  }),
  columnHelper.display({
    id: "pfc",
    header: "P / F / C",
    cell: ({ row }) => {
      const facts = row.original.totalNutrition;
      if (!facts) return <Dash />;
      const sep: ReactNode = (
        <chakra.span color="fg.subtle" mx="1">
          /
        </chakra.span>
      );
      return (
        <>
          {grams(facts.proteinG)}
          {sep}
          {grams(facts.fatG)}
          {sep}
          {grams(facts.carbohydrateG)}
          <chakra.span color="fg.subtle" ms="1" textStyle="caption">
            g
          </chakra.span>
        </>
      );
    },
    meta: { numeric: true, width: "184px", hideBelow: "lg" },
  }),
]);

export interface MealTableProps {
  meals: readonly Meal[];
  loading?: boolean;
  empty?: ReactNode;
}

/** 食事記録の表表示。行をクリックすると詳細へ移動する。 */
export function MealTable({ meals, loading, empty }: MealTableProps) {
  const navigate = useNavigate();
  const table = useTable({
    features,
    columns,
    data: meals as Meal[],
    getRowId: (row) => row.id,
    initialState: { sorting: [{ id: "eatenAt", desc: true }] },
  });
  return (
    <DataTable
      table={table}
      label="食事記録"
      loading={loading}
      empty={empty}
      minW="560px"
      onRowClick={(meal) => void navigate({ to: "/meals/$mealId", params: { mealId: meal.id } })}
    />
  );
}
