import { StreamableHTTPTransport } from "@hono/mcp";
import { cors } from "hono/cors";
import { Hono } from "hono";
import { z } from "zod";

import { createDbClient } from "../db/client";
import { mcpToolNameSchema } from "../domain/mcp";
import { createMcpTokenService } from "../services/mcp-tokens";
import { createMcpServer } from "../services/mcp-tools";
import type { ApiBindings } from "./index";

export const mcpRoutes = new Hono<{ Bindings: ApiBindings }>();

const toolCallSchema = z
  .object({
    method: z.literal("tools/call"),
    params: z.object({ name: z.string().min(1) }).passthrough(),
  })
  .passthrough();

function calledToolNames(body: unknown): string[] {
  const messages = Array.isArray(body) ? body : [body];
  return messages.flatMap((message) => {
    const parsed = toolCallSchema.safeParse(message);
    if (!parsed.success || !mcpToolNameSchema.safeParse(parsed.data.params.name).success) return [];
    return [parsed.data.params.name];
  });
}

function allowedOrigin(origin: string | null, configured: string | undefined): boolean {
  if (origin === null) return true;
  const allowlist = (configured ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  return allowlist.includes(origin);
}
mcpRoutes.use("/api/mcp", async (context, next) => {
  if (!allowedOrigin(context.req.header("Origin") ?? null, context.env.MCP_ALLOWED_ORIGINS))
    return context.json({ error: "Origin not allowed" }, 403);
  await next();
});
mcpRoutes.use(
  "/api/mcp",
  cors({
    origin: (origin) => origin,
    allowMethods: ["POST", "GET", "OPTIONS"],
    allowHeaders: ["Authorization", "Content-Type", "Accept", "MCP-Protocol-Version"],
    exposeHeaders: ["MCP-Protocol-Version", "MCP-Session-Id"],
    credentials: false,
    maxAge: 600,
  }),
);

mcpRoutes.get("/api/mcp", (context) => context.body(null, 405, { Allow: "POST, OPTIONS" }));

mcpRoutes.post("/api/mcp", async (context) => {
  const authorization = context.req.header("Authorization");
  const token = authorization?.match(/^Bearer\s+(\S+)$/i)?.[1] ?? "";
  if (!/^cho_mcp_[0-9a-f]{64}$/.test(token)) return context.json({ error: "Unauthorized" }, 401);

  const tokenService = createMcpTokenService(createDbClient(context.env.DB));
  const principal = await tokenService.authenticate(token);
  if (!principal) return context.json({ error: "Unauthorized" }, 401);

  const body = await context.req.raw
    .clone()
    .json()
    .catch(() => null);
  try {
    await Promise.all(
      calledToolNames(body).map((toolName) =>
        tokenService.recordToolCall(principal.id, mcpToolNameSchema.parse(toolName)),
      ),
    );
  } catch {
    return context.json({ error: "Usage recording failed" }, 503);
  }

  const server = createMcpServer(context.env.DB, principal.allowedTools);
  const transport = new StreamableHTTPTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  try {
    await server.connect(transport);
    return await transport.handleRequest(context);
  } finally {
    await server.close().catch(() => undefined);
  }
});
