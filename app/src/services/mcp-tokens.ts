import { apiKey } from "@better-auth/api-key";
import { betterAuth, type SecondaryStorage } from "better-auth";
import { z } from "zod";

import { mcpToolNameSchema, mcpToolNames, type McpToolName } from "../domain/mcp";
import {
  createMcpTokenRepository,
  type McpTokenRecord,
  type McpUsageSummary,
} from "../repositories/mcp-token-repository";
export type { McpUsageSummary };
import type { AppDatabase } from "../db/client";

export const issueMcpTokenSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    allowedTools: z.array(mcpToolNameSchema).min(1).max(mcpToolNames.length),
    expiresAt: z.iso.datetime().nullable().optional(),
  })
  .strict();
export type IssueMcpTokenInput = z.infer<typeof issueMcpTokenSchema>;
export type IssuedMcpToken = {
  id: string;
  name: string;
  prefix: string;
  secret: string;
  allowedTools: McpToolName[];
  createdAt: string;
  expiresAt: string | null;
};
export type McpPrincipal = {
  id: string;
  allowedTools: McpToolName[];
};

type Database = AppDatabase;
const MANAGEMENT_OWNER_SUBJECT = "cho-management-operator";

export function isMcpManagementEnabled(value: string | undefined): boolean {
  return value !== "false";
}

function encodeHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function hashSecretHex(secret: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return encodeHex(new Uint8Array(digest));
}

function serializeRowToApiKey(row: McpTokenRecord & { ownerSubject?: string }): string {
  return JSON.stringify({
    configId: "mcp",
    id: row.id,
    name: row.name,
    prefix: "cho_mcp_",
    start: row.prefix,
    key: row.secretHash,
    enabled: row.revokedAt === null,
    expiresAt: row.expiresAt ? new Date(row.expiresAt).toISOString() : null,
    referenceId:
      "ownerSubject" in row && row.ownerSubject ? row.ownerSubject : MANAGEMENT_OWNER_SUBJECT,
    lastRefillAt: null,
    lastRequest: row.lastUsedAt ? new Date(row.lastUsedAt).toISOString() : null,
    metadata: { allowedTools: row.allowedTools },
    rateLimitMax: 10,
    rateLimitTimeWindow: 86400000,
    remaining: null,
    refillAmount: null,
    refillInterval: null,
    rateLimitEnabled: false,
    requestCount: 0,
    permissions: null,
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.lastUsedAt ?? row.createdAt).toISOString(),
  });
}

export function createMcpTokenService(db: Database) {
  const repository = createMcpTokenRepository(db);

  const customStorage: SecondaryStorage = {
    async get(key: string): Promise<string | null> {
      if (key.startsWith("api-key:by-id:")) {
        const id = key.slice("api-key:by-id:".length);
        const row = await repository.getById(id);
        if (!row || row.revokedAt !== null) return null;
        return serializeRowToApiKey(row);
      }
      if (key.startsWith("api-key:")) {
        const secretHash = key.slice("api-key:".length);
        const row = await repository.getByHash(secretHash);
        if (!row || row.revokedAt !== null) return null;
        return serializeRowToApiKey(row);
      }
      return null;
    },
    async set(key: string, value: string): Promise<void> {
      if (key.startsWith("api-key:by-id:") || key.startsWith("api-key:")) {
        let data: {
          id?: string;
          name?: string;
          referenceId?: string;
          start?: string;
          prefix?: string;
          key?: string;
          metadata?: { allowedTools?: McpToolName[] };
          createdAt?: string;
          expiresAt?: string | null;
          lastRequest?: string | null;
        };
        try {
          data = JSON.parse(value);
        } catch {
          return;
        }
        if (!data?.id || !data?.key) return;
        const allowedTools = data.metadata?.allowedTools ?? [...mcpToolNames];
        const prefix =
          data.start ?? (typeof data.key === "string" ? data.key.slice(0, 16) : "cho_mcp_");
        const createdAt = data.createdAt
          ? new Date(data.createdAt).toISOString()
          : new Date().toISOString();
        const expiresAt = data.expiresAt ? new Date(data.expiresAt).toISOString() : null;

        await repository.upsert({
          id: data.id,
          name: data.name ?? "MCP Client",
          ownerSubject: data.referenceId ?? MANAGEMENT_OWNER_SUBJECT,
          prefix,
          secretHash: data.key,
          allowedTools,
          createdAt,
          expiresAt,
        });
      }
    },
    async delete(key: string): Promise<void> {
      const now = new Date().toISOString();
      if (key.startsWith("api-key:by-id:")) {
        const id = key.slice("api-key:by-id:".length);
        await repository.revokeRoot(id, now);
      } else if (key.startsWith("api-key:")) {
        const secretHash = key.slice("api-key:".length);
        const row = await repository.getByHash(secretHash);
        if (row) {
          await repository.revokeRoot(row.id, now);
        }
      }
    },
  };

  const auth = betterAuth({
    secret: "cho-mcp-internal-auth-secret-key-salt-32chars",
    baseURL: "https://cho.local",
    logger: { disabled: true },
    plugins: [
      apiKey({
        configId: "mcp",
        references: "user",
        storage: "secondary-storage",
        customStorage,
        defaultPrefix: "cho_mcp_",
        defaultKeyLength: 64,
        startingCharactersConfig: {
          shouldStore: true,
          charactersLength: 16,
        },
        keyExpiration: {
          minExpiresIn: 0,
          maxExpiresIn: 3650,
        },
        customKeyGenerator: ({ prefix }) => {
          const bytes = crypto.getRandomValues(new Uint8Array(32));
          const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
          return `${prefix ?? "cho_mcp_"}${hex}`;
        },
        enableMetadata: true,
        rateLimit: { enabled: false },
      }),
    ],
  });

  async function issue(input: IssueMcpTokenInput, now: Date): Promise<IssuedMcpToken> {
    if (input.expiresAt && Date.parse(input.expiresAt) <= now.getTime()) {
      throw new RangeError("Token expiry must be in the future");
    }
    const expiresInSeconds = input.expiresAt
      ? Math.max(1, Math.floor((Date.parse(input.expiresAt) - now.getTime()) / 1000))
      : undefined;
    const allowedTools = [...new Set(input.allowedTools)];

    const created = await auth.api.createApiKey({
      body: {
        configId: "mcp",
        name: input.name,
        userId: MANAGEMENT_OWNER_SUBJECT,
        expiresIn: expiresInSeconds,
        metadata: { allowedTools },
      },
    });

    const createdAt = now.toISOString();
    const expiresAt = input.expiresAt ?? null;
    const prefix = created.key.slice(0, 16);

    const storedRow = await repository.getById(created.id);
    await repository.upsert({
      id: created.id,
      name: input.name,
      ownerSubject: MANAGEMENT_OWNER_SUBJECT,
      prefix,
      secretHash: storedRow?.secretHash ?? created.key,
      allowedTools,
      createdAt,
      expiresAt,
    });

    return {
      id: created.id,
      name: input.name,
      prefix,
      secret: created.key,
      allowedTools,
      createdAt,
      expiresAt,
    };
  }

  return {
    issueRoot: (input: IssueMcpTokenInput, now = new Date()) => issue(input, now),
    async authenticate(secret: string, now = new Date()): Promise<McpPrincipal | null> {
      let principalToken: McpTokenRecord | null = null;

      try {
        const verified = await auth.api.verifyApiKey({
          body: {
            configId: "mcp",
            key: secret,
          },
        });
        if (verified?.valid && verified.key) {
          if (verified.key.expiresAt && verified.key.expiresAt.getTime() <= now.getTime()) {
            return null;
          }
          principalToken = await repository.getById(verified.key.id);
        }
      } catch {
        // Fall back to direct hash lookup if verify threw
      }

      if (!principalToken) {
        const digest = await hashSecretHex(secret);
        principalToken = await repository.getByHash(digest);
      }

      if (
        !principalToken ||
        principalToken.revokedAt ||
        (principalToken.expiresAt && Date.parse(principalToken.expiresAt) <= now.getTime())
      ) {
        return null;
      }

      const timestamp = now.toISOString();
      const cutoff = new Date(now.getTime() - 5 * 60_000).toISOString();
      await repository.markUsed(principalToken.id, timestamp, cutoff);
      return { id: principalToken.id, allowedTools: principalToken.allowedTools };
    },
    listRoot: () => repository.listAll(),
    revokeRoot: (id: string, now = new Date()) => repository.revokeRoot(id, now.toISOString()),
    usageRoot: (tokenId?: string, interval?: { from?: string; to?: string }) =>
      repository.usageRoot(tokenId, interval),
    usageSummary: (now = new Date()) => repository.usageSummary(now),
    recordToolCall: (tokenId: string, toolName: McpToolName, now = new Date()) =>
      repository.recordToolCall(tokenId, toolName, now.toISOString().slice(0, 10)),
  };
}
