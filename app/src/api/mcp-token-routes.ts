import { Hono } from "hono";
import { z } from "zod";

import { createDbClient } from "../db/client";
import { issueMcpTokenSchema, createMcpTokenService } from "../services/mcp-tokens";
import { verifyCloudflareAccessAdmin } from "../services/cloudflare-access";
import type { ApiBindings } from "./index";

export const mcpTokenRoutes = new Hono<{ Bindings: ApiBindings }>();
const idSchema = z.string().trim().min(1).max(128);
const usageQuerySchema = z
  .object({
    tokenId: idSchema.optional(),
    from: z.iso.date().optional(),
    to: z.iso.date().optional(),
  })
  .strict()
  .refine((query) => !query.from || !query.to || query.from <= query.to);

async function requireAdmin(request: Request, env: ApiBindings) {
  return verifyCloudflareAccessAdmin(request, env);
}

mcpTokenRoutes.post("/api/mcp/tokens", async (context) => {
  const admin = await requireAdmin(context.req.raw, context.env);
  if (!admin) return context.json({ error: "Unauthorized" }, 401);
  let body: unknown;
  try {
    body = await context.req.json();
  } catch {
    return context.json({ error: "Invalid token request" }, 400);
  }
  const input = issueMcpTokenSchema.safeParse(body);
  if (!input.success) return context.json({ error: "Invalid token request" }, 400);
  try {
    const token = await createMcpTokenService(createDbClient(context.env.DB)).issue(
      admin.subject,
      input.data,
    );
    return context.json(token, 201);
  } catch (error) {
    if (error instanceof RangeError) return context.json({ error: "Invalid token expiry" }, 400);
    throw error;
  }
});

mcpTokenRoutes.get("/api/mcp/tokens", async (context) => {
  const admin = await requireAdmin(context.req.raw, context.env);
  if (!admin) return context.json({ error: "Unauthorized" }, 401);
  const tokens = await createMcpTokenService(createDbClient(context.env.DB)).list(admin.subject);
  return context.json({ tokens }, 200);
});

mcpTokenRoutes.delete("/api/mcp/tokens/:id", async (context) => {
  const admin = await requireAdmin(context.req.raw, context.env);
  if (!admin) return context.json({ error: "Unauthorized" }, 401);
  const id = idSchema.safeParse(context.req.param("id"));
  if (!id.success) return context.json({ error: "Invalid token ID" }, 400);
  const revoked = await createMcpTokenService(createDbClient(context.env.DB)).revoke(
    id.data,
    admin.subject,
  );
  return revoked ? context.body(null, 204) : context.json({ error: "Token not found" }, 404);
});

mcpTokenRoutes.get("/api/mcp/usage", async (context) => {
  const admin = await requireAdmin(context.req.raw, context.env);
  if (!admin) return context.json({ error: "Unauthorized" }, 401);
  const query = usageQuerySchema.safeParse(context.req.query());
  if (!query.success) return context.json({ error: "Invalid usage query" }, 400);
  const usage = await createMcpTokenService(createDbClient(context.env.DB)).usage(
    admin.subject,
    query.data.tokenId,
    { from: query.data.from, to: query.data.to },
  );
  return context.json({ usage }, 200);
});
