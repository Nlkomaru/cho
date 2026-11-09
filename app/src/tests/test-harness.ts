import { readdirSync, readFileSync } from "node:fs";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { z } from "zod";

import { api, type ApiBindings } from "../api";
import { createDbClient } from "../db/client";
import { createMcpTokenService } from "../services/mcp-tokens";

export const rpcResponseSchema = z.object({
  jsonrpc: z.literal("2.0"),
  id: z.number().optional(),
  result: z.record(z.string(), z.unknown()).optional(),
  error: z.object({ code: z.number(), message: z.string() }).optional(),
});

export interface TestD1HarnessOptions {
  enforceVariableLimit?: boolean;
  maxVariablesPerStatement?: number;
  maxBatchStatements?: number;
}

export interface TestD1Harness {
  sqlite: DatabaseSync;
  binding: D1Database;
  env: ApiBindings;
  db: ReturnType<typeof createDbClient>;
  tokens: ReturnType<typeof createMcpTokenService>;
  issueToken: (allowedTools?: string[]) => Promise<{ id: string; secret: string }>;
  callMcp: (
    secret: string,
    toolName: string,
    args: Record<string, unknown>,
    id?: number,
  ) => Promise<{
    response: Response;
    body: z.infer<typeof rpcResponseSchema>;
  }>;
  cleanup: () => void;
}

export function createTestD1Harness(options: TestD1HarnessOptions = {}): TestD1Harness {
  const enforceLimit = options.enforceVariableLimit ?? true;
  const maxVars = options.maxVariablesPerStatement ?? 100;
  const maxBatch = options.maxBatchStatements ?? 100;

  const sqlite = new DatabaseSync(":memory:");
  const migrationsDir = new URL("../../migrations/", import.meta.url);
  const migrationFiles = readdirSync(migrationsDir)
    .filter((name) => name.endsWith(".sql"))
    .sort();

  for (const file of migrationFiles) {
    const sqlContent = readFileSync(new URL(file, migrationsDir), "utf8");
    // Strip drizzle migration comments if needed, exec raw statements
    sqlite.exec(sqlContent);
  }

  const binding = {
    prepare(sql: string) {
      return {
        bind(...parameters: SQLInputValue[]) {
          if (enforceLimit && parameters.length > maxVars) {
            throw new Error(
              `D1_ERROR: too many SQL variables at offset 505: statement has ${parameters.length} bound variables (limit is ${maxVars})`,
            );
          }
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
    async batch(statements: { run: () => Promise<unknown> }[]) {
      if (statements.length > maxBatch) {
        throw new Error(
          `D1_ERROR: batch statement count ${statements.length} exceeds limit of ${maxBatch}`,
        );
      }
      sqlite.exec("BEGIN");
      try {
        const results = [];
        for (const statement of statements) {
          const meta = await statement.run();
          results.push({ success: true, results: [], meta });
        }
        sqlite.exec("COMMIT");
        return results;
      } catch (error) {
        sqlite.exec("ROLLBACK");
        throw error;
      }
    },
  } as unknown as D1Database;

  const env = { DB: binding, IMAGES_BUCKET: {} as R2Bucket } as ApiBindings;
  const db = createDbClient(binding);
  const tokens = createMcpTokenService(db);

  const issueToken = async (
    allowedTools: string[] = [
      "list_ingredients",
      "create_ingredient",
      "list_recipes",
      "create_recipe",
      "record_meal",
    ],
  ) => {
    return tokens.issueRoot({
      name: "Test E2E Runner",
      allowedTools,
    });
  };

  const callMcp = async (
    secret: string,
    toolName: string,
    args: Record<string, unknown>,
    id = 1,
  ) => {
    const response = await api.fetch(
      new Request("http://localhost/api/mcp", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${secret}`,
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id,
          method: "tools/call",
          params: { name: toolName, arguments: args },
        }),
      }),
      env,
    );
    const json = await response.json();
    return {
      response,
      body: rpcResponseSchema.parse(json),
    };
  };

  const cleanup = () => {
    try {
      sqlite.close();
    } catch {
      // ignore double close
    }
  };

  return {
    sqlite,
    binding,
    env,
    db,
    tokens,
    issueToken,
    callMcp,
    cleanup,
  };
}
