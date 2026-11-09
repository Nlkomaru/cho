import type { IntegrationSettings } from "@/components/settings/integration-settings";
import type { McpTokenSummary, McpTokenUsage } from "@/components/settings/mcp-model";
import type { McpToolName } from "@/domain/mcp";

export const fixedNow = () => new Date("2026-11-09T12:00:00.000Z");

export const buildToken = (overrides: Partial<McpTokenSummary> = {}): McpTokenSummary => ({
  id: "token-hermes",
  name: "Hermes",
  prefix: "cho_mcp_a1b2c3d4",
  allowedTools: [
    "list_ingredients",
    "create_ingredient",
    "update_ingredient",
    "delete_ingredient",
    "list_recipes",
    "create_recipe",
    "delete_recipe",
    "calculate_purchase_list",
    "record_meal",
  ],
  createdAt: "2026-11-01T00:00:00.000Z",
  expiresAt: "2026-12-01T00:00:00.000Z",
  revokedAt: null,
  lastUsedAt: "2026-11-09T10:30:00.000Z",
  ...overrides,
});

export const tokens: McpTokenSummary[] = [
  buildToken(),
  buildToken({
    id: "token-sync",
    name: "レシピ同期バッチ",
    prefix: "cho_mcp_e5f6a7b8",
    allowedTools: ["list_recipes", "create_recipe"],
    createdAt: "2026-10-15T00:00:00.000Z",
    expiresAt: null,
    lastUsedAt: "2026-11-08T18:45:00.000Z",
  }),
  buildToken({
    id: "token-dev",
    name: "旧開発環境",
    prefix: "cho_mcp_99887766",
    allowedTools: ["list_ingredients", "list_recipes"],
    createdAt: "2026-10-01T00:00:00.000Z",
    expiresAt: "2026-11-05T00:00:00.000Z",
    lastUsedAt: "2026-11-04T16:20:00.000Z",
  }),
  buildToken({
    id: "token-ci",
    name: "CI 検証用",
    prefix: "cho_mcp_deadbeef",
    allowedTools: ["record_meal"],
    createdAt: "2026-09-01T00:00:00.000Z",
    expiresAt: null,
    revokedAt: "2026-11-02T14:00:00.000Z",
    lastUsedAt: "2026-11-02T13:58:00.000Z",
  }),
];

const daily = (toolName: McpToolName, entries: [string, number][]) => {
  const rows = entries.map(([utcDate, callCount]) => ({ toolName, utcDate, callCount }));
  return { toolName, totalCalls: rows.reduce((sum, row) => sum + row.callCount, 0), daily: rows };
};

const withTotal = (
  tokenId: string,
  tokenName: string,
  tools: McpTokenUsage["tools"],
): McpTokenUsage => ({
  tokenId,
  tokenName,
  totalCalls: tools.reduce((sum, tool) => sum + tool.totalCalls, 0),
  tools,
});

export const usage: McpTokenUsage[] = [
  withTotal("token-hermes", "Hermes", [
    daily("list_ingredients", [
      ["2026-10-14", 4],
      ["2026-10-18", 9],
      ["2026-10-22", 6],
      ["2026-10-27", 11],
      ["2026-11-01", 12],
      ["2026-11-03", 8],
      ["2026-11-05", 15],
      ["2026-11-07", 22],
      ["2026-11-08", 18],
      ["2026-11-09", 25],
    ]),
    daily("list_recipes", [
      ["2026-10-20", 3],
      ["2026-11-02", 5],
      ["2026-11-05", 10],
      ["2026-11-08", 15],
      ["2026-11-09", 20],
    ]),
    daily("record_meal", [
      ["2026-10-25", 2],
      ["2026-11-03", 4],
      ["2026-11-06", 6],
      ["2026-11-09", 10],
    ]),
  ]),
  withTotal("token-sync", "レシピ同期バッチ", [
    daily("list_recipes", [
      ["2026-11-04", 14],
      ["2026-11-06", 16],
      ["2026-11-08", 18],
    ]),
    daily("create_recipe", [
      ["2026-11-04", 2],
      ["2026-11-06", 4],
      ["2026-11-08", 6],
    ]),
  ]),
  withTotal("token-dev", "旧開発環境", [
    daily("list_ingredients", [
      ["2026-11-01", 7],
      ["2026-11-02", 5],
      ["2026-11-04", 8],
    ]),
  ]),
];

export const issuedSecret = {
  name: "Claude Desktop",
  prefix: "cho_mcp_01234567",
  secret: "cho_mcp_0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
};

export const buildIntegrationSettings = (
  overrides: {
    openrouter?: Partial<IntegrationSettings["openrouter"]>;
    inventia?: Partial<IntegrationSettings["inventia"]>;
  } = {},
): IntegrationSettings => ({
  openrouter: {
    configured: true,
    model: "google/gemini-2.5-flash",
    usable: true,
    issue: null,
    ...overrides.openrouter,
  },
  inventia: {
    configured: true,
    providerId: "cho",
    usable: true,
    issue: null,
    tokenSettingsUrl: "https://inventia.nikomaru.dev/settings/tokens",
    capabilities: { readItems: true, writeStock: false },
    ...overrides.inventia,
  },
});

export const MCP_ENDPOINT = "https://cho.nikomaru.dev/api/mcp";
