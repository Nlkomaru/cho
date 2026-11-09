import { readdirSync, readFileSync } from "node:fs";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { expect, test } from "vite-plus/test";
import { z } from "zod";

import { api, type ApiBindings } from "./index";
import { createDbClient } from "../db/client";
import { createMcpTokenService } from "../services/mcp-tokens";

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
    async batch(statements: { run: () => Promise<unknown> }[]) {
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
  return { sqlite, binding };
}

const rpcResponseSchema = z.object({
  jsonrpc: z.literal("2.0"),
  id: z.number().optional(),
  result: z.record(z.string(), z.unknown()).optional(),
  error: z.object({ code: z.number(), message: z.string() }).optional(),
});

async function callTool(
  env: ApiBindings,
  secret: string,
  name: string,
  args: Record<string, unknown>,
  id = 1,
  scheme = "Bearer",
) {
  const response = await api.fetch(
    new Request("http://localhost/api/mcp", {
      method: "POST",
      headers: {
        Authorization: `${scheme} ${secret}`,
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id,
        method: "tools/call",
        params: { name, arguments: args },
      }),
    }),
    env,
  );
  return { response, body: rpcResponseSchema.parse(await response.json()) };
}

const ingredientInput = {
  name: "MCP test rice",
  baseDimension: "mass",
  baseUnit: "g",
  nutritionBasisAmount: 100,
  nutritionPerBasis: {
    caloriesKcal: 350,
    proteinG: 6,
    fatG: 1,
    carbohydrateG: 78,
    fiberG: 1,
    saltEquivalentG: 0,
    micronutrients: [],
  },
};

const recipeInput = {
  name: "MCP test rice bowl",
  category: "test",
  servings: 1,
  recipe: {
    ingredients: [
      {
        id: "rice",
        ingredientId: "",
        amount: 100,
        unit: "g",
        displayAmount: "100 g",
      },
    ],
    steps: [
      {
        id: "cook",
        stepNumber: 1,
        phase: "cook",
        title: "Cook rice",
        instruction: "Cook the rice.",
        executionMode: "active",
        timing: { activeDurationSec: 60 },
        inputs: [{ type: "ingredient", ingredientEntryId: "rice" }],
      },
    ],
  },
};

test("MCP HTTP requests register ingredients and recipes, record meals, and count failed tool calls", async () => {
  const { sqlite, binding } = database();
  const env = { DB: binding, IMAGES_BUCKET: {} as R2Bucket } as ApiBindings;
  try {
    const tokens = createMcpTokenService(createDbClient(binding));
    const issued = await tokens.issueRoot({
      name: "Integration test client",
      allowedTools: [
        "list_ingredients",
        "create_ingredient",
        "list_recipes",
        "create_recipe",
        "record_meal",
      ],
    });
    expect(issued.secret).toMatch(/^cho_mcp_[0-9a-f]{64}$/);
    const stored = sqlite
      .prepare("SELECT secret_hash, allowed_tools FROM mcp_api_tokens WHERE id = ?")
      .get(issued.id) as {
      secret_hash: string;
      allowed_tools: string;
    };
    expect(stored.secret_hash).not.toBe(issued.secret);
    expect(stored.allowed_tools).toContain("create_recipe");
    expect(JSON.stringify(stored)).not.toContain(issued.secret);
    const listed = await tokens.listRoot();
    expect(listed).toHaveLength(1);
    expect(listed[0]).not.toHaveProperty("secret");
    expect(listed[0]).not.toHaveProperty("ownerSubject");
    expect(JSON.stringify(listed)).not.toContain(issued.secret);

    const ingredient = await callTool(env, issued.secret, "create_ingredient", ingredientInput);
    expect(ingredient.response.status).toBe(200);
    expect(ingredient.body.error).toBeUndefined();
    const ingredientResult = z
      .object({ ingredient: z.object({ id: z.string() }) })
      .parse(ingredient.body.result?.structuredContent);
    const ingredientId = ingredientResult.ingredient.id;

    const recipeArgs = {
      ...recipeInput,
      recipe: {
        ...recipeInput.recipe,
        ingredients: recipeInput.recipe.ingredients.map((item) => ({ ...item, ingredientId })),
      },
    };
    const recipe = await callTool(env, issued.secret, "create_recipe", recipeArgs, 2);
    expect(recipe.response.status).toBe(200);
    expect(recipe.body.error).toBeUndefined();
    const recipeResult = z
      .object({
        recipe: z.object({
          id: z.string(),
          recipe: z.object({
            ingredients: z.array(z.object({ label: z.string().nullable(), name: z.string() })),
          }),
        }),
      })
      .parse(recipe.body.result?.structuredContent);
    // The entry is sent without a name; the output shows the registered ingredient name
    expect(recipeResult.recipe.recipe.ingredients).toEqual([
      expect.objectContaining({ label: null, name: "MCP test rice" }),
    ]);
    const storedRecipe = sqlite
      .prepare("SELECT recipe_json FROM dishes WHERE id = ?")
      .get(recipeResult.recipe.id) as { recipe_json: string };
    expect(storedRecipe.recipe_json).not.toContain('"name"');
    const meal = await callTool(
      env,
      issued.secret,
      "record_meal",
      {
        eatenAt: "2026-11-09T12:00:00.000Z",
        sourceType: "self_cooked",
        title: "MCP test meal",
        items: [{ dishId: recipeResult.recipe.id, name: "MCP test rice bowl", servingsFactor: 1 }],
      },
      3,
    );
    expect(meal.response.status).toBe(200);
    expect(meal.body.error).toBeUndefined();

    const marker = "mcp-private-payload-marker";
    const failed = await callTool(
      env,
      issued.secret,
      "create_ingredient",
      { ...ingredientInput, name: "", privateMarker: marker },
      4,
    );
    expect(failed.body.result?.isError).toBe(true);

    const batch = await api.fetch(
      new Request("http://localhost/api/mcp", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${issued.secret}`,
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
        },
        body: JSON.stringify([
          {
            jsonrpc: "2.0",
            id: 5,
            method: "tools/call",
            params: { name: "list_ingredients", arguments: {} },
          },
          {
            jsonrpc: "2.0",
            id: 6,
            method: "tools/call",
            params: { name: "list_recipes", arguments: {} },
          },
        ]),
      }),
      env,
    );
    expect(batch.status).toBe(200);
    expect(Array.isArray(await batch.json())).toBe(true);

    const usageRows = sqlite
      .prepare(
        "SELECT token_id, tool_name, utc_date, call_count FROM mcp_tool_usage_daily WHERE token_id = ?",
      )
      .all(issued.id) as {
      token_id: string;
      tool_name: string;
      utc_date: string;
      call_count: number;
    }[];
    expect(usageRows.reduce((sum, row) => sum + row.call_count, 0)).toBe(6);
    expect(JSON.stringify(usageRows)).not.toContain(marker);
    const persisted = sqlite.prepare("SELECT * FROM mcp_api_tokens WHERE id = ?").get(issued.id);
    expect(JSON.stringify(persisted)).not.toContain(marker);

    // Preview environment guard test: disabled when MCP_MANAGEMENT_ENABLED is "false"
    const previewEnv = { ...env, MCP_MANAGEMENT_ENABLED: "false" };
    const previewGetTokens = await api.fetch(
      new Request("http://localhost/api/mcp/tokens"),
      previewEnv,
    );
    expect(previewGetTokens.status).toBe(503);
    expect(previewGetTokens.headers.get("Cache-Control")).toBe("no-store");
    expect(await previewGetTokens.json()).toEqual({
      error: "MCP management is disabled in preview",
    });

    const previewPostTokens = await api.fetch(
      new Request("http://localhost/api/mcp/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Preview token", allowedTools: ["list_ingredients"] }),
      }),
      previewEnv,
    );
    expect(previewPostTokens.status).toBe(503);

    const previewDeleteTokens = await api.fetch(
      new Request(`http://localhost/api/mcp/tokens/${issued.id}`, { method: "DELETE" }),
      previewEnv,
    );
    expect(previewDeleteTokens.status).toBe(503);

    const previewGetUsage = await api.fetch(
      new Request("http://localhost/api/mcp/usage"),
      previewEnv,
    );
    expect(previewGetUsage.status).toBe(503);

    // Normal access (protected by Cloudflare Access at edge, direct access internally)
    const issueResponse = await api.fetch(
      new Request("http://localhost/api/mcp/tokens", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "Managed client",
          allowedTools: ["list_ingredients"],
        }),
      }),
      env,
    );
    expect(issueResponse.headers.get("Cache-Control")).toBe("no-store");
    expect(issueResponse.status).toBe(201);
    const managedToken = (await issueResponse.json()) as { id: string; secret: string };
    expect(managedToken.secret).toMatch(/^cho_mcp_[0-9a-f]{64}$/);
    const newOwner = sqlite
      .prepare("SELECT owner_subject FROM mcp_api_tokens WHERE id = ?")
      .get(managedToken.id) as { owner_subject: string };
    expect(newOwner.owner_subject).toBe("cho-management-operator");

    sqlite
      .prepare("UPDATE mcp_api_tokens SET owner_subject = ? WHERE id = ?")
      .run("legacy-owner-from-access", issued.id);
    const listResponse = await api.fetch(new Request("http://localhost/api/mcp/tokens"), env);
    expect(listResponse.headers.get("Cache-Control")).toBe("no-store");
    expect(listResponse.status).toBe(200);
    const listedTokens = await listResponse.json();
    expect(listedTokens).toMatchObject({
      tokens: expect.arrayContaining([
        expect.objectContaining({ id: issued.id, name: "Integration test client" }),
      ]),
    });
    expect(JSON.stringify(listedTokens)).not.toContain("secretHash");
    expect(JSON.stringify(listedTokens)).not.toContain("ownerSubject");
    expect(JSON.stringify(listedTokens)).not.toContain(issued.secret);
    expect(JSON.stringify(listedTokens)).not.toContain(managedToken.secret);

    const todayUtc = new Date().toISOString().slice(0, 10);
    const usageResponse = await api.fetch(
      new Request(
        `http://localhost/api/mcp/usage?tokenId=${issued.id}&from=${todayUtc}&to=${todayUtc}`,
      ),
      env,
    );
    expect(usageResponse.headers.get("Cache-Control")).toBe("no-store");
    expect(usageResponse.status).toBe(200);
    const usageBody = (await usageResponse.json()) as {
      usage: unknown[];
      summary: { periodDays: number; totalCalls: number; activeTokens: number };
    };
    expect(usageBody).toMatchObject({
      usage: [
        expect.objectContaining({
          tokenId: issued.id,
          totalCalls: 6,
          tools: expect.arrayContaining([
            expect.objectContaining({ toolName: "create_ingredient", totalCalls: 2 }),
          ]),
        }),
      ],
      summary: expect.objectContaining({
        periodDays: 30,
        totalCalls: 6,
        activeTokens: 2,
      }),
    });
    expect(JSON.stringify(usageBody)).not.toContain(issued.secret);

    const revoked = await api.fetch(
      new Request(`http://localhost/api/mcp/tokens/${issued.id}`, {
        method: "DELETE",
      }),
      env,
    );
    expect(revoked.headers.get("Cache-Control")).toBe("no-store");
    expect(revoked.status).toBe(204);
    const repeatedRevoke = await api.fetch(
      new Request(`http://localhost/api/mcp/tokens/${issued.id}`, {
        method: "DELETE",
      }),
      env,
    );
    expect(repeatedRevoke.headers.get("Cache-Control")).toBe("no-store");
    expect(repeatedRevoke.status).toBe(204);

    const nonExistentRevoke = await api.fetch(
      new Request("http://localhost/api/mcp/tokens/non-existent-id", {
        method: "DELETE",
      }),
      env,
    );
    expect(nonExistentRevoke.headers.get("Cache-Control")).toBe("no-store");
    expect(nonExistentRevoke.status).toBe(404);
    const preservedOwner = sqlite
      .prepare("SELECT owner_subject FROM mcp_api_tokens WHERE id = ?")
      .get(issued.id) as { owner_subject: string };
    expect(preservedOwner.owner_subject).toBe("legacy-owner-from-access");
    const revokedCall = await api.fetch(
      new Request("http://localhost/api/mcp", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${issued.secret}`,
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/call",
          params: { name: "list_ingredients", arguments: {} },
        }),
      }),
      env,
    );
    expect(revokedCall.status).toBe(401);
  } finally {
    sqlite.close();
  }
});

test("MCP tool allowlists hide and reject tools outside the token grant", async () => {
  const { sqlite, binding } = database();
  const env = { DB: binding, IMAGES_BUCKET: {} as R2Bucket } as ApiBindings;
  try {
    const issued = await createMcpTokenService(createDbClient(binding)).issueRoot({
      name: "Read-only client",
      allowedTools: ["list_ingredients"],
    });
    const response = await api.fetch(
      new Request("http://localhost/api/mcp", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${issued.secret}`,
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/list",
          params: {},
        }),
      }),
      env,
    );
    expect(response.status).toBe(200);
    const list = rpcResponseSchema.parse(await response.json());
    const result = z.object({ tools: z.array(z.object({ name: z.string() })) }).parse(list.result);
    expect(result.tools.map((tool) => tool.name)).toEqual(["list_ingredients"]);
    const lowerCaseBearer = await callTool(env, issued.secret, "list_ingredients", {}, 3, "bearer");
    expect(lowerCaseBearer.response.status).toBe(200);
    expect(lowerCaseBearer.body.error).toBeUndefined();
    const browserOrigin = "https://cho.example";
    const browserEnv = { ...env, MCP_ALLOWED_ORIGINS: browserOrigin };
    const preflight = await api.fetch(
      new Request("http://localhost/api/mcp", {
        method: "OPTIONS",
        headers: {
          Origin: browserOrigin,
          "Access-Control-Request-Method": "POST",
          "Access-Control-Request-Headers":
            "Authorization,Content-Type,Accept,MCP-Protocol-Version",
        },
      }),
      browserEnv,
    );
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get("Access-Control-Allow-Origin")).toBe(browserOrigin);
    expect(preflight.headers.get("Access-Control-Allow-Methods")).toBe("POST,GET,OPTIONS");
    expect(preflight.headers.get("Access-Control-Allow-Headers")).toBe(
      "Authorization,Content-Type,Accept,MCP-Protocol-Version",
    );
    expect(preflight.headers.get("Access-Control-Max-Age")).toBe("600");
    expect(preflight.headers.get("Vary")).toBe("Origin, Access-Control-Request-Headers");
    expect(preflight.headers.get("Access-Control-Expose-Headers")).toBe(
      "MCP-Protocol-Version,MCP-Session-Id",
    );

    const browserPost = await api.fetch(
      new Request("http://localhost/api/mcp", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${issued.secret}`,
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
          Origin: browserOrigin,
        },
        body: JSON.stringify({ jsonrpc: "2.0", id: 4, method: "tools/list", params: {} }),
      }),
      browserEnv,
    );
    expect(browserPost.status).toBe(200);
    expect(browserPost.headers.get("Access-Control-Allow-Origin")).toBe(browserOrigin);
    expect(browserPost.headers.get("Access-Control-Expose-Headers")).toBe(
      "MCP-Protocol-Version,MCP-Session-Id",
    );

    const getResponse = await api.fetch(
      new Request("http://localhost/api/mcp", {
        method: "GET",
        headers: { Origin: browserOrigin },
      }),
      browserEnv,
    );
    expect(getResponse.status).toBe(405);
    expect(getResponse.headers.get("Allow")).toBe("POST, OPTIONS");

    const rejectedOptions = await api.fetch(
      new Request("http://localhost/api/mcp", {
        method: "OPTIONS",
        headers: {
          Origin: "https://untrusted.example",
          "Access-Control-Request-Method": "POST",
        },
      }),
      browserEnv,
    );
    expect(rejectedOptions.status).toBe(403);

    const rejectedOrigin = await api.fetch(
      new Request("http://localhost/api/mcp", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${issued.secret}`,
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
          Origin: "https://untrusted.example",
        },
        body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }),
      }),
      { ...env, MCP_ALLOWED_ORIGINS: "https://cho.example" },
    );
    expect(rejectedOrigin.status).toBe(403);

    const denied = await callTool(env, issued.secret, "create_ingredient", ingredientInput);
    expect(denied.body.result?.isError).toBe(true);
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM ingredients").get()).toMatchObject({
      count: 0,
    });
    expect(
      sqlite
        .prepare(
          "SELECT call_count FROM mcp_tool_usage_daily WHERE tool_name = 'create_ingredient'",
        )
        .get(),
    ).toMatchObject({ call_count: 1 });
  } finally {
    sqlite.close();
  }
});

test("MCP does not dispatch a tool when the usage aggregate write fails", async () => {
  const { sqlite, binding } = database();
  const env = { DB: binding, IMAGES_BUCKET: {} as R2Bucket } as ApiBindings;
  try {
    const issued = await createMcpTokenService(createDbClient(binding)).issueRoot({
      name: "Usage outage client",
      allowedTools: ["create_ingredient"],
    });
    sqlite.exec(
      "CREATE TRIGGER fail_mcp_usage BEFORE INSERT ON mcp_tool_usage_daily BEGIN SELECT RAISE(ABORT, 'usage unavailable'); END;",
    );
    const response = await api.fetch(
      new Request("http://localhost/api/mcp", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${issued.secret}`,
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/call",
          params: { name: "create_ingredient", arguments: ingredientInput },
        }),
      }),
      env,
    );
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "Usage recording failed" });
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM ingredients").get()).toMatchObject({
      count: 0,
    });
  } finally {
    sqlite.close();
  }
});
