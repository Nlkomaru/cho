import { Box, Stack, Text } from "@chakra-ui/react";
import { createColumnHelper, tableFeatures, useTable } from "@tanstack/react-table";
import { useMemo } from "react";

import { SubHeading } from "@/components/layout/section";
import { DataTable, type DataTableColumnMeta, Dash } from "@/components/ui/data-table";
import { StatGroup } from "@/components/ui/stat-group";
import { formatDateKey } from "@/lib/format";

import { McpActivityChart } from "./mcp-activity-chart";
import {
  aggregateByTokenTool,
  aggregateByTool,
  computeDailyActivity,
  getTokenStatus,
  mcpToolLabels,
  type McpTokenSummary,
  type McpTokenToolRow,
  type McpTokenUsage,
  type McpToolAggregate,
} from "./mcp-model";

export interface McpUsageProps {
  usage: readonly McpTokenUsage[];
  tokens: readonly McpTokenSummary[];
  now: Date;
}

const features = tableFeatures({ columnMeta: {} as DataTableColumnMeta });

const toolHelper = createColumnHelper<typeof features, McpToolAggregate>();
const tokenToolHelper = createColumnHelper<typeof features, McpTokenToolRow>();

function ToolName({ name }: { name: McpToolAggregate["toolName"] }) {
  return (
    <Box minW="0">
      <Text textStyle="body.sm" color="fg.strong">
        {mcpToolLabels[name] ?? name}
      </Text>
      <Text fontFamily="mono" fontSize="12px" lineHeight="16px" color="fg.subtle">
        {name}
      </Text>
    </Box>
  );
}

const count = (value: number) => value.toLocaleString("ja-JP");
const day = (value: string | null) => (value ? formatDateKey(value) : <Dash />);

const toolColumns = toolHelper.columns([
  toolHelper.accessor("toolName", {
    header: "ツール",
    cell: ({ getValue }) => <ToolName name={getValue()} />,
  }),
  toolHelper.accessor("totalCalls", {
    header: "呼び出し",
    cell: ({ getValue }) => count(getValue()),
    meta: { numeric: true, width: "112px" },
  }),
  toolHelper.accessor("lastUsedUtcDate", {
    header: "最終利用 (UTC)",
    cell: ({ getValue }) => day(getValue()),
    meta: { numeric: true, width: "136px", hideBelow: "md" },
  }),
]);

const tokenToolColumns = tokenToolHelper.columns([
  tokenToolHelper.accessor("tokenName", {
    header: "キー",
    cell: ({ getValue }) => (
      <Text textStyle="body.sm" color="fg.strong" fontWeight="500">
        {getValue()}
      </Text>
    ),
  }),
  tokenToolHelper.accessor("toolName", {
    header: "ツール",
    cell: ({ getValue }) => <ToolName name={getValue()} />,
  }),
  tokenToolHelper.accessor("totalCalls", {
    header: "呼び出し",
    cell: ({ getValue }) => count(getValue()),
    meta: { numeric: true, width: "112px" },
  }),
  tokenToolHelper.accessor("lastUsedUtcDate", {
    header: "最終利用 (UTC)",
    cell: ({ getValue }) => day(getValue()),
    meta: { numeric: true, width: "136px", hideBelow: "md" },
  }),
]);

/**
 * MCP の利用状況。合計、日別の推移、ツール別・キー別の内訳。
 */
export function McpUsage({ usage, tokens, now }: McpUsageProps) {
  const daily = useMemo(() => computeDailyActivity(usage, now), [usage, now]);
  const byTool = useMemo(() => aggregateByTool(usage), [usage]);
  const byTokenTool = useMemo(() => aggregateByTokenTool(usage), [usage]);

  const totalCalls = usage.reduce((sum, token) => sum + token.totalCalls, 0);
  const last30 = daily.reduce((sum, entry) => sum + entry.callCount, 0);
  const activeKeys = tokens.filter((token) => getTokenStatus(token, now) === "active").length;
  const usedTools = byTool.filter((tool) => tool.totalCalls > 0).length;

  const toolTable = useTable({
    features,
    columns: toolColumns,
    data: byTool,
    getRowId: (row) => row.toolName,
  });
  const tokenToolTable = useTable({
    features,
    columns: tokenToolColumns,
    data: byTokenTool,
    getRowId: (row) => row.id,
  });

  return (
    <Stack gap="10">
      <StatGroup
        label="利用状況の合計"
        items={[
          { label: "総呼び出し", value: count(totalCalls), unit: "回" },
          { label: "直近30日", value: count(last30), unit: "回" },
          { label: "有効なキー", value: count(activeKeys), unit: "件" },
          { label: "利用中のツール", value: `${usedTools}`, unit: `/ ${byTool.length}` },
        ]}
      />

      <Box>
        <SubHeading trailing="UTC">日別の呼び出し</SubHeading>
        <Box mt="4">
          <McpActivityChart days={daily} />
        </Box>
      </Box>

      <Box>
        <SubHeading>ツール別</SubHeading>
        <Box mt="2">
          <DataTable table={toolTable} label="ツール別の呼び出し数" density="sm" minW="320px" />
        </Box>
      </Box>

      <Box>
        <SubHeading>キー別</SubHeading>
        <Box mt="2">
          <DataTable
            table={tokenToolTable}
            label="キー別・ツール別の呼び出し数"
            density="sm"
            minW="320px"
            empty={
              <Box py="8" textAlign="center" textStyle="body.sm" color="fg.muted">
                利用記録はありません
              </Box>
            }
          />
        </Box>
      </Box>
    </Stack>
  );
}
