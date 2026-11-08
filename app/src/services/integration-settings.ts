import { z } from "zod";

import type { StoredSettings } from "../repositories/settings-repository";
import { decryptSecret } from "./crypto";
import { createInventiaClient, type InventiaClient } from "./inventia-client";

export const integrationIssueSchema = z.enum([
  "missing_token",
  "missing_encryption_key",
  "invalid_credentials",
  "invalid_configuration",
  "missing_base_url",
  "invalid_base_url",
]);
export type IntegrationIssue = z.infer<typeof integrationIssueSchema>;
export const integrationSettingsSchema = z
  .object({
    openrouter: z
      .object({
        configured: z.boolean(),
        model: z.string(),
        usable: z.boolean(),
        issue: integrationIssueSchema.nullable(),
      })
      .strict(),
    inventia: z
      .object({
        configured: z.boolean(),
        providerId: z.string().nullable(),
        usable: z.boolean(),
        issue: integrationIssueSchema.nullable(),
        tokenSettingsUrl: z.string().nullable(),
        capabilities: z.object({ readItems: z.boolean(), writeStock: z.boolean() }).strict(),
      })
      .strict(),
  })
  .strict();
export type IntegrationSettings = z.infer<typeof integrationSettingsSchema>;
export interface IntegrationEnvironment {
  INVENTIA_BASE_URL?: string;
  SETTINGS_ENCRYPTION_KEY?: string;
  CLOUDFLARE_ACCESS_CLIENT_ID?: string;
  CLOUDFLARE_ACCESS_CLIENT_SECRET?: string;
  INVENTIA_STOCK_WRITES_ENABLED?: string;
}

const openRouterConfigSchema = z.object({ model: z.string().trim().min(1).optional() });
const inventiaConfigSchema = z.object({ providerId: z.string().trim().min(1).optional() });
const defaultModel = "google/gemini-3.7-flash";

async function decryptCredential(
  settings: StoredSettings | null,
  key: string | undefined,
): Promise<{ secret: string; issue: null } | { secret: null; issue: IntegrationIssue }> {
  if (!settings?.encryptedPayload) return { secret: null, issue: "missing_token" };
  if (!key) return { secret: null, issue: "missing_encryption_key" };
  try {
    const secret = (await decryptSecret(settings.encryptedPayload, key)).trim();
    return secret ? { secret, issue: null } : { secret: null, issue: "invalid_credentials" };
  } catch {
    return { secret: null, issue: "invalid_credentials" };
  }
}

export async function describeOpenRouterSettings(
  settings: StoredSettings | null,
  env: IntegrationEnvironment,
): Promise<IntegrationSettings["openrouter"]> {
  const config = openRouterConfigSchema.safeParse(settings?.publicConfig ?? {});
  const credential = await decryptCredential(settings, env.SETTINGS_ENCRYPTION_KEY);
  const issue = config.success ? credential.issue : "invalid_configuration";
  return {
    configured: Boolean(settings?.encryptedPayload),
    model: config.success ? (config.data.model ?? defaultModel) : defaultModel,
    usable: issue === null,
    issue,
  };
}

export async function resolveInventiaConnection(
  settings: StoredSettings | null,
  env: IntegrationEnvironment,
) {
  const config = inventiaConfigSchema.safeParse(settings?.publicConfig ?? {});
  let baseUrl: URL | null = null;
  let issue: IntegrationIssue | null = null;
  if (!env.INVENTIA_BASE_URL) {
    issue = "missing_base_url";
  } else {
    try {
      const url = new URL(env.INVENTIA_BASE_URL);
      const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
      if (
        (url.protocol !== "https:" && !(url.protocol === "http:" && local)) ||
        url.username ||
        url.password
      ) {
        issue = "invalid_base_url";
      } else {
        baseUrl = url;
      }
    } catch {
      issue = "invalid_base_url";
    }
  }
  if (!issue && !config.success) issue = "invalid_configuration";
  const credential = await decryptCredential(settings, env.SETTINGS_ENCRYPTION_KEY);
  if (!issue) issue = credential.issue;
  let client: InventiaClient | null = null;
  if (!issue && credential.secret && baseUrl) {
    try {
      client = createInventiaClient({
        baseUrl: baseUrl.origin,
        decryptedToken: credential.secret,
        cloudflareAccessClientId: env.CLOUDFLARE_ACCESS_CLIENT_ID,
        cloudflareAccessClientSecret: env.CLOUDFLARE_ACCESS_CLIENT_SECRET,
        stockWritesEnabled: env.INVENTIA_STOCK_WRITES_ENABLED === "true",
      });
    } catch {
      issue = "invalid_credentials";
    }
  }
  const providerId = config.success ? (config.data.providerId ?? null) : null;
  const usable = client !== null;
  const status: IntegrationSettings["inventia"] = {
    configured: Boolean(settings?.encryptedPayload),
    providerId,
    usable,
    issue,
    tokenSettingsUrl: baseUrl ? new URL("/settings/tokens", baseUrl.origin).href : null,
    capabilities: {
      readItems: usable,
      writeStock: usable && providerId !== null && env.INVENTIA_STOCK_WRITES_ENABLED === "true",
    },
  };
  return { status, client };
}

export async function describeIntegrationSettings(
  settings: { openrouter: StoredSettings | null; inventia: StoredSettings | null },
  env: IntegrationEnvironment,
): Promise<IntegrationSettings> {
  const [openrouter, inventia] = await Promise.all([
    describeOpenRouterSettings(settings.openrouter, env),
    resolveInventiaConnection(settings.inventia, env),
  ]);
  return { openrouter, inventia: inventia.status };
}

export const inventiaStockWritesDisabledMessage =
  "Inventia stock writes are disabled in this environment.";

const inventiaIssueMessages: Record<IntegrationIssue, string> = {
  missing_token:
    "Inventia API token is not stored. Issue a token in Inventia settings and save it in Cho settings.",
  missing_encryption_key:
    "Settings encryption is not configured. Ask the operator to set SETTINGS_ENCRYPTION_KEY.",
  invalid_credentials:
    "Inventia credentials cannot be decrypted or are invalid. Check the encryption key and save the API token again.",
  invalid_configuration: "Inventia settings are invalid. Correct the integration configuration.",
  missing_base_url: "Inventia URL is not configured. Ask the operator to set INVENTIA_BASE_URL.",
  invalid_base_url: "Inventia URL is invalid. Ask the operator to correct INVENTIA_BASE_URL.",
};

export function inventiaConfigurationMessage(issue: IntegrationIssue | null): string {
  return issue ? inventiaIssueMessages[issue] : "Inventia is not configured.";
}
