import { once } from "node:events";
import { readdirSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { z } from "zod";

import { api, type ApiBindings } from "./index";
import { encryptSecret } from "../services/crypto";

const errorBodySchema = z.object({ error: z.string() });

const facts = JSON.stringify({
  caloriesKcal: 364,
  proteinG: 10,
  fatG: 1,
  carbohydrateG: 76,
  fiberG: null,
  saltEquivalentG: null,
  micronutrients: [],
});
const requests: { method: string; url: string; body: unknown }[] = [];
const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", "http://localhost");
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : null;
  requests.push({ method: request.method ?? "GET", url: url.pathname + url.search, body });
  response.setHeader("Content-Type", "application/json");
  const adjustment = /^\/api\/items\/([^/]+)\/adjustments$/.exec(url.pathname);
  const prices = /^\/api\/items\/([^/]+)\/prices$/.exec(url.pathname);
  const item = /^\/api\/items\/([^/]+)$/.exec(url.pathname);
  if (adjustment) {
    const id = adjustment[1] ?? "";
    if (id.includes("shortage"))
      response.writeHead(409).end(
        JSON.stringify({
          error: { code: "INSUFFICIENT_STOCK", message: "Only 10 g left" },
        }),
      );
    else if (id.includes("provider"))
      response.writeHead(404).end(
        JSON.stringify({
          error: {
            code: "EXTERNAL_PROVIDER_NOT_FOUND",
            message: "Unknown external provider",
          },
        }),
      );
    else if (id.includes("conflict"))
      response.writeHead(409).end(
        JSON.stringify({
          error: {
            code: "IDEMPOTENCY_CONFLICT",
            message: "Idempotency key reused with a different payload",
          },
        }),
      );
    else
      response.writeHead(201).end(
        JSON.stringify({
          currentQuantity: 750,
          allocations: [],
          lots: [],
          movement: null,
        }),
      );
  } else if (prices) {
    response.end(JSON.stringify({ items: [{ unitPrice: 27.5 }], nextCursor: null }));
  } else if (item) {
    const id = item[1] ?? "";
    response.end(
      JSON.stringify({
        id,
        name: id,
        baseUnit: id.endsWith("-kg") ? "kg" : "g",
        baseDimension: "mass",
        currentQuantity: 1000,
        lots: [],
      }),
    );
  } else {
    response
      .writeHead(404)
      .end(JSON.stringify({ error: { code: "ITEM_NOT_FOUND", message: "Not found" } }));
  }
});
let baseUrl = "";
beforeAll(async () => {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => {
  const closed = once(server, "close");
  server.close();
  await closed;
});

function database(sqlite: DatabaseSync) {
  return {
    prepare(sql: string) {
      let parameters: SQLInputValue[] = [];
      const statement = {
        bind(...values: SQLInputValue[]) {
          parameters = values;
          return statement;
        },
        async raw() {
          return sqlite
            .prepare(sql)
            .all(...parameters)
            .map((row) => Object.values(row));
        },
        async first() {
          return sqlite.prepare(sql).get(...parameters) ?? null;
        },
        async run() {
          sqlite.prepare(sql).run(...parameters);
          return { success: true, meta: {} };
        },
      };
      return statement;
    },
  } as unknown as D1Database;
}

async function setup(links: [string, string | null][]) {
  const sqlite = new DatabaseSync(":memory:");
  const migrations = new URL("../../migrations/", import.meta.url);
  for (const file of readdirSync(migrations)
    .filter((name) => name.endsWith(".sql"))
    .sort())
    sqlite.exec(readFileSync(new URL(file, migrations), "utf8"));
  for (const [id, inventiaItemId] of links)
    sqlite
      .prepare(
        "INSERT INTO ingredients (id, name, normalized_name, base_dimension, base_unit, nutrition_basis_amount, nutrition_json, inventia_item_id) VALUES (?, ?, ?, 'mass', 'g', 100, ?, ?)",
      )
      .run(id, id, id, facts, inventiaItemId);
  const key = btoa("stock-api-fixture".padEnd(32, "0"));
  sqlite
    .prepare(
      "INSERT INTO app_settings (key, encrypted_payload, public_config_json) VALUES (?, ?, ?)",
    )
    .run(
      "inventia",
      await encryptSecret("inv_fixture_only", key),
      JSON.stringify({ providerId: "provider-7" }),
    );
  const env = {
    DB: database(sqlite),
    SETTINGS_ENCRYPTION_KEY: key,
    INVENTIA_BASE_URL: baseUrl,
    INVENTIA_STOCK_WRITES_ENABLED: "true",
  } as ApiBindings;
  return { sqlite, env };
}

const post = (path: string, body: unknown, env: ApiBindings) =>
  api.fetch(
    new Request(`http://localhost${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    env,
  );

const adjustments = () => requests.filter((request) => request.url.includes("/adjustments"));

test("ingredient stock forwards the client idempotency key and integer amount", async () => {
  const { sqlite, env } = await setup([["flour", "item-g"]]);
  try {
    requests.length = 0;
    const response = await post(
      "/api/ingredients/flour/stock",
      { amount: 250, idempotencyKey: "ui-request-42" },
      env,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ currentQuantity: 750, allocations: [] });
    expect(requests[0]).toMatchObject({ method: "GET", url: "/api/items/item-g" });
    expect(adjustments()).toHaveLength(1);
    expect(adjustments()[0]?.body).toMatchObject({
      delta: -250,
      reason: "consume",
      idempotencyKey: "ui-request-42",
      externalProviderId: "provider-7",
      externalId: "flour",
    });
  } finally {
    sqlite.close();
  }
});

test("ingredient stock rejects a malformed or missing idempotency key", async () => {
  const { sqlite, env } = await setup([["flour", "item-g"]]);
  try {
    requests.length = 0;
    const malformed = await post(
      "/api/ingredients/flour/stock",
      { amount: 250, idempotencyKey: "bad key!" },
      env,
    );
    expect(malformed.status).toBe(400);
    expect(errorBodySchema.parse(await malformed.json()).error).toContain("idempotencyKey");
    const missing = await post("/api/ingredients/flour/stock", { amount: 250 }, env);
    expect(missing.status).toBe(400);
    expect(adjustments()).toHaveLength(0);
  } finally {
    sqlite.close();
  }
});

test("ingredient stock rejects a fractional amount naming the item unit", async () => {
  const { sqlite, env } = await setup([["flour", "item-g"]]);
  try {
    requests.length = 0;
    const response = await post(
      "/api/ingredients/flour/stock",
      { amount: 40.5, idempotencyKey: "ui-request-43" },
      env,
    );
    expect(response.status).toBe(400);
    const body = errorBodySchema.parse(await response.json());
    expect(body.error).toContain("whole number");
    expect(body.error).toContain("g");
    expect(adjustments()).toHaveLength(0);
  } finally {
    sqlite.close();
  }
});

test("ingredient stock refuses a changed Inventia unit at consume time", async () => {
  const { sqlite, env } = await setup([["rice", "item-kg"]]);
  try {
    requests.length = 0;
    const response = await post(
      "/api/ingredients/rice/stock",
      { amount: 100, idempotencyKey: "ui-request-44" },
      env,
    );
    expect(response.status).toBe(409);
    expect(errorBodySchema.parse(await response.json()).error).toContain("kg");
    expect(adjustments()).toHaveLength(0);
  } finally {
    sqlite.close();
  }
});

test("inventia price sync refuses a changed unit and links a matching item", async () => {
  const { sqlite, env } = await setup([
    ["flour", null],
    ["rice", null],
  ]);
  try {
    requests.length = 0;
    const synced = await post(
      "/api/ingredients/sync-inventia",
      { ingredientId: "flour", itemId: "item-g" },
      env,
    );
    expect(synced.status).toBe(200);
    expect(await synced.json()).toMatchObject({ synced: true, unitPriceYen: 27.5 });
    const mismatch = await post(
      "/api/ingredients/sync-inventia",
      { ingredientId: "rice", itemId: "item-kg" },
      env,
    );
    expect(mismatch.status).toBe(409);
    expect(errorBodySchema.parse(await mismatch.json()).error).toContain("kg");
    const stored = sqlite
      .prepare("SELECT inventia_item_id FROM ingredients WHERE id = 'rice'")
      .get();
    expect(stored?.inventia_item_id).toBeNull();
  } finally {
    sqlite.close();
  }
});

test("upstream stock codes become actionable conflicts instead of gateway errors", async () => {
  const { sqlite, env } = await setup([
    ["sugar", "item-shortage"],
    ["salt", "item-provider"],
    ["pepper", "item-conflict"],
  ]);
  try {
    const shortage = await post(
      "/api/ingredients/sugar/stock",
      { amount: 100, idempotencyKey: "ui-shortage" },
      env,
    );
    expect(shortage.status).toBe(409);
    const shortageBody = JSON.stringify(await shortage.json());
    expect(shortageBody).toContain("enough stock");
    expect(shortageBody).not.toContain("Only 10 g left");

    const provider = await post(
      "/api/ingredients/salt/stock",
      { amount: 100, idempotencyKey: "ui-provider" },
      env,
    );
    expect(provider.status).toBe(409);
    expect(errorBodySchema.parse(await provider.json()).error).toContain("Provider ID");

    const conflict = await post(
      "/api/ingredients/pepper/stock",
      { amount: 100, idempotencyKey: "ui-conflict" },
      env,
    );
    expect(conflict.status).toBe(409);
    expect(errorBodySchema.parse(await conflict.json()).error).toContain("idempotency key");
  } finally {
    sqlite.close();
  }
});
