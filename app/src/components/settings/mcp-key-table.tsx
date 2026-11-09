import { Badge, Box, Text, chakra } from "@chakra-ui/react";
import { createColumnHelper, tableFeatures, useTable } from "@tanstack/react-table";
import { KeyRound } from "lucide-react";
import { useMemo, useState } from "react";

import { mcpToolNames } from "@/domain/mcp";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DataTable, type DataTableColumnMeta, Dash } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Tooltip } from "@/components/ui/tooltip";
import { formatDateNumeric, formatDateTimeNumeric } from "@/lib/format";

import {
  getTokenStatus,
  mcpToolLabels,
  type McpTokenStatus,
  type McpTokenSummary,
} from "./mcp-model";

export interface McpKeyTableProps {
  tokens: readonly McpTokenSummary[];
  now: Date;
  /** 失効処理中のキー ID。 */
  revokingId?: string | null;
  /** 確認後に呼ばれる。完了したら Promise を解決する。 */
  onRevoke(tokenId: string): Promise<boolean> | void;
}

const features = tableFeatures({ columnMeta: {} as DataTableColumnMeta });
const columnHelper = createColumnHelper<typeof features, McpTokenSummary>();

const statusBadge: Record<McpTokenStatus, { label: string; palette: "green" | "amber" | "navy" }> =
  {
    active: { label: "有効", palette: "green" },
    expired: { label: "期限切れ", palette: "amber" },
    revoked: { label: "失効済み", palette: "navy" },
  };

function ToolsCell({ tools }: { tools: McpTokenSummary["allowedTools"] }) {
  if (tools.length === mcpToolNames.length) {
    return <Text textStyle="body.sm">すべて</Text>;
  }
  const labels = tools.map((tool) => mcpToolLabels[tool] ?? tool).join("、");
  return (
    <Tooltip content={labels}>
      <chakra.span
        tabIndex={0}
        textStyle="body.sm"
        display="block"
        maxW="220px"
        truncate
        borderRadius="l1"
        _focusVisible={{ outline: "2px solid {colors.navy.900}", outlineOffset: "2px" }}
      >
        {labels}
      </chakra.span>
    </Tooltip>
  );
}

/**
 * 発行済みのクライアントキー。有効なキーだけ失効できる (確認あり)。
 */
export function McpKeyTable({ tokens, now, revokingId, onRevoke }: McpKeyTableProps) {
  const [target, setTarget] = useState<McpTokenSummary | null>(null);

  const columns = useMemo(
    () =>
      columnHelper.columns([
        columnHelper.accessor("name", {
          header: "名前",
          cell: ({ row }) => (
            <Box minW="0">
              <Text textStyle="body.sm" color="fg.strong" fontWeight="500">
                {row.original.name}
              </Text>
              <Text fontFamily="mono" fontSize="12px" lineHeight="16px" color="fg.subtle">
                {row.original.prefix}…
              </Text>
            </Box>
          ),
        }),
        columnHelper.accessor("allowedTools", {
          header: "許可ツール",
          cell: ({ getValue }) => <ToolsCell tools={getValue()} />,
          meta: { hideBelow: "md" },
        }),
        columnHelper.accessor("createdAt", {
          header: "作成",
          cell: ({ getValue }) => formatDateNumeric(getValue()),
          meta: { numeric: true, hideBelow: "lg", width: "104px" },
        }),
        columnHelper.accessor("lastUsedAt", {
          header: "最終利用",
          cell: ({ getValue }) =>
            getValue() ? formatDateTimeNumeric(getValue()) : <Text color="fg.subtle">未使用</Text>,
          meta: { numeric: true, width: "148px", hideBelow: "md" },
        }),
        columnHelper.display({
          id: "status",
          header: "状態",
          cell: ({ row }) => {
            const status = getTokenStatus(row.original, now);
            const badge = statusBadge[status];
            const expiry =
              status === "active"
                ? row.original.expiresAt
                  ? `${formatDateNumeric(row.original.expiresAt)} まで`
                  : "無期限"
                : status === "expired"
                  ? formatDateNumeric(row.original.expiresAt)
                  : formatDateNumeric(row.original.revokedAt);
            return (
              <Box>
                <Badge colorPalette={badge.palette}>{badge.label}</Badge>
                <Text
                  textStyle="caption"
                  color="fg.subtle"
                  mt="1"
                  fontVariantNumeric="tabular-nums"
                >
                  {expiry}
                </Text>
              </Box>
            );
          },
          meta: { width: "132px" },
        }),
        columnHelper.display({
          id: "actions",
          // srOnly は absolute 配置なので、横スクロールの外にはみ出さないよう relative で包む
          header: () => (
            <chakra.span position="relative" display="block">
              <chakra.span srOnly>操作</chakra.span>
            </chakra.span>
          ),
          cell: ({ row }) =>
            getTokenStatus(row.original, now) === "active" ? (
              <Button
                size="xs"
                // 行ごとに赤を並べないよう普段は控えめにし、ポインターを当てたときだけ赤にする
                variant="ghost"
                color="fg.muted"
                _hover={{ color: "red.700", bg: "red.50" }}
                _active={{ bg: "red.100" }}
                loading={revokingId === row.original.id}
                onClick={() => setTarget(row.original)}
                aria-label={`${row.original.name} を失効`}
              >
                失効
              </Button>
            ) : (
              <Dash />
            ),
          meta: { align: "end", width: "88px" },
        }),
      ]),
    [now, revokingId],
  );

  const table = useTable({
    features,
    columns,
    data: tokens as McpTokenSummary[],
    getRowId: (row) => row.id,
  });

  const confirm = async () => {
    if (!target) return;
    const result = await onRevoke(target.id);
    if (result !== false) setTarget(null);
  };

  return (
    <>
      <DataTable
        table={table}
        label="発行済みキー"
        minW="320px"
        empty={
          <EmptyState
            size="sm"
            icon={<KeyRound strokeWidth={1.75} />}
            title="発行済みのキーはありません"
          />
        }
      />
      <ConfirmDialog
        open={target !== null}
        onOpenChange={(open) => {
          if (!open && !revokingId) setTarget(null);
        }}
        title={`「${target?.name ?? ""}」を失効しますか？`}
        description="このキーを使っているクライアントは接続できなくなります。元には戻せません。"
        confirmLabel="失効する"
        busy={Boolean(revokingId)}
        onConfirm={() => void confirm()}
      />
    </>
  );
}
