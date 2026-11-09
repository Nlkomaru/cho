import { z } from "zod";

import { mcpToolNameSchema, type McpToolName } from "../domain/mcp";
import { createMcpTokenRepository } from "../repositories/mcp-token-repository";
import type { AppDatabase } from "../db/client";

export const issueMcpTokenSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    allowedTools: z.array(mcpToolNameSchema).min(1).max(5),
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

export type McpManagementPrincipal = { kind: "operator" };

export async function verifyMcpManagementBearer(
  authorization: string | undefined,
  configuredHash: string | undefined,
): Promise<McpManagementPrincipal | null> {
  const match = authorization?.match(/^Bearer (.+)$/i);
  if (
    !match ||
    !/^cho_mgr_[0-9a-f]{64}$/.test(match[1]) ||
    !configuredHash ||
    !/^[0-9a-f]{64}$/.test(configuredHash)
  )
    return null;
  const digest = await hashSecret(match[1]);
  let difference = 0;
  for (let index = 0; index < 64; index++)
    difference |= digest.charCodeAt(index) ^ configuredHash.charCodeAt(index);
  return difference === 0 ? { kind: "operator" } : null;
}

export function isMcpManagementEnabled(value: string | undefined): boolean {
  return value === "true";
}

function encodeHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function hashSecret(secret: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return encodeHex(new Uint8Array(digest));
}

export function createMcpTokenService(db: Database) {
  const repository = createMcpTokenRepository(db);
  async function issue(input: IssueMcpTokenInput, now: Date) {
    if (input.expiresAt && Date.parse(input.expiresAt) <= now.getTime())
      throw new RangeError("Token expiry must be in the future");
    const random = crypto.getRandomValues(new Uint8Array(32));
    const secret = `cho_mcp_${encodeHex(random)}`;
    const id = crypto.randomUUID();
    const createdAt = now.toISOString();
    const expiresAt = input.expiresAt ?? null;
    const allowedTools = [...new Set(input.allowedTools)];
    await repository.create({
      id,
      name: input.name,
      ownerSubject: MANAGEMENT_OWNER_SUBJECT,
      prefix: secret.slice(0, 16),
      secretHash: await hashSecret(secret),
      allowedTools,
      createdAt,
      expiresAt,
    });
    return {
      id,
      name: input.name,
      prefix: secret.slice(0, 16),
      secret,
      allowedTools,
      createdAt,
      expiresAt,
    };
  }
  return {
    issueRoot: (input: IssueMcpTokenInput, now = new Date()) => issue(input, now),
    async authenticate(secret: string, now = new Date()): Promise<McpPrincipal | null> {
      const token = await repository.getByHash(await hashSecret(secret));
      if (
        !token ||
        token.revokedAt ||
        (token.expiresAt && Date.parse(token.expiresAt) <= now.getTime())
      )
        return null;
      const timestamp = now.toISOString();
      const cutoff = new Date(now.getTime() - 5 * 60_000).toISOString();
      await repository.markUsed(token.id, timestamp, cutoff);
      return { id: token.id, allowedTools: token.allowedTools };
    },
    listRoot: () => repository.listAll(),
    revokeRoot: (id: string, now = new Date()) => repository.revokeRoot(id, now.toISOString()),
    usageRoot: (tokenId?: string, interval?: { from?: string; to?: string }) =>
      repository.usageRoot(tokenId, interval),
    recordToolCall: (tokenId: string, toolName: McpToolName, now = new Date()) =>
      repository.recordToolCall(tokenId, toolName, now.toISOString().slice(0, 10)),
  };
}
