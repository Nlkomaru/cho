import { Box, Skeleton, Stack } from "@chakra-ui/react";
import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { mcpToolNames } from "@/domain/mcp";
import { Section, SubHeading } from "@/components/layout/section";
import { Button } from "@/components/ui/button";
import { Feedback } from "@/components/ui/feedback";
import { toaster } from "@/components/ui/toaster";

import { McpConnection } from "./mcp-connection";
import { McpIssuedSecret } from "./mcp-issued-secret";
import { McpKeyForm, type McpKeyFormValue } from "./mcp-key-form";
import { McpKeyTable } from "./mcp-key-table";
import {
  issuedTokenResponseSchema,
  type McpManagementState,
  tokenListResponseSchema,
  usageResponseSchema,
} from "./mcp-model";
import { McpUsage } from "./mcp-usage";

export interface McpManagementProps {
  /** 渡すと API を呼ばずにこの状態で表示する (Storybook 用)。 */
  initialState?: McpManagementState;
  now?: () => Date;
  /** 接続先の URL。省略時は表示中のオリジン + /api/mcp。 */
  endpointUrl?: string;
}

const emptyForm = (): McpKeyFormValue => ({
  name: "",
  expiresAt: "",
  allowedTools: [...mcpToolNames],
});

async function fetchMcpData() {
  const [tokensRes, usageRes] = await Promise.all([
    fetch("/api/mcp/tokens", { cache: "no-store" }),
    fetch("/api/mcp/usage", { cache: "no-store" }),
  ]);
  if (tokensRes.status === 503 || usageRes.status === 503) {
    throw new Error("この環境では MCP の管理が無効になっています。");
  }
  if (!tokensRes.ok || !usageRes.ok) throw new Error("MCP の設定を読み込めませんでした。");
  const tokens = tokenListResponseSchema.parse(await tokensRes.json()).tokens;
  const usage = usageResponseSchema.parse(await usageRes.json()).usage;
  return { tokens, usage };
}

/**
 * MCP クライアントキーの発行・失効、利用状況、接続設定。
 */
export function McpManagement({ initialState, now, endpointUrl }: McpManagementProps) {
  const [state, setState] = useState<McpManagementState>(initialState ?? { status: "loading" });
  const [form, setForm] = useState<McpKeyFormValue>(emptyForm);
  const [issuing, setIssuing] = useState(false);
  const [issueError, setIssueError] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [connectionToken, setConnectionToken] = useState("");
  const [origin, setOrigin] = useState("");

  // 状態の判定 (有効 / 期限切れ) と 30 日の集計に使う基準時刻
  const [currentDate, setCurrentDate] = useState(() => (now ? now() : new Date()));

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    if (initialState) setState(initialState);
  }, [initialState]);

  const load = useCallback(
    async (mode: "initial" | "refresh") => {
      if (mode === "refresh") setRefreshing(true);
      try {
        const data = await fetchMcpData();
        setCurrentDate(now ? now() : new Date());
        setState((prev) => ({
          status: "ready",
          ...data,
          issuedSecret: prev.status === "ready" ? prev.issuedSecret : null,
        }));
      } catch (cause) {
        const message =
          cause instanceof Error ? cause.message : "MCP の設定を読み込めませんでした。";
        if (mode === "refresh") toaster.create({ type: "error", title: message });
        setState((prev) => (prev.status === "ready" ? prev : { status: "error", message }));
      } finally {
        if (mode === "refresh") setRefreshing(false);
      }
    },
    [now],
  );

  useEffect(() => {
    if (initialState) return;
    void load("initial");
  }, [initialState, load]);

  const issue = async () => {
    setIssuing(true);
    setIssueError(null);
    try {
      const response = await fetch("/api/mcp/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          name: form.name.trim(),
          allowedTools: form.allowedTools,
          ...(form.expiresAt ? { expiresAt: new Date(form.expiresAt).toISOString() } : {}),
        }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(
          body?.error === "Invalid token expiry"
            ? "有効期限が正しくありません。"
            : (body?.error ?? "キーを発行できませんでした。"),
        );
      }
      const created = issuedTokenResponseSchema.parse(await response.json());
      setForm(emptyForm());
      setConnectionToken(created.secret);
      setState((prev) =>
        prev.status !== "ready"
          ? prev
          : {
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
              issuedSecret: { name: created.name, prefix: created.prefix, secret: created.secret },
            },
      );
    } catch (cause) {
      setIssueError(cause instanceof Error ? cause.message : "キーを発行できませんでした。");
    } finally {
      setIssuing(false);
    }
  };

  const revoke = async (id: string) => {
    setRevokingId(id);
    try {
      const response = await fetch(`/api/mcp/tokens/${encodeURIComponent(id)}`, {
        method: "DELETE",
        cache: "no-store",
      });
      if (!response.ok) throw new Error("キーを失効できませんでした。");
      setState((prev) =>
        prev.status !== "ready"
          ? prev
          : {
              ...prev,
              tokens: prev.tokens.map((token) =>
                token.id === id ? { ...token, revokedAt: new Date().toISOString() } : token,
              ),
            },
      );
      toaster.create({ type: "success", title: "キーを失効しました" });
      return true;
    } catch (cause) {
      toaster.create({
        type: "error",
        title: cause instanceof Error ? cause.message : "キーを失効できませんでした。",
      });
      return false;
    } finally {
      setRevokingId(null);
    }
  };

  if (state.status === "loading") {
    return (
      <Stack gap="4" role="status" aria-busy="true" aria-label="MCP の設定を読み込み中">
        <Skeleton h="8" w="48" />
        <Skeleton h="72" />
        <Skeleton h="40" />
      </Stack>
    );
  }

  if (state.status === "error") {
    return (
      <Feedback
        tone="error"
        action={
          initialState ? undefined : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => void load("refresh")}
              loading={refreshing}
            >
              再読み込み
            </Button>
          )
        }
      >
        {state.message}
      </Feedback>
    );
  }

  const endpoint = endpointUrl ?? `${origin || "http://localhost:3000"}/api/mcp`;

  return (
    <Stack gap={{ base: "10", md: "12" }}>
      <Section
        title="クライアントキー"
        actions={
          initialState ? undefined : (
            <Button
              size="sm"
              variant="ghost"
              loading={refreshing}
              onClick={() => void load("refresh")}
            >
              <RefreshCw strokeWidth={1.75} />
              更新
            </Button>
          )
        }
      >
        <Stack gap="8">
          {state.issuedSecret ? (
            <McpIssuedSecret
              issued={state.issuedSecret}
              onDismiss={() => setState({ ...state, issuedSecret: null })}
            />
          ) : null}
          <McpKeyForm
            value={form}
            onChange={setForm}
            onSubmit={() => void issue()}
            busy={issuing}
            error={issueError}
          />
          <Box>
            <SubHeading trailing={`${state.tokens.length} 件`}>発行済み</SubHeading>
            <Box mt="2">
              <McpKeyTable
                tokens={state.tokens}
                now={currentDate}
                revokingId={revokingId}
                onRevoke={revoke}
              />
            </Box>
          </Box>
        </Stack>
      </Section>

      <Section title="利用状況">
        <McpUsage usage={state.usage} tokens={state.tokens} now={currentDate} />
      </Section>

      <Section title="接続設定">
        <McpConnection
          endpointUrl={endpoint}
          token={connectionToken}
          onTokenChange={setConnectionToken}
        />
      </Section>
    </Stack>
  );
}
