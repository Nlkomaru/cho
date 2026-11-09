import { Hono } from "hono";
import { z } from "zod";

import { createDbClient } from "../db/client";
import { issueMcpTokenSchema, createMcpTokenService } from "../services/mcp-tokens";
import {
  isMcpManagementEnabled,
  verifyMcpManagementBearer,
  type McpManagementPrincipal,
} from "../services/mcp-tokens";
import type { ApiBindings } from "./index";

export const mcpTokenRoutes = new Hono<{ Bindings: ApiBindings }>();
mcpTokenRoutes.use("*", async (context, next) => {
  context.header("Cache-Control", "no-store");
  await next();
});
const idSchema = z.string().trim().min(1).max(128);
const usageQuerySchema = z
  .object({
    tokenId: idSchema.optional(),
    from: z.iso.date().optional(),
    to: z.iso.date().optional(),
  })
  .strict()
  .refine((query) => !query.from || !query.to || query.from <= query.to);

async function requireManagement(request: Request, env: ApiBindings) {
  if (
    !isMcpManagementEnabled(env.MCP_MANAGEMENT_ENABLED) ||
    !env.MCP_MANAGEMENT_TOKEN_HASH ||
    !/^[0-9a-f]{64}$/.test(env.MCP_MANAGEMENT_TOKEN_HASH)
  )
    return 503;
  return (
    (await verifyMcpManagementBearer(
      request.headers.get("Authorization") ?? undefined,
      env.MCP_MANAGEMENT_TOKEN_HASH,
    )) ?? 401
  );
}

function isPrincipal(value: number | McpManagementPrincipal): value is McpManagementPrincipal {
  return typeof value !== "number";
}

mcpTokenRoutes.post("/api/mcp/tokens", async (context) => {
  const principal = await requireManagement(context.req.raw, context.env);
  if (!isPrincipal(principal))
    return context.json(
      { error: principal === 503 ? "MCP management is not configured" : "Unauthorized" },
      principal,
    );
  let body: unknown;
  try {
    body = await context.req.json();
  } catch {
    return context.json({ error: "Invalid token request" }, 400);
  }
  const input = issueMcpTokenSchema.safeParse(body);
  if (!input.success) return context.json({ error: "Invalid token request" }, 400);
  try {
    const token = await createMcpTokenService(createDbClient(context.env.DB)).issueRoot(input.data);
    return context.json(token, 201);
  } catch (error) {
    if (error instanceof RangeError) return context.json({ error: "Invalid token expiry" }, 400);
    throw error;
  }
});

mcpTokenRoutes.get("/api/mcp/tokens", async (context) => {
  const principal = await requireManagement(context.req.raw, context.env);
  if (!isPrincipal(principal))
    return context.json(
      { error: principal === 503 ? "MCP management is not configured" : "Unauthorized" },
      principal,
    );
  const tokens = await createMcpTokenService(createDbClient(context.env.DB)).listRoot();
  return context.json({ tokens }, 200);
});

mcpTokenRoutes.delete("/api/mcp/tokens/:id", async (context) => {
  const principal = await requireManagement(context.req.raw, context.env);
  if (!isPrincipal(principal))
    return context.json(
      { error: principal === 503 ? "MCP management is not configured" : "Unauthorized" },
      principal,
    );
  const id = idSchema.safeParse(context.req.param("id"));
  if (!id.success) return context.json({ error: "Invalid token ID" }, 400);
  const revoked = await createMcpTokenService(createDbClient(context.env.DB)).revokeRoot(id.data);
  return revoked ? context.body(null, 204) : context.json({ error: "Token not found" }, 404);
});

mcpTokenRoutes.get("/api/mcp/usage", async (context) => {
  const principal = await requireManagement(context.req.raw, context.env);
  if (!isPrincipal(principal))
    return context.json(
      { error: principal === 503 ? "MCP management is not configured" : "Unauthorized" },
      principal,
    );
  const query = usageQuerySchema.safeParse(context.req.query());
  if (!query.success) return context.json({ error: "Invalid usage query" }, 400);
  const usage = await createMcpTokenService(createDbClient(context.env.DB)).usageRoot(
    query.data.tokenId,
    { from: query.data.from, to: query.data.to },
  );
  return context.json({ usage }, 200);
});
