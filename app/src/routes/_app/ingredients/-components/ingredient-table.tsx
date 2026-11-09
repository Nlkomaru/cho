import { Badge, Box, Text, chakra } from "@chakra-ui/react";
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
import type { Ingredient } from "@/domain/ingredient";
import { formatFixed, formatNumber } from "@/lib/format";

import { basisLabel, formatBasisPrice } from "./ingredient-form";

interface IngredientTableMeta {
  onSelect?(item: Ingredient): void;
}

const features = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { alphanumeric: sortFn_alphanumeric, basic: sortFn_basic },
  columnMeta: {} as DataTableColumnMeta,
  tableMeta: {} as IngredientTableMeta,
});
const columnHelper = createColumnHelper<typeof features, Ingredient>();

/** 表の見出しに書く基準量。これと違う材料 (100mL・1個) だけ行に基準量を添える。 */
const isDefaultBasis = (item: Ingredient) =>
  item.baseUnit === "g" && item.nutritionBasisAmount === 100;

/** 見出しの後ろに小さく添える基準量 ("(100g)")。狭い画面では名前の列を広く取るため省く。 */
const headerBasis = (basis: string) => (
  <chakra.span color="fg.subtle" fontWeight="400" ms="1" hideBelow="md">
    ({basis})
  </chakra.span>
);

const grams = (value: number | null | undefined) => (value == null ? <Dash /> : formatFixed(value));

const columns = columnHelper.columns([
  columnHelper.accessor("name", {
    header: ({ column }) => (
      <SortableHeader
        label="品目名"
        sorted={column.getIsSorted()}
        onToggle={column.getToggleSortingHandler()}
      />
    ),
    cell: ({ row, table }) => (
      <Box minW="0">
        {/* 行クリックと同じ操作をキーボードからも行えるよう、名前を本物のボタンにする */}
        <chakra.button
          type="button"
          onClick={() => table.options.meta?.onSelect?.(row.original)}
          color="fg.strong"
          fontWeight="500"
          textAlign="start"
          cursor="pointer"
          borderRadius="l1"
          _hover={{ textDecoration: "underline", textUnderlineOffset: "3px" }}
          _focusVisible={{ outline: "2px solid {colors.navy.900}", outlineOffset: "2px" }}
        >
          {row.original.name}
        </chakra.button>
        {isDefaultBasis(row.original) ? null : (
          <Text textStyle="caption" color="fg.subtle">
            {basisLabel(row.original)}
          </Text>
        )}
      </Box>
    ),
  }),
  columnHelper.accessor((row) => row.nutritionPerBasis.caloriesKcal, {
    id: "kcal",
    header: ({ column }) => (
      <SortableHeader
        label={
          <>
            <chakra.span hideFrom="md">kcal</chakra.span>
            <chakra.span hideBelow="md">エネルギー{headerBasis("100g")}</chakra.span>
          </>
        }
        align="end"
        sorted={column.getIsSorted()}
        onToggle={column.getToggleSortingHandler()}
      />
    ),
    cell: ({ getValue }) => (
      <>
        {formatNumber(getValue(), 0)}
        <chakra.span color="fg.subtle" ms="1" textStyle="caption" hideBelow="md">
          kcal
        </chakra.span>
      </>
    ),
    meta: { numeric: true, width: { base: "88px", md: "144px" } },
  }),
  columnHelper.accessor((row) => row.nutritionPerBasis.proteinG, {
    id: "p",
    header: "P",
    cell: ({ getValue }) => grams(getValue()),
    meta: { numeric: true, width: "72px", hideBelow: "md" },
  }),
  columnHelper.accessor((row) => row.nutritionPerBasis.fatG, {
    id: "f",
    header: "F",
    cell: ({ getValue }) => grams(getValue()),
    meta: { numeric: true, width: "72px", hideBelow: "md" },
  }),
  columnHelper.accessor((row) => row.nutritionPerBasis.carbohydrateG, {
    id: "c",
    header: "C",
    cell: ({ getValue }) => grams(getValue()),
    meta: { numeric: true, width: "72px", hideBelow: "md" },
  }),
  columnHelper.accessor((row) => row.nutritionPerBasis.fiberG, {
    id: "fiber",
    header: "食物繊維",
    cell: ({ getValue }) => grams(getValue()),
    meta: { numeric: true, width: "88px", hideBelow: "lg" },
  }),
  columnHelper.accessor((row) => row.nutritionPerBasis.saltEquivalentG, {
    id: "salt",
    header: "食塩",
    cell: ({ getValue }) => grams(getValue()),
    meta: { numeric: true, width: "72px", hideBelow: "lg" },
  }),
  columnHelper.accessor((row) => row.latestUnitPriceYen ?? undefined, {
    id: "price",
    header: ({ column }) => (
      <SortableHeader
        label={<>単価{headerBasis("100g")}</>}
        align="end"
        sorted={column.getIsSorted()}
        onToggle={column.getToggleSortingHandler()}
      />
    ),
    cell: ({ getValue, row }) => {
      const price = formatBasisPrice(getValue());
      if (!price)
        return row.original.inventiaItemId ? (
          <Text as="span" textStyle="caption" color="fg.subtle">
            未登録
          </Text>
        ) : (
          <Dash />
        );
      return (
        <>
          {price}
          {isDefaultBasis(row.original) ? null : (
            <chakra.span color="fg.subtle" ms="0.5" textStyle="caption">
              /{formatNumber(row.original.nutritionBasisAmount)}
              {row.original.baseUnit}
            </chakra.span>
          )}
        </>
      );
    },
    sortUndefined: "last",
    meta: { numeric: true, width: { base: "72px", md: "104px" } },
  }),
  columnHelper.accessor("inventiaItemId", {
    header: "Inventia",
    cell: ({ getValue }) => (getValue() ? <Badge colorPalette="green">連携</Badge> : <Dash />),
    enableSorting: false,
    meta: { width: "96px", hideBelow: "md" },
  }),
]);

export interface IngredientTableProps {
  items: readonly Ingredient[];
  loading?: boolean;
  selectedId?: string | null;
  onSelect?(item: Ingredient): void;
  /** 0 件のときに表示する内容。 */
  empty?: ReactNode;
}

/**
 * 材料の一覧表。栄養価・単価は各材料の基準量あたり。
 */
export function IngredientTable({
  items,
  loading,
  selectedId,
  onSelect,
  empty,
}: IngredientTableProps) {
  const table = useTable({
    features,
    columns,
    data: items as Ingredient[],
    getRowId: (row) => row.id,
    meta: { onSelect },
  });

  return (
    <DataTable
      table={table}
      label="材料一覧 (栄養価・単価は基準量あたり)"
      loading={loading}
      selectedRowId={selectedId ?? undefined}
      onRowClick={onSelect}
      empty={empty}
      minW="0"
    />
  );
}
