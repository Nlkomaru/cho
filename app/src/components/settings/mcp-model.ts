import { z } from "zod";

import { mcpToolNameSchema, mcpToolNames, type McpToolName } from "@/domain/mcp";

export const mcpToolLabels: Record<McpToolName, string> = {
  list_ingredients: "材料一覧",
  get_ingredient: "材料取得",
  create_ingredient: "材料登録",
  update_ingredient: "材料更新",
  delete_ingredient: "材料削除",
  search_inventia_items: "Inventia 品目検索",
  link_inventia_item: "Inventia 品目の連携",
  get_ingredient_stock: "Inventia 在庫取得",
  list_recipes: "レシピ一覧",
  get_recipe: "レシピ取得",
  create_recipe: "レシピ登録",
  update_recipe: "レシピ更新",
  delete_recipe: "レシピ削除",
  upload_image: "画像アップロード",
  create_image_upload: "画像アップロード URL 発行",
  set_recipe_images: "レシピ画像設定",
  calculate_purchase_list: "買い物リスト作成",
  list_meals: "食事一覧",
  get_meal: "食事取得",
  record_meal: "食事記録",
  update_meal: "食事更新",
  delete_meal: "食事削除",
};

export const mcpTokenSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  prefix: z.string(),
  allowedTools: z.array(mcpToolNameSchema),
  createdAt: z.string(),
  expiresAt: z.string().nullable(),
  revokedAt: z.string().nullable(),
  lastUsedAt: z.string().nullable(),
});

export type McpTokenSummary = z.infer<typeof mcpTokenSummarySchema>;

export const mcpDailyUsageSchema = z.object({
  toolName: mcpToolNameSchema,
  utcDate: z.string(),
  callCount: z.number(),
});

export type McpDailyUsage = z.infer<typeof mcpDailyUsageSchema>;

export const mcpToolUsageSchema = z.object({
  toolName: mcpToolNameSchema,
  totalCalls: z.number(),
  daily: z.array(mcpDailyUsageSchema),
});

export type McpToolUsage = z.infer<typeof mcpToolUsageSchema>;

export const mcpTokenUsageSchema = z.object({
  tokenId: z.string(),
  tokenName: z.string(),
  totalCalls: z.number(),
  tools: z.array(mcpToolUsageSchema),
});

export type McpTokenUsage = z.infer<typeof mcpTokenUsageSchema>;

export const tokenListResponseSchema = z.object({ tokens: z.array(mcpTokenSummarySchema) });
export const usageResponseSchema = z.object({ usage: z.array(mcpTokenUsageSchema) });

export const issuedTokenResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  prefix: z.string(),
  allowedTools: z.array(mcpToolNameSchema),
  createdAt: z.string(),
  expiresAt: z.string().nullable(),
  secret: z.string().regex(/^cho_mcp_[0-9a-f]{64}$/),
});

export interface McpIssuedSecret {
  name: string;
  prefix: string;
  secret: string;
}

export type McpManagementState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "ready";
      tokens: McpTokenSummary[];
      usage: McpTokenUsage[];
      issuedSecret?: McpIssuedSecret | null;
    };

export type McpTokenStatus = "active" | "expired" | "revoked";

export function getTokenStatus(token: McpTokenSummary, now: Date): McpTokenStatus {
  if (token.revokedAt) return "revoked";
  if (token.expiresAt && new Date(token.expiresAt).getTime() <= now.getTime()) return "expired";
  return "active";
}

/** UTC 日付 "2026-11-09" を "11/09" にする。 */
export function formatUtcDay(utcDate: string): string {
  const [, month, day] = utcDate.split("-");
  return month && day ? `${month}/${day}` : utcDate;
}

export interface McpDailyActivity {
  utcDate: string;
  callCount: number;
}

/** 直近 30 UTC 日の日別呼び出し数 (古い順)。 */
export function computeDailyActivity(usage: readonly McpTokenUsage[], now: Date, days = 30) {
  const end = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const counts = new Map<string, number>();
  for (let index = days - 1; index >= 0; index--) {
    counts.set(new Date(end - index * 86_400_000).toISOString().slice(0, 10), 0);
  }
  for (const token of usage) {
    for (const tool of token.tools) {
      for (const day of tool.daily) {
        const current = counts.get(day.utcDate);
        if (current !== undefined) counts.set(day.utcDate, current + day.callCount);
      }
    }
  }
  return [...counts].map(([utcDate, callCount]): McpDailyActivity => ({ utcDate, callCount }));
}

export interface McpToolAggregate {
  toolName: McpToolName;
  totalCalls: number;
  lastUsedUtcDate: string | null;
}

const latestDay = (daily: readonly McpDailyUsage[]) =>
  daily.reduce<string | null>(
    (latest, day) =>
      day.callCount > 0 && (!latest || day.utcDate > latest) ? day.utcDate : latest,
    null,
  );

/** ツールごとの合計。呼び出しの多い順。 */
export function aggregateByTool(usage: readonly McpTokenUsage[]): McpToolAggregate[] {
  return mcpToolNames
    .map((toolName) => {
      const tools = usage.flatMap((token) => token.tools.filter((t) => t.toolName === toolName));
      const lastUsed = latestDay(tools.flatMap((tool) => tool.daily));
      return {
        toolName,
        totalCalls: tools.reduce((sum, tool) => sum + tool.totalCalls, 0),
        lastUsedUtcDate: lastUsed,
      };
    })
    .sort((a, b) => b.totalCalls - a.totalCalls);
}

export interface McpTokenToolRow {
  id: string;
  tokenName: string;
  toolName: McpToolName;
  totalCalls: number;
  lastUsedUtcDate: string | null;
}

/** キー × ツールの合計。 */
export function aggregateByTokenTool(usage: readonly McpTokenUsage[]): McpTokenToolRow[] {
  return usage.flatMap((token) =>
    [...token.tools]
      .sort((a, b) => b.totalCalls - a.totalCalls)
      .map((tool) => ({
        id: `${token.tokenId}:${tool.toolName}`,
        tokenName: token.tokenName,
        toolName: tool.toolName,
        totalCalls: tool.totalCalls,
        lastUsedUtcDate: latestDay(tool.daily),
      })),
  );
}

const quoteShellValue = (value: string) => `'${value.replaceAll("'", `'"'"'`)}'`;

export function buildHermesCommand(endpointUrl: string, token: string) {
  return [
    `hermes config set mcp_servers.cho.url ${quoteShellValue(endpointUrl)}`,
    `hermes config set mcp_servers.cho.headers.Authorization ${quoteShellValue(`Bearer ${token}`)}`,
    "hermes mcp test cho",
  ].join("\n");
}

export function buildClientConfigJson(endpointUrl: string, token: string) {
  return JSON.stringify(
    { mcpServers: { cho: { url: endpointUrl, headers: { Authorization: `Bearer ${token}` } } } },
    null,
    2,
  );
}

export function buildCurlCommand(endpointUrl: string, token: string) {
  return [
    `curl -X POST ${quoteShellValue(endpointUrl)} \\`,
    `  -H ${quoteShellValue(`Authorization: Bearer ${token}`)} \\`,
    `  -H 'Content-Type: application/json' \\`,
    `  -H 'Accept: application/json, text/event-stream' \\`,
    `  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'`,
  ].join("\n");
}

export const MCP_TOKEN_PLACEHOLDER = "<cho_mcp_キー>";
