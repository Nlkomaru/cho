import { Badge, Box, Text, chakra } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  createColumnHelper,
  createSortedRowModel,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DataTable,
  type DataTableColumnMeta,
  Dash,
  SortableHeader,
} from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { formatFixed, formatNumber, formatYen } from "@/lib/format";

import { type IngredientRow, ingredientRows } from "../fixtures/food";

const features = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { alphanumeric: sortFn_alphanumeric, basic: sortFn_basic },
  columnMeta: {} as DataTableColumnMeta,
});
const columnHelper = createColumnHelper<typeof features, IngredientRow>();

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
    cell: ({ row }) => (
      <Box minW="0">
        <chakra.a
          href={`#${row.original.id}`}
          color="fg.strong"
          fontWeight="500"
          _hover={{ textDecoration: "underline", textUnderlineOffset: "3px" }}
        >
          {row.original.name}
        </chakra.a>
        <Text textStyle="caption" color="fg.subtle">
          {row.original.basis}
        </Text>
      </Box>
    ),
  }),
  columnHelper.accessor((row) => row.facts.caloriesKcal, {
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
        <chakra.span color="fg.subtle" ms="1" textStyle="caption">
          kcal
        </chakra.span>
      </>
    ),
    meta: { numeric: true, width: "120px" },
  }),
  columnHelper.accessor((row) => row.facts.proteinG, {
    id: "p",
    header: "P",
    cell: ({ getValue }) => grams(getValue()),
    meta: { numeric: true, hideBelow: "md", width: "72px" },
  }),
  columnHelper.accessor((row) => row.facts.fatG, {
    id: "f",
    header: "F",
    cell: ({ getValue }) => grams(getValue()),
    meta: { numeric: true, hideBelow: "md", width: "72px" },
  }),
  columnHelper.accessor((row) => row.facts.carbohydrateG, {
    id: "c",
    header: "C",
    cell: ({ getValue }) => grams(getValue()),
    meta: { numeric: true, hideBelow: "md", width: "72px" },
  }),
  columnHelper.accessor((row) => row.facts.saltEquivalentG, {
    id: "salt",
    header: "食塩",
    cell: ({ getValue }) => grams(getValue()),
    meta: { numeric: true, hideBelow: "lg", width: "72px" },
  }),
  columnHelper.accessor("unitPriceYen", {
    header: "単価",
    cell: ({ getValue }) => {
      const value = getValue();
      return value == null ? <Dash /> : formatYen(value);
    },
    meta: { numeric: true, width: "88px" },
  }),
  columnHelper.accessor("inventiaItemId", {
    header: "Inventia",
    cell: ({ getValue }) => (getValue() ? <Badge colorPalette="green">連携</Badge> : <Dash />),
    meta: { width: "96px" },
  }),
]);

interface ExampleProps {
  rows: readonly IngredientRow[];
  loading?: boolean;
  selectedRowId?: string;
}

function IngredientTable({ rows, loading, selectedRowId }: ExampleProps) {
  const table = useTable({
    features,
    columns,
    data: rows as IngredientRow[],
    getRowId: (row) => row.id,
  });
  return (
    <DataTable
      table={table}
      label="材料"
      loading={loading}
      selectedRowId={selectedRowId}
      onRowClick={() => undefined}
      empty={
        <EmptyState
          title="材料がありません"
          action={
            <Button variant="outline">
              <Plus />
              材料を追加
            </Button>
          }
        />
      }
    />
  );
}

const meta = {
  title: "Components/DataTable",
  component: IngredientTable,
  args: { rows: ingredientRows },
} satisfies Meta<typeof IngredientTable>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Loading: Story = { args: { loading: true } };

export const Empty: Story = { args: { rows: [] } };

export const SelectedRow: Story = { args: { selectedRowId: "carrot" } };

export const Narrow: Story = {
  globals: { viewport: { value: "mobile", isRotated: false } },
};
