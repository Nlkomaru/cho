import { Box, Skeleton, Table as ChakraTable, chakra } from "@chakra-ui/react";
import type { RowData, Table, TableFeatures } from "@tanstack/react-table";
import { FlexRender } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown, ExternalLink } from "lucide-react";
import type { MouseEvent, ReactNode } from "react";

/**
 * 列定義の `meta` に渡す表示設定。
 *
 * @example columnHelper.accessor("kcal", { header: "エネルギー", meta: { align: "end", numeric: true } })
 */
export interface DataTableColumnMeta {
  align?: "start" | "end";
  /** 列幅 ("96px" など)。画面幅で変えるときは `{ base: "72px", md: "144px" }`。 */
  width?: string | { base?: string; md?: string; lg?: string };
  /** この幅より狭い画面では列を隠す。 */
  hideBelow?: "md" | "lg";
  /** 右寄せ + 桁揃え + 折り返しなし。 */
  numeric?: boolean;
}

export interface DataTableProps<TFeatures extends TableFeatures, TData extends RowData> {
  table: Table<TFeatures, TData>;
  /** 表の名前。視覚的に隠した caption になる。 */
  label: string;
  /** 行全体をクリック可能にする。先頭セルには本物のリンクも置くこと (キーボード操作用)。 */
  onRowClick?(row: TData): void;
  selectedRowId?: string;
  loading?: boolean;
  /** 行が 0 件のときに全幅で表示する内容 (EmptyState)。 */
  empty?: ReactNode;
  density?: "md" | "sm";
  stickyHeader?: boolean;
  /** 横スクロールさせる最小幅。 */
  minW?: string;
}

const metaOf = (meta: unknown): DataTableColumnMeta => (meta ?? {}) as DataTableColumnMeta;

const hideStyles = (hideBelow: DataTableColumnMeta["hideBelow"]) =>
  hideBelow ? { display: { base: "none", [hideBelow]: "table-cell" } } : {};

const isInteractiveTarget = (event: MouseEvent) => {
  const target = event.target as HTMLElement | null;
  return Boolean(target?.closest("a, button, input, select, textarea, label, [role=button]"));
};

/**
 * TanStack Table の表示部分。外枠・縞模様なしで、見出し下に紺の細罫、行は細罫で区切る。
 */
export function DataTable<TFeatures extends TableFeatures, TData extends RowData>({
  table,
  label,
  onRowClick,
  selectedRowId,
  loading,
  empty,
  density = "md",
  stickyHeader,
  minW = "640px",
}: DataTableProps<TFeatures, TData>) {
  const headerGroups = table.getHeaderGroups();
  const rows = table.getRowModel().rows;
  const columnCount = table.getAllLeafColumns().length;

  return (
    <Box
      // 選択行の印 (左の外側 8px) が切れないよう、スクロール領域だけ左右に広げる
      mx="-2"
      px="2"
      overflowX="auto"
      css={{ WebkitOverflowScrolling: "touch" }}
    >
      <ChakraTable.Root
        size={density}
        interactive={Boolean(onRowClick) && !loading}
        stickyHeader={stickyHeader}
        minW={minW}
        aria-busy={loading || undefined}
      >
        <ChakraTable.Caption>{label}</ChakraTable.Caption>
        <ChakraTable.Header>
          {headerGroups.map((group) => (
            <ChakraTable.Row key={group.id}>
              {group.headers.map((header, index) => {
                const meta = metaOf(header.column.columnDef.meta);
                const end = meta.align === "end" || meta.numeric;
                const sorted = (
                  header.column as { getIsSorted?: () => false | "asc" | "desc" }
                ).getIsSorted?.();
                return (
                  <ChakraTable.ColumnHeader
                    key={header.id}
                    colSpan={header.colSpan}
                    textAlign={end ? "end" : "start"}
                    w={meta.width}
                    aria-sort={
                      sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : undefined
                    }
                    {...hideStyles(meta.hideBelow)}
                    {...(index === 0 ? stickyFirst : {})}
                  >
                    {header.isPlaceholder ? null : <FlexRender header={header} />}
                  </ChakraTable.ColumnHeader>
                );
              })}
            </ChakraTable.Row>
          ))}
        </ChakraTable.Header>
        <ChakraTable.Body>
          {loading
            ? Array.from({ length: 5 }, (_, rowIndex) => (
                <ChakraTable.Row key={`skeleton-${rowIndex}`}>
                  {table.getAllLeafColumns().map((column, index) => {
                    const meta = metaOf(column.columnDef.meta);
                    return (
                      <ChakraTable.Cell key={column.id} {...hideStyles(meta.hideBelow)}>
                        <Skeleton
                          h="3.5"
                          w={index === 0 ? "70%" : "48px"}
                          ms={meta.align === "end" || meta.numeric ? "auto" : undefined}
                        />
                      </ChakraTable.Cell>
                    );
                  })}
                </ChakraTable.Row>
              ))
            : null}
          {!loading && rows.length === 0 ? (
            <ChakraTable.Row _hover={{ bg: "transparent" }} cursor="default">
              <ChakraTable.Cell colSpan={columnCount} p="0" borderBottomWidth="0" h="auto">
                {empty ?? (
                  <Box py="10" textAlign="center" color="fg.muted" textStyle="body.sm">
                    データがありません
                  </Box>
                )}
              </ChakraTable.Cell>
            </ChakraTable.Row>
          ) : null}
          {!loading
            ? rows.map((row) => (
                <ChakraTable.Row
                  key={row.id}
                  data-selected={row.id === selectedRowId ? "" : undefined}
                  onClick={
                    onRowClick
                      ? (event: MouseEvent) => {
                          if (isInteractiveTarget(event)) return;
                          if (window.getSelection()?.isCollapsed === false) return;
                          onRowClick(row.original);
                        }
                      : undefined
                  }
                >
                  {row.getAllCells().map((cell, index) => {
                    const meta = metaOf(cell.column.columnDef.meta);
                    const end = meta.align === "end" || meta.numeric;
                    return (
                      <ChakraTable.Cell
                        key={cell.id}
                        textAlign={end ? "end" : "start"}
                        whiteSpace={meta.numeric ? "nowrap" : undefined}
                        fontVariantNumeric={meta.numeric ? "tabular-nums" : undefined}
                        {...hideStyles(meta.hideBelow)}
                        {...(index === 0 ? stickyFirst : {})}
                      >
                        <FlexRender cell={cell} />
                      </ChakraTable.Cell>
                    );
                  })}
                </ChakraTable.Row>
              ))
            : null}
        </ChakraTable.Body>
      </ChakraTable.Root>
    </Box>
  );
}

/** 狭い画面では先頭列を左に固定する。 */
const stickyFirst = {
  position: { base: "sticky", md: "static" },
  insetInlineStart: "0",
  zIndex: "1",
  bg: "inherit",
} as const;

export interface SortableHeaderProps {
  label: ReactNode;
  sorted: false | "asc" | "desc";
  onToggle?: (event: unknown) => void;
  align?: "start" | "end";
}

/**
 * 並べ替えできる列見出し。`aria-sort` は DataTable が th に付ける。
 */
export function SortableHeader({ label, sorted, onToggle, align = "start" }: SortableHeaderProps) {
  const Icon = sorted === "asc" ? ArrowUp : sorted === "desc" ? ArrowDown : ArrowUpDown;
  const icon = (
    <Icon
      size={14}
      strokeWidth={1.75}
      aria-hidden="true"
      style={{ display: "inline", verticalAlign: "-2px" }}
    />
  );
  return (
    <chakra.button
      type="button"
      onClick={onToggle}
      display="inline"
      whiteSpace="nowrap"
      color={sorted ? "fg.strong" : "inherit"}
      font="inherit"
      cursor="pointer"
      borderRadius="l1"
      mx="-1"
      px="1"
      _hover={{ color: "fg.strong", bg: "navy.100" }}
      _focusVisible={{ outline: "2px solid {colors.navy.900}", outlineOffset: "2px" }}
    >
      {/* inline-flex だとアイコンがベースラインになり、ほかの見出しとずれる */}
      {align === "end" ? <>{icon} </> : null}
      {label}
      {align === "end" ? null : <> {icon}</>}
    </chakra.button>
  );
}

/** 値が無いことを示す "—"。 */
export function Dash() {
  return (
    <chakra.span color="fg.subtle" aria-label="なし">
      —
    </chakra.span>
  );
}

export interface InventiaLinkProps {
  itemId: string | null | undefined;
  baseUrl?: string;
}

/**
 * Inventia の品目ページへのリンク。未連携なら "—"。
 */
export function InventiaIconLink({
  itemId,
  baseUrl = "https://inventia.nikomaru.dev",
}: InventiaLinkProps) {
  if (!itemId) return <Dash />;
  const href = `${baseUrl.replace(/\/+$/, "")}/inventory/items/${encodeURIComponent(itemId)}`;
  return (
    <chakra.a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Inventia で開く (${itemId})`}
      display="inline-flex"
      alignItems="center"
      justifyContent="center"
      boxSize="8"
      borderRadius="full"
      color="fg.muted"
      _hover={{ color: "fg.strong", bg: "navy.100" }}
      _focusVisible={{ outline: "2px solid {colors.navy.900}", outlineOffset: "2px" }}
    >
      <ExternalLink size={16} strokeWidth={1.75} aria-hidden="true" />
    </chakra.a>
  );
}
