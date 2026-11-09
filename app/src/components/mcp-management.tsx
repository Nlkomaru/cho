import { Button, Checkbox, Field, Input, Stack, Table, Text } from "@chakra-ui/react";
import { useState } from "react";
import { z } from "zod";

import { mcpToolNameSchema, mcpToolNames } from "../domain/mcp";
import { Feedback } from "./ui/feedback";
import { FormField } from "../routes/_app/-components/form-field";
import { Section } from "./ui/section";
type McpToolName = z.infer<typeof mcpToolNameSchema>;

const managerTokenSchema = z.object({
  id: z.string(),
  name: z.string(),
  prefix: z.string(),
  allowedTools: z.array(mcpToolNameSchema),
  createdAt: z.iso.datetime(),
  expiresAt: z.iso.datetime().nullable(),
  revokedAt: z.iso.datetime().nullable(),
  lastUsedAt: z.iso.datetime().nullable(),
});
const managerUsageRowSchema = z.object({
  tokenId: z.string(),
  tokenName: z.string(),
  toolName: mcpToolNameSchema,
  day: z.iso.date(),
  count: z.number(),
});
const managerDataSchema = z.object({
  tokens: z.array(managerTokenSchema),
  usage: z.array(managerUsageRowSchema),
});
const tokenListResponseSchema = z.object({ tokens: z.array(managerTokenSchema) });
const usageResponseSchema = z.object({
  usage: z.array(
    z.object({
      tokenId: z.string(),
      tokenName: z.string(),
      totalCalls: z.number(),
      tools: z.array(
        z.object({
          toolName: mcpToolNameSchema,
          totalCalls: z.number(),
          daily: z.array(
            z.object({
              toolName: mcpToolNameSchema,
              utcDate: z.iso.date(),
              callCount: z.number(),
            }),
          ),
        }),
      ),
    }),
  ),
});
const issuedTokenResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  prefix: z.string(),
  allowedTools: z.array(mcpToolNameSchema),
  createdAt: z.iso.datetime(),
  expiresAt: z.iso.datetime().nullable(),
  secret: z.string().regex(/^cho_mcp_[0-9a-f]{64}$/),
});
class ManagementRequestError extends Error {
  constructor(status: number, message = "管理 API の応答を読み込めませんでした。") {
    super(status === 401 ? "管理キーを確認してください。" : message);
  }
}
export type McpManagerToken = z.infer<typeof managerTokenSchema>;
export type McpUsageRow = z.infer<typeof managerUsageRowSchema>;
export type McpManagerData = z.infer<typeof managerDataSchema>;
export type McpManagerView =
  | { kind: "credential-entry" }
  | { kind: "loading" }
  | {
      kind: "ready";
      data: McpManagerData;
      activity: "idle" | "issuing" | { revoking: string };
      revealedSecret?: string;
    }
  | { kind: "error"; message: string };
function tokenStatus(token: McpManagerToken, now: number) {
  if (token.revokedAt) return "失効";
  if (token.expiresAt && Date.parse(token.expiresAt) <= now) return "期限切れ";
  return "有効";
}

async function readJson<T extends z.ZodType>(response: Response, schema: T): Promise<z.infer<T>> {
  if (!response.ok)
    throw new ManagementRequestError(response.status, "管理 API を利用できません。");
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new ManagementRequestError(0);
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new ManagementRequestError(0, "管理 API の応答形式が不正です。");
  return parsed.data;
}

async function loadManager(credential: string): Promise<McpManagerData> {
  const headers = { Authorization: `Bearer ${credential}` };
  const [tokenResult, usageResult] = await Promise.all([
    fetch("/api/mcp/tokens", { headers, cache: "no-store" }).then((response) =>
      readJson(response, tokenListResponseSchema),
    ),
    fetch("/api/mcp/usage", { headers, cache: "no-store" }).then((response) =>
      readJson(response, usageResponseSchema),
    ),
  ]);
  return {
    tokens: tokenResult.tokens,
    usage: usageResult.usage.flatMap((token) =>
      token.tools.flatMap((tool) =>
        tool.daily.map((daily) => ({
          tokenId: token.tokenId,
          tokenName: token.tokenName,
          toolName: tool.toolName,
          day: daily.utcDate,
          count: daily.callCount,
        })),
      ),
    ),
  };
}

export function McpManagement({
  now = Date.now(),
  initialView = { kind: "credential-entry" },
}: {
  now?: number;
  initialView?: McpManagerView;
}) {
  const [credential, setCredential] = useState("");
  const [name, setName] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [allowedTools, setAllowedTools] = useState<McpToolName[]>([...mcpToolNames]);
  const [view, setView] = useState<McpManagerView>(initialView);
  async function authenticate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setView({ kind: "loading" });
    try {
      setView({ kind: "ready", data: await loadManager(credential), activity: "idle" });
    } catch (cause) {
      setView({
        kind: "error",
        message:
          cause instanceof ManagementRequestError
            ? cause.message
            : "管理 API に接続できませんでした。",
      });
    }
  }

  async function refresh() {
    const previous = view;
    if (previous.kind !== "ready") return;
    setView({ ...previous, activity: "idle" });
    try {
      setView({ kind: "ready", data: await loadManager(credential), activity: "idle" });
    } catch (cause) {
      setView({
        kind: "error",
        message:
          cause instanceof ManagementRequestError
            ? cause.message
            : "管理 API に接続できませんでした。",
      });
    }
  }

  async function issue(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (view.kind !== "ready") return;
    const current = view;
    setView({ ...current, activity: "issuing" });
    try {
      const response = await fetch("/api/mcp/tokens", {
        method: "POST",
        headers: { Authorization: `Bearer ${credential}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          allowedTools,
          ...(expiresAt ? { expiresAt: new Date(expiresAt).toISOString() } : {}),
        }),
        cache: "no-store",
      });
      const created = await readJson(response, issuedTokenResponseSchema);
      const { secret, ...token } = created;
      setName("");
      setExpiresAt("");
      setView({
        kind: "ready",
        data: {
          ...current.data,
          tokens: [{ ...token, revokedAt: null, lastUsedAt: null }, ...current.data.tokens],
        },
        activity: "idle",
        revealedSecret: secret,
      });
    } catch (cause) {
      setView({
        kind: "error",
        message:
          cause instanceof ManagementRequestError ? cause.message : "キーを発行できませんでした。",
      });
    }
  }

  async function revoke(id: string) {
    if (view.kind !== "ready") return;
    const current = view;
    setView({ ...current, activity: { revoking: id } });
    try {
      const response = await fetch(`/api/mcp/tokens/${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${credential}` },
        cache: "no-store",
      });
      if (!response.ok)
        throw new ManagementRequestError(response.status, "キーを失効できませんでした。");
      setView({ kind: "ready", data: await loadManager(credential), activity: "idle" });
    } catch (cause) {
      setView({
        kind: "error",
        message:
          cause instanceof ManagementRequestError ? cause.message : "キーを失効できませんでした。",
      });
    }
  }

  function clearCredential() {
    setCredential("");
    setView({ kind: "credential-entry" });
  }

  const isReady = view.kind === "ready";
  const busy = isReady && view.activity !== "idle";
  return (
    <Section title="MCP クライアントキー" label="MCP クライアントキー管理">
      <Text>管理キーを入力すると、名前付きキーの発行・失効と利用状況を確認できます。</Text>
      {view.kind === "credential-entry" || view.kind === "error" ? (
        <form onSubmit={authenticate}>
          <Stack gap="3" align="stretch">
            <FormField label="管理キー" htmlFor="mcp-manager-key">
              <Input
                id="mcp-manager-key"
                type="password"
                autoComplete="off"
                value={credential}
                onChange={(event) => setCredential(event.target.value)}
                placeholder="cho_mgr_…"
                required
              />
            </FormField>
            <Button type="submit" colorPalette="red">
              管理画面を開く
            </Button>
          </Stack>
        </form>
      ) : null}
      {view.kind === "loading" ? (
        <Feedback tone="status" role="status">
          管理情報を読み込み中…
        </Feedback>
      ) : null}
      {view.kind === "error" ? (
        <Feedback tone="error" role="alert">
          {view.message}
        </Feedback>
      ) : null}
      {view.kind === "ready" ? (
        <Stack gap="5" align="stretch">
          {view.revealedSecret ? (
            <Feedback tone="status" role="status">
              発行したキーは一度だけ表示されます。安全な場所に保存してください。
              <Text as="code" display="block" overflowWrap="anywhere">
                {view.revealedSecret}
              </Text>
              <Button
                mt="2"
                size="sm"
                onClick={() => setView({ kind: "ready", data: view.data, activity: "idle" })}
              >
                表示を閉じる
              </Button>
            </Feedback>
          ) : null}
          <form onSubmit={issue}>
            <Stack gap="3" align="stretch">
              <FormField label="キーの名前" htmlFor="mcp-token-name">
                <Input
                  id="mcp-token-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
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
                <Field.Label>使えるツール</Field.Label>
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
                      <Checkbox.Label id={`mcp-tool-${tool}`}>{tool}</Checkbox.Label>
                    </Checkbox.Root>
                  ))}
                </Stack>
              </Field.Root>
              <Button
                type="submit"
                colorPalette="red"
                loading={view.activity === "issuing"}
                disabled={!allowedTools.length}
              >
                クライアントキーを発行
              </Button>
            </Stack>
          </form>
          <Stack
            direction={{ base: "column", sm: "row" }}
            justify="space-between"
            align={{ base: "stretch", sm: "center" }}
          >
            <Text fontWeight="semibold">発行済みキー</Text>
            <Button variant="outline" size="sm" loading={busy} onClick={refresh}>
              更新
            </Button>
          </Stack>
          {view.data.tokens.length ? (
            <Table.Root size="sm">
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeader>名前</Table.ColumnHeader>
                  <Table.ColumnHeader>許可ツール</Table.ColumnHeader>
                  <Table.ColumnHeader>状態</Table.ColumnHeader>
                  <Table.ColumnHeader>期限</Table.ColumnHeader>
                  <Table.ColumnHeader>操作</Table.ColumnHeader>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {view.data.tokens.map((token) => (
                  <Table.Row key={token.id}>
                    <Table.Cell>{token.name}</Table.Cell>
                    <Table.Cell>{token.allowedTools.join(", ")}</Table.Cell>
                    <Table.Cell>{tokenStatus(token, now)}</Table.Cell>
                    <Table.Cell>
                      {token.expiresAt
                        ? new Date(token.expiresAt).toLocaleDateString("ja-JP", { timeZone: "UTC" })
                        : "無期限"}
                    </Table.Cell>
                    <Table.Cell>
                      {token.revokedAt ? (
                        "—"
                      ) : (
                        <Button
                          size="xs"
                          variant="outline"
                          disabled={busy}
                          loading={
                            typeof view.activity !== "string" && view.activity.revoking === token.id
                          }
                          onClick={() => void revoke(token.id)}
                        >
                          失効
                        </Button>
                      )}
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
          ) : (
            <Feedback tone="status">発行済みキーはありません。</Feedback>
          )}
          <Text fontWeight="semibold">利用状況（日別）</Text>
          {view.data.usage.length ? (
            <Table.Root size="sm">
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeader>日付</Table.ColumnHeader>
                  <Table.ColumnHeader>クライアント</Table.ColumnHeader>
                  <Table.ColumnHeader>ツール</Table.ColumnHeader>
                  <Table.ColumnHeader>回数</Table.ColumnHeader>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {view.data.usage.map((row) => (
                  <Table.Row key={`${row.tokenId}-${row.toolName}-${row.day}`}>
                    <Table.Cell>{row.day}</Table.Cell>
                    <Table.Cell>{row.tokenName}</Table.Cell>
                    <Table.Cell>{row.toolName}</Table.Cell>
                    <Table.Cell>{row.count}</Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
          ) : (
            <Feedback tone="status">利用記録はありません。</Feedback>
          )}
          <Button variant="outline" onClick={clearCredential}>
            管理キーを消去
          </Button>
        </Stack>
      ) : null}
    </Section>
  );
}
