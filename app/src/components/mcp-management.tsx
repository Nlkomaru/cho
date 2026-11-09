import {
  Box,
  Button,
  chakra,
  Checkbox,
  Field,
  Grid,
  Input,
  Stack,
  Table,
  Text,
} from "@chakra-ui/react";
import { CheckIcon, CopyIcon, RefreshCwIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { z } from "zod";

import { mcpToolNameSchema, mcpToolNames, type McpToolName } from "../domain/mcp";
import { FormField } from "../routes/_app/-components/form-field";
import { Feedback } from "./ui/feedback";
import { Numeric } from "./ui/numeric";
import { Section } from "./ui/section";
import { StatBar } from "./ui/stat-bar";

export const mcpToolLabels: Record<McpToolName, string> = {
  list_ingredients: "材料一覧",
  create_ingredient: "材料登録",
  list_recipes: "レシピ一覧",
  create_recipe: "レシピ登録",
  record_meal: "食事記録",
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

const tokenListResponseSchema = z.object({ tokens: z.array(mcpTokenSummarySchema) });
const usageResponseSchema = z.object({ usage: z.array(mcpTokenUsageSchema) });

const issuedTokenResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  prefix: z.string(),
  allowedTools: z.array(mcpToolNameSchema),
  createdAt: z.string(),
  expiresAt: z.string().nullable(),
  secret: z.string().regex(/^cho_mcp_[0-9a-f]{64}$/),
});

export type McpManagementState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "ready";
      tokens: McpTokenSummary[];
      usage: McpTokenUsage[];
      issuedSecret?: { name: string; prefix: string; secret: string } | null;
    };

// Backward compatibility types for Storybook and older references
export type McpManagerToken = McpTokenSummary;
export type McpUsageRow = {
  tokenId: string;
  tokenName: string;
  toolName: McpToolName;
  day: string;
  count: number;
};
export type McpManagerData = {
  tokens: McpTokenSummary[];
  usage: McpTokenUsage[] | McpUsageRow[];
};
export type McpManagerView =
  | { kind: "credential-entry" }
  | { kind: "loading" }
  | {
      kind: "ready";
      data: McpManagerData;
      activity?: "idle" | "issuing" | { revoking: string };
      revealedSecret?: string;
    }
  | { kind: "error"; message: string }
  | McpManagementState;

export interface McpManagementProps {
  initialState?: McpManagementState;
  initialView?: McpManagerView;
  now?: (() => Date) | number | Date;
}

export function normalizeUsage(rawUsage: unknown[]): McpTokenUsage[] {
  if (!Array.isArray(rawUsage) || rawUsage.length === 0) return [];
  const first = rawUsage[0];
  if (typeof first === "object" && first !== null && "tools" in first) {
    return rawUsage as McpTokenUsage[];
  }

  const byToken = new Map<
    string,
    {
      tokenId: string;
      tokenName: string;
      toolsMap: Map<
        string,
        {
          totalCalls: number;
          daily: McpDailyUsage[];
        }
      >;
    }
  >();

  for (const raw of rawUsage as Record<string, unknown>[]) {
    const tokenId = String(raw.tokenId ?? "");
    const tokenName = String(raw.tokenName ?? "");
    const toolName = raw.toolName as McpToolName;
    const utcDate = String(raw.day ?? raw.utcDate ?? "");
    const count = Number(raw.count ?? raw.callCount ?? 0);

    let tokenEntry = byToken.get(tokenId);
    if (!tokenEntry) {
      tokenEntry = { tokenId, tokenName, toolsMap: new Map() };
      byToken.set(tokenId, tokenEntry);
    }
    let toolEntry = tokenEntry.toolsMap.get(toolName);
    if (!toolEntry) {
      toolEntry = { totalCalls: 0, daily: [] };
      tokenEntry.toolsMap.set(toolName, toolEntry);
    }
    toolEntry.totalCalls += count;
    toolEntry.daily.push({ toolName, utcDate, callCount: count });
  }

  return [...byToken.values()].map((t) => ({
    tokenId: t.tokenId,
    tokenName: t.tokenName,
    totalCalls: [...t.toolsMap.values()].reduce((sum, tool) => sum + tool.totalCalls, 0),
    tools: [...t.toolsMap.entries()].map(([toolName, data]) => ({
      toolName: toolName as McpToolName,
      totalCalls: data.totalCalls,
      daily: data.daily,
    })),
  }));
}

function resolveNow(now: (() => Date) | number | Date = () => new Date()): Date {
  if (typeof now === "function") return now();
  if (typeof now === "number") return new Date(now);
  if (now instanceof Date) return now;
  return new Date();
}

function parseInitial(
  initialState?: McpManagementState,
  initialView?: McpManagerView,
): McpManagementState | undefined {
  if (initialState) return initialState;
  if (!initialView) return undefined;
  if ("status" in initialView) return initialView;
  if (initialView.kind === "loading") return { status: "loading" };
  if (initialView.kind === "error") return { status: "error", message: initialView.message };
  if (initialView.kind === "ready") {
    return {
      status: "ready",
      tokens: initialView.data.tokens,
      usage: normalizeUsage(initialView.data.usage),
      issuedSecret: initialView.revealedSecret
        ? { name: "新規キー", prefix: "", secret: initialView.revealedSecret }
        : null,
    };
  }
  return undefined;
}

function formatUtcDateTime(isoString: string | null): string {
  if (!isoString) return "未使用";
  try {
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return isoString;
    return d.toLocaleString("ja-JP", {
      timeZone: "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return isoString;
  }
}

function formatUtcDate(isoString: string | null): string {
  if (!isoString) return "未使用";
  try {
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return isoString;
    return d.toLocaleDateString("ja-JP", {
      timeZone: "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    return isoString;
  }
}

function getTokenStatus(
  token: McpTokenSummary,
  now: Date,
): { label: "有効" | "期限切れ" | "失効済み"; text: string } {
  if (token.revokedAt) {
    return { label: "失効済み", text: "失効済み" };
  }
  if (token.expiresAt && new Date(token.expiresAt).getTime() <= now.getTime()) {
    return {
      label: "期限切れ",
      text: `期限切れ (${formatUtcDate(token.expiresAt)})`,
    };
  }
  return {
    label: "有効",
    text: `有効 (${token.expiresAt ? `${formatUtcDate(token.expiresAt)}まで` : "無期限"})`,
  };
}

function compute30UtcDaysActivity(
  usage: McpTokenUsage[],
  now: Date,
): { utcDate: string; callCount: number }[] {
  const endDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const days: { utcDate: string; callCount: number }[] = [];
  const countMap = new Map<string, number>();

  for (let i = 29; i >= 0; i--) {
    const d = new Date(endDate.getTime() - i * 86400000);
    const dateStr = d.toISOString().slice(0, 10);
    days.push({ utcDate: dateStr, callCount: 0 });
    countMap.set(dateStr, 0);
  }

  for (const token of usage) {
    for (const tool of token.tools) {
      for (const day of tool.daily) {
        if (countMap.has(day.utcDate)) {
          countMap.set(day.utcDate, (countMap.get(day.utcDate) ?? 0) + day.callCount);
        }
      }
    }
  }

  for (const day of days) {
    day.callCount = countMap.get(day.utcDate) ?? 0;
  }

  return days;
}

export function McpManagement({
  initialState,
  initialView,
  now = () => new Date(),
}: McpManagementProps) {
  const [state, setState] = useState<McpManagementState>(
    () => parseInitial(initialState, initialView) ?? { status: "loading" },
  );

  // Form states
  const [name, setName] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [allowedTools, setAllowedTools] = useState<McpToolName[]>([...mcpToolNames]);
  const [isIssuing, setIsIssuing] = useState(false);
  const [issueError, setIssueError] = useState<string | null>(null);

  // Revoke state
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revokeError, setRevokeError] = useState<string | null>(null);

  // Refresh state
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Section 3 interactive token input
  const [interactiveToken, setInteractiveToken] = useState("");

  // Clipboard & accessibility announcement
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [copyAnnouncement, setCopyAnnouncement] = useState("");

  const copyToClipboard = useCallback((text: string, id: string, label: string) => {
    if (typeof navigator === "undefined" || !navigator.clipboard) {
      setCopyAnnouncement(`${label}をコピーできませんでした。`);
      return;
    }
    void navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopiedKey(id);
        setCopyAnnouncement(`${label}をコピーしました。`);
        setTimeout(() => setCopiedKey((curr) => (curr === id ? null : curr)), 2000);
      })
      .catch(() => {
        setCopyAnnouncement(`${label}をコピーできませんでした。`);
      });
  }, []);

  const currentDate = useMemo(() => resolveNow(now), [now]);

  // Sync when initialState or initialView changes externally
  useEffect(() => {
    const parsed = parseInitial(initialState, initialView);
    if (parsed) {
      setState(parsed);
    }
  }, [initialState, initialView]);

  // Auto-populate interactive token when a secret is issued
  useEffect(() => {
    if (state.status === "ready" && state.issuedSecret?.secret) {
      setInteractiveToken(state.issuedSecret.secret);
    }
  }, [state]);

  // Fetch data on mount if no initial state was supplied
  useEffect(() => {
    if (initialState !== undefined || initialView !== undefined) return;
    let active = true;

    async function load() {
      try {
        const [tokensRes, usageRes] = await Promise.all([
          fetch("/api/mcp/tokens", { cache: "no-store" }),
          fetch("/api/mcp/usage", { cache: "no-store" }),
        ]);
        if (!tokensRes.ok || !usageRes.ok) {
          throw new Error("MCP 設定を読み込めませんでした。");
        }
        const tokensBody = tokenListResponseSchema.parse(await tokensRes.json());
        const usageBody = usageResponseSchema.parse(await usageRes.json());
        if (active) {
          setState({
            status: "ready",
            tokens: tokensBody.tokens,
            usage: usageBody.usage,
            issuedSecret: null,
          });
        }
      } catch (cause) {
        if (active) {
          setState({
            status: "error",
            message: cause instanceof Error ? cause.message : "MCP 設定を読み込めませんでした。",
          });
        }
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [initialState, initialView]);

  const refreshData = async () => {
    setIsRefreshing(true);
    setRevokeError(null);
    setIssueError(null);
    try {
      const [tokensRes, usageRes] = await Promise.all([
        fetch("/api/mcp/tokens", { cache: "no-store" }),
        fetch("/api/mcp/usage", { cache: "no-store" }),
      ]);
      if (!tokensRes.ok || !usageRes.ok) {
        throw new Error("MCP 設定を更新できませんでした。");
      }
      const tokensBody = tokenListResponseSchema.parse(await tokensRes.json());
      const usageBody = usageResponseSchema.parse(await usageRes.json());
      setState((prev) => ({
        status: "ready",
        tokens: tokensBody.tokens,
        usage: usageBody.usage,
        issuedSecret: prev.status === "ready" ? prev.issuedSecret : null,
      }));
    } catch (cause) {
      setState((prev) =>
        prev.status === "ready"
          ? prev
          : {
              status: "error",
              message: cause instanceof Error ? cause.message : "MCP 設定を更新できませんでした。",
            },
      );
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleIssue = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim() || allowedTools.length === 0) return;
    setIsIssuing(true);
    setIssueError(null);
    try {
      const response = await fetch("/api/mcp/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          allowedTools,
          ...(expiresAt ? { expiresAt: new Date(expiresAt).toISOString() } : {}),
        }),
        cache: "no-store",
      });
      if (!response.ok) {
        const errorData = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(errorData?.error || "トークンを発行できませんでした。");
      }
      const created = issuedTokenResponseSchema.parse(await response.json());
      setName("");
      setExpiresAt("");
      setState((prev) => {
        if (prev.status !== "ready") return prev;
        return {
          ...prev,
          tokens: [
            {
              id: created.id,
              name: created.name,
              prefix: created.prefix,
              allowedTools: created.allowedTools,
              createdAt: created.createdAt,
              expiresAt: created.expiresAt,
              revokedAt: null,
              lastUsedAt: null,
            },
            ...prev.tokens,
          ],
          issuedSecret: {
            name: created.name,
            prefix: created.prefix,
            secret: created.secret,
          },
        };
      });
      setInteractiveToken(created.secret);
    } catch (cause) {
      setIssueError(cause instanceof Error ? cause.message : "トークンを発行できませんでした。");
    } finally {
      setIsIssuing(false);
    }
  };

  const handleRevoke = async (id: string) => {
    setRevokingId(id);
    setRevokeError(null);
    try {
      const response = await fetch(`/api/mcp/tokens/${encodeURIComponent(id)}`, {
        method: "DELETE",
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error("トークンを失効できませんでした。");
      }
      setState((prev) => {
        if (prev.status !== "ready") return prev;
        return {
          ...prev,
          tokens: prev.tokens.map((token) =>
            token.id === id ? { ...token, revokedAt: new Date().toISOString() } : token,
          ),
        };
      });
    } catch (cause) {
      setRevokeError(cause instanceof Error ? cause.message : "トークンを失効できませんでした。");
    } finally {
      setRevokingId(null);
    }
  };

  const origin =
    typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : "http://localhost:3000";
  const endpointUrl = `${origin}/api/mcp`;

  // Render loading state
  if (state.status === "loading") {
    return (
      <Section title="MCP クライアントキー" label="MCP クライアントキー管理">
        <Feedback tone="status" role="status" ariaLive="polite">
          MCP 情報を読み込み中…
        </Feedback>
      </Section>
    );
  }

  // Render error state
  if (state.status === "error") {
    return (
      <Section title="MCP クライアントキー" label="MCP クライアントキー管理">
        <Feedback tone="error" role="alert">
          {state.message}
        </Feedback>
        <Button variant="outline" size="sm" onClick={() => void refreshData()} mt="4">
          再試行
        </Button>
      </Section>
    );
  }

  // Ready state: compute statistics and summaries
  const totalCalls = state.usage.reduce((sum, item) => sum + item.totalCalls, 0);
  const activeTokensCount = state.tokens.filter(
    (t) => getTokenStatus(t, currentDate).label === "有効",
  ).length;

  const toolsWithCalls = new Set<string>();
  for (const token of state.usage) {
    for (const tool of token.tools) {
      if (tool.totalCalls > 0) {
        toolsWithCalls.add(tool.toolName);
      }
    }
  }
  const distinctToolsCount = toolsWithCalls.size;

  const dailyActivity = compute30UtcDaysActivity(state.usage, currentDate);
  const maxDailyCalls = Math.max(1, ...dailyActivity.map((d) => d.callCount));
  const startDay = dailyActivity[0]?.utcDate ?? "";
  const endDay = dailyActivity[dailyActivity.length - 1]?.utcDate ?? "";
  const hasAnyActivity = dailyActivity.some((d) => d.callCount > 0);

  const toolAggregates = mcpToolNames.map((toolName) => {
    let calls = 0;
    let lastUsedDate: string | null = null;
    for (const token of state.usage) {
      for (const tool of token.tools) {
        if (tool.toolName === toolName) {
          calls += tool.totalCalls;
          for (const day of tool.daily) {
            if (day.callCount > 0) {
              if (!lastUsedDate || day.utcDate > lastUsedDate) {
                lastUsedDate = day.utcDate;
              }
            }
          }
        }
      }
    }
    return {
      toolName,
      totalCalls: calls,
      lastUsedDate: lastUsedDate ?? "未使用",
    };
  });

  const breakdownRows = state.usage.flatMap((token) =>
    token.tools.flatMap((tool) =>
      tool.daily.map((daily) => ({
        key: `${token.tokenId}-${tool.toolName}-${daily.utcDate}`,
        tokenName: token.tokenName,
        toolName: tool.toolName,
        utcDate: daily.utcDate,
        callCount: daily.callCount,
      })),
    ),
  );

  const quoteShellValue = (value: string) => `'${value.replaceAll("'", `'"'"'`)}'`;
  const createHermesCommand = (token: string) =>
    [
      `hermes config set mcp_servers.cho.url ${quoteShellValue(endpointUrl)}`,
      `hermes config set mcp_servers.cho.headers.Authorization ${quoteShellValue(`Bearer ${token}`)}`,
      "hermes mcp test cho",
    ].join("\n");
  const effectiveConnectionToken = interactiveToken.trim() || "<cho_mcp_トークン>";
  const hermesAddCommand = createHermesCommand(effectiveConnectionToken);
  const mcpServersConfigJson = JSON.stringify(
    {
      mcpServers: {
        cho: {
          url: endpointUrl,
          headers: {
            Authorization: `Bearer ${effectiveConnectionToken}`,
          },
        },
      },
    },
    null,
    2,
  );

  return (
    <Stack gap="8" align="stretch">
      {/* Screen reader notification for copy actions */}
      <chakra.span
        position="absolute"
        width="1px"
        height="1px"
        padding="0"
        margin="-1px"
        overflow="hidden"
        clip="rect(0, 0, 0, 0)"
        whiteSpace="nowrap"
        borderWidth="0"
        role="status"
        aria-live="polite"
      >
        {copyAnnouncement}
      </chakra.span>

      {/* Section 1: MCP クライアントキー */}
      <Section
        title="MCP クライアントキー"
        label="MCP クライアントキー管理"
        actions={
          <Button
            size="sm"
            variant="outline"
            loading={isRefreshing}
            onClick={() => void refreshData()}
          >
            <RefreshCwIcon size={14} aria-hidden="true" />
            更新
          </Button>
        }
      >
        <Stack gap="6" align="stretch">
          <Text fontSize="sm" color="fg.muted">
            HTTP API と MCP
            を外部から呼ぶためのクライアントキーです。用途ごとに発行し、使わなくなったら失効させてください。
          </Text>

          {/* Issue Form */}
          <form onSubmit={handleIssue}>
            <Stack gap="4" align="stretch">
              <FormField label="キーの名前" htmlFor="mcp-token-name">
                <Input
                  id="mcp-token-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Hermes / Claude Desktop"
                  required
                  maxLength={100}
                />
              </FormField>

              <FormField label="有効期限（任意）" htmlFor="mcp-token-expires-at">
                <Input
                  id="mcp-token-expires-at"
                  type="datetime-local"
                  value={expiresAt}
                  onChange={(event) => setExpiresAt(event.target.value)}
                />
              </FormField>

              <Field.Root>
                <Field.Label>許可するツール</Field.Label>
                <Stack gap="2">
                  {mcpToolNames.map((tool) => (
                    <Checkbox.Root
                      key={tool}
                      checked={allowedTools.includes(tool)}
                      onCheckedChange={(details) =>
                        setAllowedTools((current) =>
                          details.checked === true
                            ? [...current, tool]
                            : current.filter((selected) => selected !== tool),
                        )
                      }
                    >
                      <Checkbox.HiddenInput aria-labelledby={`mcp-tool-${tool}`} />
                      <Checkbox.Control />
                      <Checkbox.Label id={`mcp-tool-${tool}`}>
                        {mcpToolLabels[tool]} ({tool})
                      </Checkbox.Label>
                    </Checkbox.Root>
                  ))}
                </Stack>
              </Field.Root>

              {issueError ? (
                <Feedback tone="error" role="alert">
                  {issueError}
                </Feedback>
              ) : null}

              <Box>
                <Button
                  type="submit"
                  colorPalette="red"
                  loading={isIssuing}
                  disabled={isIssuing || allowedTools.length === 0 || !name.trim()}
                >
                  トークンを発行
                </Button>
              </Box>
            </Stack>
          </form>

          {/* One-Time Issued Secret Panel */}
          {state.issuedSecret ? (
            <Box p="4" borderRadius="md" borderWidth="1px" borderColor="red.border" bg="red.subtle">
              <Stack gap="4" align="stretch">
                <Feedback tone="status" role="status">
                  このトークンは一度だけ表示されます。安全な場所に控えてください。
                </Feedback>

                <Box>
                  <Text fontSize="xs" fontWeight="semibold" color="fg.muted" mb="1">
                    トークン（{state.issuedSecret.name}）
                  </Text>
                  <Box
                    as="pre"
                    p="3"
                    bg="bg.muted"
                    borderRadius="md"
                    fontSize="xs"
                    fontFamily="mono"
                    overflowX="auto"
                    whiteSpace="pre-wrap"
                    wordBreak="break-all"
                  >
                    <code>{state.issuedSecret.secret}</code>
                  </Box>
                  <Button
                    mt="2"
                    size="xs"
                    variant="outline"
                    onClick={() =>
                      copyToClipboard(state.issuedSecret!.secret, "issued-secret", "トークン")
                    }
                  >
                    {copiedKey === "issued-secret" ? (
                      <CheckIcon size={14} aria-hidden="true" />
                    ) : (
                      <CopyIcon size={14} aria-hidden="true" />
                    )}
                    {copiedKey === "issued-secret" ? "コピーしました" : "トークンをコピー"}
                  </Button>
                </Box>

                <Box>
                  <Text fontSize="xs" fontWeight="semibold" color="fg.muted" mb="1">
                    Hermes CLI コマンド
                  </Text>
                  <Box
                    as="pre"
                    p="3"
                    bg="bg.muted"
                    borderRadius="md"
                    fontSize="xs"
                    fontFamily="mono"
                    overflowX="auto"
                    whiteSpace="pre-wrap"
                    wordBreak="break-all"
                  >
                    <code>{createHermesCommand(state.issuedSecret.secret)}</code>
                  </Box>
                  <Button
                    mt="2"
                    size="xs"
                    variant="outline"
                    onClick={() =>
                      copyToClipboard(
                        createHermesCommand(state.issuedSecret!.secret),
                        "issued-hermes",
                        "Hermes コマンド",
                      )
                    }
                  >
                    {copiedKey === "issued-hermes" ? (
                      <CheckIcon size={14} aria-hidden="true" />
                    ) : (
                      <CopyIcon size={14} aria-hidden="true" />
                    )}
                    {copiedKey === "issued-hermes" ? "コピーしました" : "Hermes コマンドをコピー"}
                  </Button>
                </Box>

                <Box>
                  <Text fontSize="xs" fontWeight="semibold" color="fg.muted" mb="1">
                    MCP クライアント設定 (JSON)
                  </Text>
                  <Box
                    as="pre"
                    p="3"
                    bg="bg.muted"
                    borderRadius="md"
                    fontSize="xs"
                    fontFamily="mono"
                    overflowX="auto"
                    whiteSpace="pre"
                  >
                    <code>
                      {JSON.stringify(
                        {
                          mcpServers: {
                            cho: {
                              url: endpointUrl,
                              headers: {
                                Authorization: `Bearer ${state.issuedSecret.secret}`,
                              },
                            },
                          },
                        },
                        null,
                        2,
                      )}
                    </code>
                  </Box>
                  <Button
                    mt="2"
                    size="xs"
                    variant="outline"
                    onClick={() =>
                      copyToClipboard(
                        JSON.stringify(
                          {
                            mcpServers: {
                              cho: {
                                url: endpointUrl,
                                headers: {
                                  Authorization: `Bearer ${state.issuedSecret!.secret}`,
                                },
                              },
                            },
                          },
                          null,
                          2,
                        ),
                        "issued-json",
                        "JSON 設定",
                      )
                    }
                  >
                    {copiedKey === "issued-json" ? (
                      <CheckIcon size={14} aria-hidden="true" />
                    ) : (
                      <CopyIcon size={14} aria-hidden="true" />
                    )}
                    {copiedKey === "issued-json" ? "コピーしました" : "JSON をコピー"}
                  </Button>
                </Box>

                <Box>
                  <Text fontSize="xs" fontWeight="semibold" color="fg.muted" mb="1">
                    curl の例
                  </Text>
                  <Box
                    as="pre"
                    p="3"
                    bg="bg.muted"
                    borderRadius="md"
                    fontSize="xs"
                    fontFamily="mono"
                    overflowX="auto"
                    whiteSpace="pre-wrap"
                    wordBreak="break-all"
                  >
                    <code>{`curl -H "Authorization: Bearer ${state.issuedSecret.secret}" "${endpointUrl}"`}</code>
                  </Box>
                  <Button
                    mt="2"
                    size="xs"
                    variant="outline"
                    onClick={() =>
                      copyToClipboard(
                        `curl -H "Authorization: Bearer ${state.issuedSecret!.secret}" "${endpointUrl}"`,
                        "issued-curl",
                        "curl の例",
                      )
                    }
                  >
                    {copiedKey === "issued-curl" ? (
                      <CheckIcon size={14} aria-hidden="true" />
                    ) : (
                      <CopyIcon size={14} aria-hidden="true" />
                    )}
                    {copiedKey === "issued-curl" ? "コピーしました" : "curl の例をコピー"}
                  </Button>
                </Box>

                <Button
                  alignSelf="start"
                  size="sm"
                  variant="outline"
                  onClick={() => setState({ ...state, issuedSecret: null })}
                >
                  表示を閉じる
                </Button>
              </Stack>
            </Box>
          ) : null}

          {/* Revoke Error Feedback */}
          {revokeError ? (
            <Feedback tone="error" role="alert">
              {revokeError}
            </Feedback>
          ) : null}

          {/* Issued Tokens Table */}
          <Text fontWeight="semibold" fontSize="sm">
            発行済みキー
          </Text>
          {state.tokens.length > 0 ? (
            <Table.Root size="sm">
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeader>名前</Table.ColumnHeader>
                  <Table.ColumnHeader>プレフィックス</Table.ColumnHeader>
                  <Table.ColumnHeader>許可ツール</Table.ColumnHeader>
                  <Table.ColumnHeader>作成日時</Table.ColumnHeader>
                  <Table.ColumnHeader>最終利用</Table.ColumnHeader>
                  <Table.ColumnHeader>状態</Table.ColumnHeader>
                  <Table.ColumnHeader>操作</Table.ColumnHeader>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {state.tokens.map((token) => {
                  const statusInfo = getTokenStatus(token, currentDate);
                  const isRevocable = statusInfo.label === "有効";
                  return (
                    <Table.Row key={token.id}>
                      <Table.Cell fontWeight="medium">{token.name}</Table.Cell>
                      <Table.Cell>
                        <chakra.span fontFamily="mono" fontSize="xs">
                          {token.prefix}…
                        </chakra.span>
                      </Table.Cell>
                      <Table.Cell>
                        {token.allowedTools.map((t) => mcpToolLabels[t] ?? t).join(", ")}
                      </Table.Cell>
                      <Table.Cell>{formatUtcDateTime(token.createdAt)}</Table.Cell>
                      <Table.Cell>{formatUtcDateTime(token.lastUsedAt)}</Table.Cell>
                      <Table.Cell>{statusInfo.text}</Table.Cell>
                      <Table.Cell>
                        {isRevocable ? (
                          <Button
                            size="xs"
                            variant="outline"
                            disabled={revokingId === token.id}
                            loading={revokingId === token.id}
                            onClick={() => void handleRevoke(token.id)}
                          >
                            失効
                          </Button>
                        ) : (
                          "—"
                        )}
                      </Table.Cell>
                    </Table.Row>
                  );
                })}
              </Table.Body>
            </Table.Root>
          ) : (
            <Feedback tone="status">発行済みの MCP クライアントキーはありません。</Feedback>
          )}
        </Stack>
      </Section>

      {/* Section 2: MCP 利用状況 */}
      <Section title="MCP 利用状況" label="MCP 利用状況">
        <Stack gap="6" align="stretch">
          {/* Summary StatBar */}
          <StatBar
            label="MCP 利用状況サマリー"
            items={[
              {
                label: "総呼び出し数",
                value: <Numeric size="lg">{totalCalls.toLocaleString("ja-JP")}</Numeric>,
              },
              {
                label: "稼働トークン数",
                value: <Numeric size="lg">{activeTokensCount.toLocaleString("ja-JP")}</Numeric>,
              },
              {
                label: "利用ツール数",
                value: <Numeric size="lg">{distinctToolsCount.toLocaleString("ja-JP")}</Numeric>,
              },
              {
                label: "集計期間",
                value: "直近 30 日 (UTC)",
              },
            ]}
          />

          {/* 30-Day UTC Activity Bar Chart */}
          <Box>
            <Text fontWeight="semibold" fontSize="sm" mb="1">
              日別アクティビティ（直近 30 UTC 日の日別呼び出し推移）
            </Text>
            <Box overflowX="auto" py="2">
              <Box minW="640px">
                <Grid
                  templateColumns="repeat(30, 1fr)"
                  alignItems="flex-end"
                  gap="1"
                  h="140px"
                  borderBottomWidth="1px"
                  borderColor="border"
                  pb="1"
                  role="img"
                  aria-label="直近 30 UTC 日の日別呼び出し推移"
                >
                  {dailyActivity.map((day) => {
                    const heightPercent =
                      day.callCount === 0
                        ? 0
                        : Math.max(8, Math.round((day.callCount / maxDailyCalls) * 100));
                    return (
                      <Box
                        key={day.utcDate}
                        title={`${day.utcDate}: ${day.callCount} 件`}
                        display="flex"
                        flexDirection="column"
                        alignItems="center"
                        justifyContent="flex-end"
                        h="100%"
                      >
                        <Box
                          w="100%"
                          bg={day.callCount > 0 ? "red.solid" : "bg.muted"}
                          borderRadius="xs"
                          style={{ height: `${heightPercent}%` }}
                          minH={day.callCount > 0 ? "4px" : "2px"}
                        />
                      </Box>
                    );
                  })}
                </Grid>
                <Grid templateColumns="repeat(2, 1fr)" pt="1" color="fg.muted" fontSize="xs">
                  <Box textAlign="left">{startDay} (UTC)</Box>
                  <Box textAlign="right">{endDay} (UTC)</Box>
                </Grid>
                {!hasAnyActivity ? (
                  <Text fontSize="sm" color="fg.muted" mt="2">
                    この期間の利用記録はありません。
                  </Text>
                ) : null}
              </Box>
            </Box>
          </Box>

          {/* Per-Tool Summary Table */}
          <Box>
            <Text fontWeight="semibold" fontSize="sm" mb="2">
              ツール別集計
            </Text>
            <Table.Root size="sm">
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeader>ツール</Table.ColumnHeader>
                  <Table.ColumnHeader textAlign="right">総呼び出し数</Table.ColumnHeader>
                  <Table.ColumnHeader>最終利用日 (UTC)</Table.ColumnHeader>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {toolAggregates.map((tool) => (
                  <Table.Row key={tool.toolName}>
                    <Table.Cell>
                      <Text fontWeight="medium">
                        {mcpToolLabels[tool.toolName] ?? tool.toolName}{" "}
                        <chakra.span fontFamily="mono" fontSize="xs" color="fg.muted">
                          ({tool.toolName})
                        </chakra.span>
                      </Text>
                    </Table.Cell>
                    <Table.Cell textAlign="right">
                      <Numeric>{tool.totalCalls.toLocaleString("ja-JP")}</Numeric>
                    </Table.Cell>
                    <Table.Cell>
                      <Numeric tone={tool.lastUsedDate === "未使用" ? "muted" : "normal"}>
                        {tool.lastUsedDate}
                      </Numeric>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
          </Box>

          {/* Per-Token Breakdown Table */}
          <Box>
            <Text fontWeight="semibold" fontSize="sm" mb="2">
              トークン別・日別内訳
            </Text>
            {breakdownRows.length > 0 ? (
              <Table.Root size="sm">
                <Table.Header>
                  <Table.Row>
                    <Table.ColumnHeader>トークン</Table.ColumnHeader>
                    <Table.ColumnHeader>ツール</Table.ColumnHeader>
                    <Table.ColumnHeader>日付 (UTC)</Table.ColumnHeader>
                    <Table.ColumnHeader textAlign="right">呼び出し回数</Table.ColumnHeader>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {breakdownRows.map((row) => (
                    <Table.Row key={row.key}>
                      <Table.Cell>{row.tokenName}</Table.Cell>
                      <Table.Cell>
                        {mcpToolLabels[row.toolName] ?? row.toolName}{" "}
                        <chakra.span fontFamily="mono" fontSize="xs" color="fg.muted">
                          ({row.toolName})
                        </chakra.span>
                      </Table.Cell>
                      <Table.Cell>{row.utcDate}</Table.Cell>
                      <Table.Cell textAlign="right">
                        <Numeric>{row.callCount.toLocaleString("ja-JP")}</Numeric>
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Root>
            ) : (
              <Feedback tone="status">利用記録はありません。</Feedback>
            )}
          </Box>
        </Stack>
      </Section>

      {/* Section 3: MCP 接続設定 */}
      <Section title="MCP 接続設定" label="MCP 接続設定">
        <Stack gap="5" align="stretch">
          <Text fontSize="sm" color="fg.muted">
            MCP は Streamable HTTP (POST) で外部クライアントから呼び出せます。リクエストの
            Authorization ヘッダーに発行した MCP クライアントキーを付与してください。
          </Text>

          {/* Endpoint summary box */}
          <Box bg="bg.subtle" p="4" borderRadius="md" borderWidth="1px" borderColor="border">
            <Stack gap="2" fontSize="sm">
              <Box display="flex" flexWrap="wrap" gap="2" alignItems="center">
                <Text fontWeight="semibold" minW="120px">
                  エンドポイント:
                </Text>
                <chakra.code
                  fontFamily="mono"
                  fontSize="xs"
                  bg="bg.muted"
                  px="2"
                  py="0.5"
                  borderRadius="sm"
                >
                  {endpointUrl}
                </chakra.code>
              </Box>
              <Box display="flex" flexWrap="wrap" gap="2" alignItems="center">
                <Text fontWeight="semibold" minW="120px">
                  通信方式:
                </Text>
                <chakra.span color="fg.muted">Streamable HTTP (POST)</chakra.span>
              </Box>
              <Box display="flex" flexWrap="wrap" gap="2" alignItems="center">
                <Text fontWeight="semibold" minW="120px">
                  認証ヘッダー:
                </Text>
                <chakra.code
                  fontFamily="mono"
                  fontSize="xs"
                  bg="bg.muted"
                  px="2"
                  py="0.5"
                  borderRadius="sm"
                >
                  Authorization: Bearer cho_mcp_...
                </chakra.code>
              </Box>
            </Stack>
          </Box>

          {/* Interactive Token Input */}
          <FormField
            label="クライアントキー（入力すると下の設定コマンドに反映されます）"
            htmlFor="mcp-connect-token"
          >
            <Input
              id="mcp-connect-token"
              type="password"
              autoComplete="off"
              spellCheck={false}
              placeholder="cho_mcp_…"
              value={interactiveToken}
              onChange={(e) => setInteractiveToken(e.target.value)}
            />
          </FormField>

          {/* Interactive Hermes CLI Command */}
          <Box>
            <Stack direction="row" justify="space-between" align="center" mb="2">
              <Text fontWeight="semibold" fontSize="sm">
                Hermes CLI 設定コマンド
              </Text>
              <Button
                size="xs"
                variant="outline"
                onClick={() =>
                  copyToClipboard(hermesAddCommand, "interactive-hermes", "Hermes CLI コマンド")
                }
              >
                {copiedKey === "interactive-hermes" ? (
                  <CheckIcon size={14} aria-hidden="true" />
                ) : (
                  <CopyIcon size={14} aria-hidden="true" />
                )}
                {copiedKey === "interactive-hermes" ? "コピーしました" : "コマンドをコピー"}
              </Button>
            </Stack>
            <Box
              as="pre"
              p="3"
              bg="bg.muted"
              borderRadius="md"
              fontSize="xs"
              fontFamily="mono"
              overflowX="auto"
              whiteSpace="pre-wrap"
              wordBreak="break-all"
            >
              <code>{hermesAddCommand}</code>
            </Box>
          </Box>

          {/* Interactive Claude Desktop / Cursor / MCP Client JSON */}
          <Box>
            <Stack direction="row" justify="space-between" align="center" mb="2">
              <Text fontWeight="semibold" fontSize="sm">
                Claude Desktop / Cursor / MCP クライアント設定 (JSON)
              </Text>
              <Button
                size="xs"
                variant="outline"
                onClick={() =>
                  copyToClipboard(mcpServersConfigJson, "interactive-json", "MCP JSON 設定")
                }
              >
                {copiedKey === "interactive-json" ? (
                  <CheckIcon size={14} aria-hidden="true" />
                ) : (
                  <CopyIcon size={14} aria-hidden="true" />
                )}
                {copiedKey === "interactive-json" ? "コピーしました" : "JSON をコピー"}
              </Button>
            </Stack>
            <Box
              as="pre"
              p="3"
              bg="bg.muted"
              borderRadius="md"
              fontSize="xs"
              fontFamily="mono"
              overflowX="auto"
              whiteSpace="pre"
            >
              <code>{mcpServersConfigJson}</code>
            </Box>
          </Box>
        </Stack>
      </Section>
    </Stack>
  );
}
