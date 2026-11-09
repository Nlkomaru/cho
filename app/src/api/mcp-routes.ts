import { StreamableHTTPTransport } from "@hono/mcp";
import { cors } from "hono/cors";
import { Hono } from "hono";
import { z } from "zod";

import { createDbClient } from "../db/client";
import { MAX_IMAGE_BYTES } from "../domain/image";
import { mcpToolNameSchema } from "../domain/mcp";
import { imageIdSchema } from "../domain/recipe";
import { createMediaImageRepository } from "../repositories/media-image-repository";
import { verifySignedUploadUrl } from "../services/image-storage";
import { createMcpTokenService } from "../services/mcp-tokens";
import { createMcpServer } from "../services/mcp-tools";
import { ImageUploadError, readLimited, schedulePurge, storeImage } from "../services/media-images";
import { waitUntilOf } from "./image-routes";
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
  if (!/^cho_mcp_[A-Za-z0-9_-]{20,80}$/.test(token))
    return context.json({ error: "Unauthorized" }, 401);

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

  const server = createMcpServer(context.env, principal.allowedTools, {
    origin: new URL(context.req.url).origin,
    waitUntil: waitUntilOf(context),
  });
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

// Target of the URLs issued by the create_image_upload tool. The signed query authorizes
// the request, so it needs no MCP token; a URL works once because the image ID is pre-issued.
mcpRoutes.put("/api/mcp/uploads/:imageId", async (context) => {
  const imageId = imageIdSchema.safeParse(context.req.param("imageId"));
  if (!imageId.success) return context.json({ error: "Upload URL is invalid." }, 404);
  const encryptionKey = context.env.SETTINGS_ENCRYPTION_KEY;
  if (!encryptionKey) return context.json({ error: "Image signing is not configured." }, 500);
  const contentType = await verifySignedUploadUrl(context.req.url, imageId.data, encryptionKey);
  if (!contentType) return context.json({ error: "Upload URL is invalid or expired." }, 403);

  const db = createDbClient(context.env.DB);
  if (await createMediaImageRepository(db).getById(imageId.data))
    return context.json({ error: "This upload URL was already used." }, 409);
  if (Number(context.req.header("Content-Length") ?? 0) > MAX_IMAGE_BYTES)
    return context.json({ error: "Image exceeds the 10 MiB upload limit." }, 413);
  try {
    const bytes = await readLimited(context.req.raw.body, MAX_IMAGE_BYTES);
    const image = await storeImage({
      db,
      bucket: context.env.IMAGES_BUCKET,
      bytes,
      declaredType: contentType,
      id: imageId.data,
    });
    schedulePurge(db, context.env.IMAGES_BUCKET, waitUntilOf(context));
    return context.json(
      { imageId: image.id, contentType: image.contentType, byteSize: image.byteSize },
      201,
    );
  } catch (error) {
    if (error instanceof ImageUploadError)
      return context.json({ error: error.message }, error.status);
    // A concurrent PUT with the same URL loses on the primary key.
    if (await createMediaImageRepository(db).getById(imageId.data))
      return context.json({ error: "This upload URL was already used." }, 409);
    return context.json({ error: "Image upload failed." }, 500);
  }
});
