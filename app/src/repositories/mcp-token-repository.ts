import { and, asc, eq, gte, isNull, lte, or, sql } from "drizzle-orm";
import { z } from "zod";

import type { AppDatabase } from "../db/client";
import { mcpToolNameSchema, type McpToolName } from "../domain/mcp";
import { mcpApiTokens, mcpToolUsageDaily } from "../db/schema";

export type McpTokenRecord = {
  id: string;
  name: string;
  prefix: string;
  secretHash: string;
  allowedTools: McpToolName[];
  createdAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
  lastUsedAt: string | null;
};

export type McpTokenSummary = Pick<
  McpTokenRecord,
  "id" | "name" | "prefix" | "allowedTools" | "createdAt" | "expiresAt" | "revokedAt" | "lastUsedAt"
>;
type Database = AppDatabase;

function parseToken(row: typeof mcpApiTokens.$inferSelect): McpTokenRecord {
  const allowedTools = z.array(mcpToolNameSchema).parse(JSON.parse(row.allowedTools));
  return {
    id: row.id,
    name: row.name,
    prefix: row.prefix,
    secretHash: row.secretHash,
    allowedTools,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    revokedAt: row.revokedAt,
    lastUsedAt: row.lastUsedAt,
  };
}

function summary(token: McpTokenRecord): McpTokenSummary {
  return {
    id: token.id,
    name: token.name,
    prefix: token.prefix,
    allowedTools: token.allowedTools,
    createdAt: token.createdAt,
    expiresAt: token.expiresAt,
    revokedAt: token.revokedAt,
    lastUsedAt: token.lastUsedAt,
  };
}

export function createMcpTokenRepository(db: Database) {
  return {
    async create(input: {
      id: string;
      name: string;
      ownerSubject: string;
      prefix: string;
      secretHash: string;
      allowedTools: readonly string[];
      createdAt: string;
      expiresAt: string | null;
    }): Promise<void> {
      await db.insert(mcpApiTokens).values({
        id: input.id,
        name: input.name,
        ownerSubject: input.ownerSubject,
        prefix: input.prefix,
        secretHash: input.secretHash,
        allowedTools: JSON.stringify(input.allowedTools),
        createdAt: input.createdAt,
        expiresAt: input.expiresAt,
      });
    },
    async getByHash(secretHash: string): Promise<McpTokenRecord | null> {
      const [row] = await db
        .select()
        .from(mcpApiTokens)
        .where(eq(mcpApiTokens.secretHash, secretHash))
        .limit(1);
      return row ? parseToken(row) : null;
    },
    async listAll(): Promise<McpTokenSummary[]> {
      const rows = await db
        .select()
        .from(mcpApiTokens)
        .orderBy(asc(mcpApiTokens.createdAt), asc(mcpApiTokens.id));
      return rows.map(parseToken).map(summary);
    },
    async revokeRoot(id: string, revokedAt: string): Promise<boolean> {
      const rows = await db
        .update(mcpApiTokens)
        .set({ revokedAt })
        .where(and(eq(mcpApiTokens.id, id), isNull(mcpApiTokens.revokedAt)))
        .returning({ id: mcpApiTokens.id });
      if (rows.length > 0) return true;
      const [existing] = await db
        .select({ id: mcpApiTokens.id })
        .from(mcpApiTokens)
        .where(eq(mcpApiTokens.id, id))
        .limit(1);
      return !!existing;
    },
    async usageRoot(tokenId?: string, interval?: { from?: string; to?: string }) {
      const tokens = await db
        .select({ id: mcpApiTokens.id, name: mcpApiTokens.name })
        .from(mcpApiTokens)
        .where(tokenId ? eq(mcpApiTokens.id, tokenId) : undefined)
        .orderBy(asc(mcpApiTokens.name), asc(mcpApiTokens.id));
      return Promise.all(
        tokens.map(async (token) => {
          const usageConditions = [eq(mcpToolUsageDaily.tokenId, token.id)];
          if (interval?.from) usageConditions.push(gte(mcpToolUsageDaily.utcDate, interval.from));
          if (interval?.to) usageConditions.push(lte(mcpToolUsageDaily.utcDate, interval.to));
          const rows = await db
            .select({
              toolName: mcpToolUsageDaily.toolName,
              utcDate: mcpToolUsageDaily.utcDate,
              callCount: mcpToolUsageDaily.callCount,
            })
            .from(mcpToolUsageDaily)
            .where(and(...usageConditions))
            .orderBy(asc(mcpToolUsageDaily.utcDate), asc(mcpToolUsageDaily.toolName));
          const totalsByTool = new Map<string, number>();
          for (const row of rows)
            totalsByTool.set(row.toolName, (totalsByTool.get(row.toolName) ?? 0) + row.callCount);
          return {
            tokenId: token.id,
            tokenName: token.name,
            totalCalls: rows.reduce((sum, row) => sum + row.callCount, 0),
            tools: [...totalsByTool].map(([toolName, totalCalls]) => ({
              toolName,
              totalCalls,
              daily: rows.filter((row) => row.toolName === toolName),
            })),
          };
        }),
      );
    },
    async markUsed(id: string, lastUsedAt: string, olderThan: string): Promise<void> {
      await db
        .update(mcpApiTokens)
        .set({ lastUsedAt })
        .where(
          and(
            eq(mcpApiTokens.id, id),
            or(isNull(mcpApiTokens.lastUsedAt), lte(mcpApiTokens.lastUsedAt, olderThan)),
          ),
        );
    },
    async recordToolCall(tokenId: string, toolName: string, utcDate: string): Promise<void> {
      await db
        .insert(mcpToolUsageDaily)
        .values({ tokenId, toolName, utcDate, callCount: 1 })
        .onConflictDoUpdate({
          target: [
            mcpToolUsageDaily.tokenId,
            mcpToolUsageDaily.toolName,
            mcpToolUsageDaily.utcDate,
          ],
          set: { callCount: sql`${mcpToolUsageDaily.callCount} + 1` },
        });
    },
  };
}
