import { readdirSync, readFileSync } from "node:fs";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { expect, test } from "vite-plus/test";

import { createDbClient } from "../db/client";
import { createMcpTokenService, isMcpManagementEnabled } from "./mcp-tokens";

function database() {
  const sqlite = new DatabaseSync(":memory:");
  const migrations = new URL("../../migrations/", import.meta.url);
  for (const file of readdirSync(migrations)
    .filter((name) => name.endsWith(".sql"))
    .sort())
    sqlite.exec(readFileSync(new URL(file, migrations), "utf8"));
  const binding = {
    prepare(sql: string) {
      return {
        bind(...parameters: SQLInputValue[]) {
          const statement = sqlite.prepare(sql);
          return {
            async run() {
              return statement.run(...parameters);
            },
            async all() {
              return { results: statement.all(...parameters) };
            },
            async raw() {
              return statement.all(...parameters).map((row) => Object.values(row));
            },
          };
        },
      };
    },
  } as unknown as D1Database;
  return { sqlite, binding };
}

test("MCP tokens expire and revoke, and root usage totals respect the interval", async () => {
  const { sqlite, binding } = database();
  const service = createMcpTokenService(createDbClient(binding));
  try {
    const issued = await service.issueRoot(
      {
        name: "Meal assistant",
        allowedTools: ["list_ingredients", "record_meal"],
        expiresAt: "2026-11-10T00:00:00.000Z",
      },
      new Date("2026-11-01T00:00:00.000Z"),
    );
    expect(
      await service.authenticate(issued.secret, new Date("2026-11-09T00:00:00.000Z")),
    ).toMatchObject({
      id: issued.id,
      allowedTools: ["list_ingredients", "record_meal"],
    });
    await service.authenticate(issued.secret, new Date("2026-11-09T00:04:59.000Z"));
    expect((await service.listRoot())[0]?.lastUsedAt).toBe("2026-11-09T00:00:00.000Z");
    await service.authenticate(issued.secret, new Date("2026-11-09T00:05:01.000Z"));
    expect((await service.listRoot())[0]?.lastUsedAt).toBe("2026-11-09T00:05:01.000Z");
    expect(
      await service.authenticate(issued.secret, new Date("2026-11-10T00:00:00.000Z")),
    ).toBeNull();

    await service.recordToolCall(
      issued.id,
      "list_ingredients",
      new Date("2026-11-07T23:59:00.000Z"),
    );
    await service.recordToolCall(
      issued.id,
      "list_ingredients",
      new Date("2026-11-08T10:00:00.000Z"),
    );
    await service.recordToolCall(
      issued.id,
      "list_ingredients",
      new Date("2026-11-08T11:00:00.000Z"),
    );
    await service.recordToolCall(issued.id, "record_meal", new Date("2026-11-09T10:00:00.000Z"));
    await service.recordToolCall(issued.id, "record_meal", new Date("2026-11-10T00:00:00.000Z"));
    const usage = await service.usageRoot(issued.id, {
      from: "2026-11-08",
      to: "2026-11-09",
    });
    expect(usage).toEqual([
      {
        tokenId: issued.id,
        tokenName: "Meal assistant",
        totalCalls: 3,
        tools: [
          {
            toolName: "list_ingredients",
            totalCalls: 2,
            daily: [{ toolName: "list_ingredients", utcDate: "2026-11-08", callCount: 2 }],
          },
          {
            toolName: "record_meal",
            totalCalls: 1,
            daily: [{ toolName: "record_meal", utcDate: "2026-11-09", callCount: 1 }],
          },
        ],
      },
    ]);
    const singleDay = await service.usageRoot(issued.id, {
      from: "2026-11-09",
      to: "2026-11-09",
    });
    expect(singleDay[0]).toMatchObject({
      totalCalls: 1,
      tools: [{ toolName: "record_meal", totalCalls: 1 }],
    });
    expect(await service.revokeRoot(issued.id, new Date("2026-11-09T12:00:00.000Z"))).toBe(true);
    expect(
      await service.authenticate(issued.secret, new Date("2026-11-09T12:01:00.000Z")),
    ).toBeNull();
    expect(await service.revokeRoot(issued.id)).toBe(true);
    const stored = sqlite
      .prepare("SELECT secret_hash FROM mcp_api_tokens WHERE id = ?")
      .get(issued.id) as {
      secret_hash: string;
    };
    expect(stored.secret_hash).not.toBe(issued.secret);
    expect(await service.listRoot()).toEqual([
      expect.objectContaining({ id: issued.id, revokedAt: "2026-11-09T12:00:00.000Z" }),
    ]);

    // Test usageSummary
    const summary = await service.usageSummary(new Date("2026-11-10T12:00:00.000Z"));
    expect(summary.periodDays).toBe(30);
    expect(summary.activity).toHaveLength(30);
    expect(summary.activity[summary.activity.length - 1]?.utcDate).toBe("2026-11-10");
    expect(summary.activeTokens).toBe(0); // issued token is revoked
    expect(summary.totalCalls).toBeGreaterThanOrEqual(5);
    const listIngredientsTool = summary.tools.find((t) => t.toolName === "list_ingredients");
    expect(listIngredientsTool?.totalCalls).toBe(3);
    expect(listIngredientsTool?.lastUsedDate).toBe("2026-11-08");
  } finally {
    sqlite.close();
  }
});

test("isMcpManagementEnabled enables by default and disables only on explicit 'false'", () => {
  expect(isMcpManagementEnabled(undefined)).toBe(true);
  expect(isMcpManagementEnabled("")).toBe(true);
  expect(isMcpManagementEnabled("true")).toBe(true);
  expect(isMcpManagementEnabled("false")).toBe(false);
});
