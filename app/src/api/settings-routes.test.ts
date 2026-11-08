import { readdirSync, readFileSync } from "node:fs";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { expect, test } from "vite-plus/test";
import { z } from "zod";

import { api, type ApiBindings } from "./index";
import { encryptSecret } from "../services/crypto";

const errorResponseSchema = z.object({ error: z.string() });

function database(migrated: boolean) {
  const sqlite = new DatabaseSync(":memory:");
  if (migrated) {
    const migrations = new URL("../../migrations/", import.meta.url);
    for (const file of readdirSync(migrations)
      .filter((name) => name.endsWith(".sql"))
      .sort())
      sqlite.exec(readFileSync(new URL(file, migrations), "utf8"));
  }
  const binding = {
    prepare(sql: string) {
      let parameters: SQLInputValue[] = [];
      return {
        bind(...values: SQLInputValue[]) {
          parameters = values;
          return this;
        },
        async raw() {
          return sqlite
            .prepare(sql)
            .all(...parameters)
            .map((row) => Object.values(row));
        },
      };
    },
  } as unknown as D1Database;
  return { sqlite, binding };
}

test("settings GET reads migrated public configuration without any encryption key", async () => {
  const { sqlite, binding } = database(true);
  try {
    const response = await api.fetch(new Request("http://localhost/api/settings/integrations"), {
      DB: binding,
      INVENTIA_BASE_URL: "https://inventia.nikomaru.dev",
    } as ApiBindings);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      openrouter: { configured: false, usable: false, issue: "missing_token" },
      inventia: {
        configured: false,
        usable: false,
        issue: "missing_token",
        capabilities: { readItems: false, writeStock: false },
      },
    });
  } finally {
    sqlite.close();
  }
});

test("settings GET distinguishes stored ciphertext from unavailable preview decryption", async () => {
  const { sqlite, binding } = database(true);
  try {
    const key = btoa("settings-api-fixture".padEnd(32, "0"));
    const ciphertext = await encryptSecret("inv_fixture_only", key);
    sqlite
      .prepare(
        "INSERT INTO app_settings (key, encrypted_payload, public_config_json) VALUES (?, ?, ?)",
      )
      .run("inventia", ciphertext, JSON.stringify({ providerId: "cho" }));
    const response = await api.fetch(new Request("http://localhost/api/settings/integrations"), {
      DB: binding,
      INVENTIA_BASE_URL: "https://inventia.nikomaru.dev",
    } as ApiBindings);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.inventia).toMatchObject({
      configured: true,
      providerId: "cho",
      usable: false,
      issue: "missing_encryption_key",
    });
    expect(JSON.stringify(body)).not.toContain(ciphertext);
  } finally {
    sqlite.close();
  }
});

test("an unmigrated settings database remains an error instead of fake empty settings", async () => {
  const { sqlite, binding } = database(false);
  try {
    const response = await api.fetch(new Request("http://localhost/api/settings/integrations"), {
      DB: binding,
    } as ApiBindings);
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Internal server error" });
  } finally {
    sqlite.close();
  }
});

test("settings PUT refuses to drop a model or provider ID without a stored secret", async () => {
  const { sqlite, binding } = database(true);
  try {
    for (const body of [
      { openrouter: { model: "google/gemini-3.7-flash" } },
      { inventia: { providerId: "cho" } },
    ]) {
      const response = await api.fetch(
        new Request("http://localhost/api/settings/integrations", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
        { DB: binding } as ApiBindings,
      );
      expect(response.status).toBe(400);
      expect(errorResponseSchema.parse(await response.json()).error).toMatch(/API (key|token)/);
    }
    expect(
      sqlite.prepare("SELECT key, encrypted_payload, public_config_json FROM app_settings").all(),
    ).toEqual([]);
  } finally {
    sqlite.close();
  }
});

test.each(["/api/ingredients/fixture/stock", "/api/meals/fixture/consume-stock"])(
  "read-only API rejects %s before database access",
  async (path) => {
    const response = await api.fetch(
      new Request(`http://localhost${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: 100, idempotencyKey: "read-only-fixture" }),
      }),
      { INVENTIA_STOCK_WRITES_ENABLED: "false" } as ApiBindings,
    );
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: "Inventia stock writes are disabled in this environment.",
    });
  },
);

test("read-only meal creation rejects requested stock mutation before saving the meal", async () => {
  const input = {
    eatenAt: "2026-11-08T18:30:00.000Z",
    mealTiming: "dinner",
    sourceType: "self_cooked",
    placeName: null,
    title: "Fixture meal",
    totalPriceYen: 0,
    totalNutrition: null,
    rating: null,
    memo: null,
    imageIds: [],
    consumeStock: true,
    items: [
      {
        dishId: null,
        ingredientId: null,
        name: "Milk",
        priceYen: 0,
        nutrition: null,
        estimationSource: "manual",
        servingsFactor: 1,
        sortOrder: 0,
      },
    ],
  };
  const response = await api.fetch(
    new Request("http://localhost/api/meals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
    { INVENTIA_STOCK_WRITES_ENABLED: "false" } as ApiBindings,
  );
  expect(response.status).toBe(409);
  expect(await response.json()).toEqual({
    error: "Inventia stock writes are disabled in this environment.",
  });
});
