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
import type { Food } from "@/domain/ingredient";
import { formatFixed, formatNumber, formatYen } from "@/lib/format";

interface FoodTableMeta {
  onSelect?(item: Food): void;
}

const features = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { alphanumeric: sortFn_alphanumeric, basic: sortFn_basic },
  columnMeta: {} as DataTableColumnMeta,
  tableMeta: {} as FoodTableMeta,
});
const columnHelper = createColumnHelper<typeof features, Food>();

const grams = (value: number | null | undefined) => (value == null ? <Dash /> : formatFixed(value));

const columns = columnHelper.columns([
  columnHelper.accessor("name", {
    header: ({ column }) => (
      <SortableHeader
        label="食品名"
        sorted={column.getIsSorted()}
        onToggle={column.getToggleSortingHandler()}
      />
    ),
    cell: ({ row, table }) => (
      <Box minW="0">
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
        <Text textStyle="caption" color="fg.subtle">
          {row.original.servingLabel}
        </Text>
      </Box>
    ),
  }),
  columnHelper.accessor((row) => row.category ?? "", {
    id: "category",
    header: ({ column }) => (
      <SortableHeader
        label="カテゴリ"
        sorted={column.getIsSorted()}
        onToggle={column.getToggleSortingHandler()}
      />
    ),
    cell: ({ row }) =>
      row.original.category ? <Badge variant="subtle">{row.original.category}</Badge> : <Dash />,
    meta: { width: "120px", hideBelow: "md" },
  }),
  columnHelper.accessor((row) => row.nutrition.caloriesKcal, {
    id: "kcal",
    header: ({ column }) => (
      <SortableHeader
        label="エネルギー"
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
    meta: { numeric: true, width: { base: "88px", md: "128px" } },
  }),
  columnHelper.accessor((row) => row.nutrition.proteinG, {
    id: "p",
    header: "P",
    cell: ({ getValue }) => grams(getValue()),
    meta: { numeric: true, width: "72px", hideBelow: "md" },
  }),
  columnHelper.accessor((row) => row.nutrition.fatG, {
    id: "f",
    header: "F",
    cell: ({ getValue }) => grams(getValue()),
    meta: { numeric: true, width: "72px", hideBelow: "md" },
  }),
  columnHelper.accessor((row) => row.nutrition.carbohydrateG, {
    id: "c",
    header: "C",
    cell: ({ getValue }) => grams(getValue()),
    meta: { numeric: true, width: "72px", hideBelow: "md" },
  }),
  columnHelper.accessor((row) => row.nutrition.fiberG, {
    id: "fiber",
    header: "食物繊維",
    cell: ({ getValue }) => grams(getValue()),
    meta: { numeric: true, width: "88px", hideBelow: "lg" },
  }),
  columnHelper.accessor((row) => row.nutrition.saltEquivalentG, {
    id: "salt",
    header: "食塩",
    cell: ({ getValue }) => grams(getValue()),
    meta: { numeric: true, width: "72px", hideBelow: "lg" },
  }),
  columnHelper.accessor((row) => row.priceYen ?? undefined, {
    id: "price",
    header: ({ column }) => (
      <SortableHeader
        label="価格"
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
    meta: { numeric: true, width: { base: "72px", md: "96px" } },
  }),
]);

export interface FoodTableProps {
  items: readonly Food[];
  loading?: boolean;
  selectedId?: string | null;
  onSelect?(item: Food): void;
  /** 0 件のときに表示する内容。 */
  empty?: ReactNode;
}

/** 定番食品の一覧表。栄養価・価格は 1食分あたり。 */
export function FoodTable({ items, loading, selectedId, onSelect, empty }: FoodTableProps) {
  const table = useTable({
    features,
    columns,
    data: items as Food[],
    getRowId: (row) => row.id,
    meta: { onSelect },
  });

  return (
    <DataTable
      table={table}
      label="定番食品一覧 (栄養価・価格は1食分あたり)"
      loading={loading}
      selectedRowId={selectedId ?? undefined}
      onRowClick={onSelect}
      empty={empty}
      minW="0"
    />
  );
}
