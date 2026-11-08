import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { z } from "zod";
import type { ApiBindings } from "./index";
import { createSettingsRepository } from "../repositories/settings-repository";
import { encryptSecret } from "../services/crypto";
import { createDbClient } from "../db/client";
import {
  describeIntegrationSettings,
  integrationSettingsSchema,
} from "../services/integration-settings";
function requireEncryptionKey(key: string | undefined): string {
  if (!key) throw new Error("Settings encryption is not configured");
  return key;
}

const providerConfigSchema = z
  .object({ providerId: z.string().trim().min(1).optional() })
  .passthrough();
const openRouterConfigSchema = z
  .object({ model: z.string().trim().min(1).optional() })
  .passthrough();
const requestSchema = z
  .object({
    openrouter: z
      .object({
        apiKey: z.string().trim().min(1).optional(),
        model: z.string().trim().min(1).optional(),
      })
      .strict()
      .optional(),
    inventia: z
      .object({
        token: z
          .string()
          .trim()
          .regex(/^inv_.+/)
          .optional(),
        providerId: z.string().trim().min(1).optional(),
      })
      .strict()
      .optional(),
  })
  .strict();
const route = createRoute({
  method: "get",
  path: "/api/settings/integrations",
  responses: {
    200: {
      description: "Integration configuration status",
      content: { "application/json": { schema: integrationSettingsSchema } },
    },
  },
});
const putRoute = createRoute({
  method: "put",
  path: "/api/settings/integrations",
  request: {
    body: { required: true, content: { "application/json": { schema: requestSchema } } },
  },
  responses: {
    200: {
      description: "Updated integration configuration",
      content: { "application/json": { schema: integrationSettingsSchema } },
    },
    400: {
      description: "Invalid configuration",
      content: { "application/json": { schema: z.object({ error: z.string() }).strict() } },
    },
    500: {
      description: "Server configuration error",
      content: { "application/json": { schema: z.object({ error: z.string() }).strict() } },
    },
  },
});

export const settingsRoutes = new OpenAPIHono<{ Bindings: ApiBindings }>();
settingsRoutes.openapi(route, async (context) => {
  const repository = createSettingsRepository(createDbClient(context.env.DB));
  const [openrouter, inventia] = await Promise.all([
    repository.get("openrouter"),
    repository.get("inventia"),
  ]);
  return context.json(
    await describeIntegrationSettings({ openrouter, inventia }, context.env),
    200,
  );
});
settingsRoutes.openapi(putRoute, async (context) => {
  const input = requestSchema.safeParse(context.req.valid("json"));
  if (!input.success) return context.json({ error: "Invalid integration settings" }, 400);
  const key = context.env.SETTINGS_ENCRYPTION_KEY;
  if ((input.data.openrouter?.apiKey || input.data.inventia?.token) && !key)
    return context.json({ error: "Settings encryption is not configured" }, 500);
  const repository = createSettingsRepository(createDbClient(context.env.DB));
  try {
    const [oldOpenrouter, oldInventia] = await Promise.all([
      repository.get("openrouter"),
      repository.get("inventia"),
    ]);
    if (
      input.data.openrouter &&
      !input.data.openrouter.apiKey &&
      input.data.openrouter.model !== undefined &&
      !oldOpenrouter?.encryptedPayload
    )
      return context.json({ error: "Save the OpenRouter API key before saving the model." }, 400);
    if (
      input.data.inventia &&
      !input.data.inventia.token &&
      input.data.inventia.providerId !== undefined &&
      !oldInventia?.encryptedPayload
    )
      return context.json(
        { error: "Save the Inventia API token before saving the Provider ID." },
        400,
      );
    if (input.data.openrouter) {
      const oldConfig =
        oldOpenrouter?.publicConfig === null || !oldOpenrouter
          ? {}
          : openRouterConfigSchema.parse(oldOpenrouter.publicConfig);
      const encryptedPayload = input.data.openrouter.apiKey
        ? await encryptSecret(input.data.openrouter.apiKey, requireEncryptionKey(key))
        : oldOpenrouter?.encryptedPayload;
      if (encryptedPayload)
        await repository.upsert("openrouter", {
          encryptedPayload,
          publicConfig: {
            ...oldConfig,
            ...(input.data.openrouter.model ? { model: input.data.openrouter.model } : {}),
          },
        });
    }
    if (input.data.inventia) {
      const oldConfig =
        oldInventia?.publicConfig === null || !oldInventia
          ? {}
          : providerConfigSchema.parse(oldInventia.publicConfig);
      const encryptedPayload = input.data.inventia.token
        ? await encryptSecret(input.data.inventia.token, requireEncryptionKey(key))
        : oldInventia?.encryptedPayload;
      if (encryptedPayload)
        await repository.upsert("inventia", {
          encryptedPayload,
          publicConfig: {
            ...oldConfig,
            ...(input.data.inventia.providerId
              ? { providerId: input.data.inventia.providerId }
              : {}),
          },
        });
    }
    const [openrouter, inventia] = await Promise.all([
      repository.get("openrouter"),
      repository.get("inventia"),
    ]);
    return context.json(
      await describeIntegrationSettings({ openrouter, inventia }, context.env),
      200,
    );
  } catch {
    return context.json({ error: "Unable to update integration settings" }, 500);
  }
});
