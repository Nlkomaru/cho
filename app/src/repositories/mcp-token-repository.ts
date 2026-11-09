import { and, asc, eq, gte, isNull, lte, or, sql } from "drizzle-orm";
import { z } from "zod";

import type { AppDatabase } from "../db/client";
import { mcpToolNameSchema, mcpToolNames, type McpToolName } from "../domain/mcp";
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

export type McpUsageSummary = {
  periodDays: 30;
  totalCalls: number;
  activeTokens: number;
  tools: { toolName: string; totalCalls: number; lastUsedDate: string | null }[];
  activity: { utcDate: string; callCount: number }[];
};
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
    async upsert(input: {
      id: string;
      name: string;
      ownerSubject: string;
      prefix: string;
      secretHash: string;
      allowedTools: readonly string[];
      createdAt: string;
      expiresAt: string | null;
      lastUsedAt?: string | null;
    }): Promise<void> {
      await db
        .insert(mcpApiTokens)
        .values({
          id: input.id,
          name: input.name,
          ownerSubject: input.ownerSubject,
          prefix: input.prefix,
          secretHash: input.secretHash,
          allowedTools: JSON.stringify(input.allowedTools),
          createdAt: input.createdAt,
          expiresAt: input.expiresAt,
          lastUsedAt: input.lastUsedAt ?? null,
        })
        .onConflictDoUpdate({
          target: mcpApiTokens.id,
          set: {
            name: input.name,
            expiresAt: input.expiresAt,
            allowedTools: JSON.stringify(input.allowedTools),
          },
        });
    },
    async getById(id: string): Promise<McpTokenRecord | null> {
      const [row] = await db.select().from(mcpApiTokens).where(eq(mcpApiTokens.id, id)).limit(1);
      return row ? parseToken(row) : null;
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
    async usageSummary(now = new Date()): Promise<McpUsageSummary> {
      const today = now.toISOString().slice(0, 10);
      const todayDate = new Date(`${today}T00:00:00.000Z`);
      const startDate = new Date(todayDate.getTime() - 29 * 86400000).toISOString().slice(0, 10);

      const [dailyRows, allTokens] = await Promise.all([
        db
          .select({
            tokenId: mcpToolUsageDaily.tokenId,
            toolName: mcpToolUsageDaily.toolName,
            utcDate: mcpToolUsageDaily.utcDate,
            callCount: mcpToolUsageDaily.callCount,
          })
          .from(mcpToolUsageDaily)
          .where(
            and(gte(mcpToolUsageDaily.utcDate, startDate), lte(mcpToolUsageDaily.utcDate, today)),
          ),
        db.select().from(mcpApiTokens),
      ]);

      const nowIso = now.toISOString();
      const activeTokens = allTokens.filter(
        (t) => t.revokedAt === null && (!t.expiresAt || t.expiresAt > nowIso),
      ).length;

      const dailyTotals = new Map<string, number>();
      for (const row of dailyRows) {
        dailyTotals.set(row.utcDate, (dailyTotals.get(row.utcDate) ?? 0) + row.callCount);
      }

      const activity = Array.from({ length: 30 }, (_, index) => {
        const d = new Date(todayDate.getTime() - (29 - index) * 86400000)
          .toISOString()
          .slice(0, 10);
        return { utcDate: d, callCount: dailyTotals.get(d) ?? 0 };
      });

      const toolMap = new Map<string, { totalCalls: number; lastUsedDate: string | null }>();
      for (const tool of mcpToolNames) {
        toolMap.set(tool, { totalCalls: 0, lastUsedDate: null });
      }
      for (const row of dailyRows) {
        const item = toolMap.get(row.toolName) ?? { totalCalls: 0, lastUsedDate: null };
        item.totalCalls += row.callCount;
        if (!item.lastUsedDate || row.utcDate > item.lastUsedDate) {
          item.lastUsedDate = row.utcDate;
        }
        toolMap.set(row.toolName, item);
      }

      const tools = [...toolMap.entries()].map(([toolName, data]) => ({
        toolName,
        totalCalls: data.totalCalls,
        lastUsedDate: data.lastUsedDate,
      }));

      const totalCalls = dailyRows.reduce((sum, row) => sum + row.callCount, 0);

      return {
        periodDays: 30,
        totalCalls,
        activeTokens,
        tools,
        activity,
      };
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
