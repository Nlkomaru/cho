import { Hono } from "hono";
import { z } from "zod";

import { createDbClient } from "../db/client";
import {
  issueMcpTokenSchema,
  createMcpTokenService,
  isMcpManagementEnabled,
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

mcpTokenRoutes.post("/api/mcp/tokens", async (context) => {
  if (!isMcpManagementEnabled(context.env.MCP_MANAGEMENT_ENABLED)) {
    return context.json({ error: "MCP management is disabled in preview" }, 503);
  }
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
  if (!isMcpManagementEnabled(context.env.MCP_MANAGEMENT_ENABLED)) {
    return context.json({ error: "MCP management is disabled in preview" }, 503);
  }
  const tokens = await createMcpTokenService(createDbClient(context.env.DB)).listRoot();
  return context.json({ tokens }, 200);
});

mcpTokenRoutes.delete("/api/mcp/tokens/:id", async (context) => {
  if (!isMcpManagementEnabled(context.env.MCP_MANAGEMENT_ENABLED)) {
    return context.json({ error: "MCP management is disabled in preview" }, 503);
  }
  const id = idSchema.safeParse(context.req.param("id"));
  if (!id.success) return context.json({ error: "Invalid token ID" }, 400);
  const revoked = await createMcpTokenService(createDbClient(context.env.DB)).revokeRoot(id.data);
  return revoked ? context.body(null, 204) : context.json({ error: "Token not found" }, 404);
});

mcpTokenRoutes.get("/api/mcp/usage", async (context) => {
  if (!isMcpManagementEnabled(context.env.MCP_MANAGEMENT_ENABLED)) {
    return context.json({ error: "MCP management is disabled in preview" }, 503);
  }
  const query = usageQuerySchema.safeParse(context.req.query());
  if (!query.success) return context.json({ error: "Invalid usage query" }, 400);
  const tokenService = createMcpTokenService(createDbClient(context.env.DB));
  const [usage, summary] = await Promise.all([
    tokenService.usageRoot(query.data.tokenId, {
      from: query.data.from,
      to: query.data.to,
    }),
    tokenService.usageSummary(),
  ]);
  return context.json({ usage, summary }, 200);
});
