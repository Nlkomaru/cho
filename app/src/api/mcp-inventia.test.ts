import { once } from "node:events";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, expect, test } from "vite-plus/test";

import { api } from "./index";
import { createTestD1Harness, type TestD1Harness } from "../tests/test-harness";
import { encryptSecret } from "../services/crypto";

const requests: string[] = [];
const prices: Record<string, number> = { "item-g": 27.5, "item-g2": 40 };
const server = createServer((request, response) => {
  const url = new URL(request.url ?? "/", "http://localhost");
  requests.push(url.pathname);
  response.setHeader("Content-Type", "application/json");
  const itemPrices = /^\/api\/items\/([^/]+)\/prices$/.exec(url.pathname);
  const item = /^\/api\/items\/([^/]+)$/.exec(url.pathname);
  if (url.pathname === "/api/items") {
    response.end(
      JSON.stringify({
        items: [
          {
            id: "item-g",
            name: "Flour",
            baseUnit: "g",
            baseDimension: "mass",
            currentQuantity: 1000,
          },
        ],
        nextCursor: null,
      }),
    );
  } else if (itemPrices) {
    const price = prices[itemPrices[1] ?? ""];
    response.end(
      JSON.stringify({
        items: price === undefined ? [] : [{ unitPrice: price }],
        nextCursor: null,
      }),
    );
  } else if (item) {
    const id = item[1] ?? "";
    if (id.includes("missing") || id.includes("gone")) {
      response
        .writeHead(404)
        .end(JSON.stringify({ error: { code: "ITEM_NOT_FOUND", message: "Not found" } }));
      return;
    }
    const volume = id.endsWith("-ml");
    response.end(
      JSON.stringify({
        id,
        name: id,
        baseUnit: volume ? "mL" : "g",
        baseDimension: volume ? "volume" : "mass",
        currentQuantity: 1000,
        lots: [],
      }),
    );
  } else {
    response.writeHead(404).end(JSON.stringify({ error: { code: "ITEM_NOT_FOUND" } }));
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

const nutrition = {
  caloriesKcal: 350,
  proteinG: 6,
  fatG: 1,
  carbohydrateG: 78,
  fiberG: 1,
  saltEquivalentG: 0,
  micronutrients: [],
};
const massIngredient = {
  name: "Flour",
  baseDimension: "mass",
  baseUnit: "g",
  nutritionBasisAmount: 100,
  nutritionPerBasis: nutrition,
};

type Structured = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

async function setup(configured: boolean) {
  const harness = createTestD1Harness();
  if (configured) {
    const key = btoa("mcp-inventia-fixture".padEnd(32, "0"));
    harness.sqlite
      .prepare(
        "INSERT INTO app_settings (key, encrypted_payload, public_config_json) VALUES (?, ?, ?)",
      )
      .run("inventia", await encryptSecret("inv_fixture_only", key), JSON.stringify({}));
    Object.assign(harness.env, { SETTINGS_ENCRYPTION_KEY: key, INVENTIA_BASE_URL: baseUrl });
  }
  const { secret } = await harness.issueToken([
    "list_ingredients",
    "get_ingredient",
    "create_ingredient",
    "update_ingredient",
    "delete_ingredient",
    "search_inventia_items",
    "link_inventia_item",
    "get_ingredient_stock",
    "list_recipes",
    "get_recipe",
    "create_recipe",
    "update_recipe",
    "delete_recipe",
    "calculate_purchase_list",
    "list_meals",
    "get_meal",
    "record_meal",
    "update_meal",
    "delete_meal",
  ]);
  async function call(name: string, args: Record<string, unknown>) {
    const { body } = await harness.callMcp(secret, name, args);
    const content = body.result?.content as { text: string }[] | undefined;
    return {
      error: body.result?.isError === true ? (content?.[0]?.text ?? "error") : null,
      data: (body.result?.structuredContent ?? {}) as Structured,
    };
  }
  return { harness, secret, call };
}

function ingredientCount(harness: TestD1Harness) {
  return (harness.sqlite.prepare("SELECT COUNT(*) AS c FROM ingredients").get() as { c: number }).c;
}

test("linking an Inventia item over MCP is refused when Inventia is not configured", async () => {
  const { harness, call } = await setup(false);
  try {
    const created = await call("create_ingredient", {
      ...massIngredient,
      inventiaItemId: "item-g",
    });
    expect(created.error).toContain("Inventia");
    expect(ingredientCount(harness)).toBe(0);

    const plain = await call("create_ingredient", massIngredient);
    const id = plain.data.ingredient.id as string;
    const updated = await call("update_ingredient", { id, inventiaItemId: "item-g" });
    expect(updated.error).toContain("Inventia");
    expect((await call("get_ingredient", { id })).data.ingredient.inventiaItemId).toBeNull();
  } finally {
    harness.cleanup();
  }
});

test("create_ingredient verifies the Inventia item, pulls its price and accepts the snake_case alias", async () => {
  const { harness, call } = await setup(true);
  try {
    const linked = await call("create_ingredient", {
      ...massIngredient,
      inventia_item_id: "item-g",
    });
    expect(linked.error).toBeNull();
    expect(linked.data.created).toBe(true);
    expect(linked.data.ingredient).toMatchObject({
      inventiaItemId: "item-g",
      latestUnitPriceYen: 27.5,
    });

    const missing = await call("create_ingredient", {
      ...massIngredient,
      inventiaItemId: "missing-xyz",
    });
    expect(missing.error).toContain("no longer exists");
    const mismatch = await call("create_ingredient", {
      ...massIngredient,
      inventiaItemId: "milk-ml",
    });
    expect(mismatch.error).not.toBeNull();
    expect(ingredientCount(harness)).toBe(1);

    const conflict = await call("create_ingredient", {
      ...massIngredient,
      inventiaItemId: "item-g",
      inventia_item_id: "item-g2",
    });
    expect(conflict.error).toContain("must match");
    const traversal = await call("create_ingredient", { ...massIngredient, inventiaItemId: ".." });
    expect(traversal.error).toContain("Inventia item ID");
  } finally {
    harness.cleanup();
  }
});

test("update_ingredient keeps a link requested together with a unit change and refreshes the price on relink", async () => {
  const { harness, call } = await setup(true);
  try {
    const created = await call("create_ingredient", {
      ...massIngredient,
      inventiaItemId: "item-g",
    });
    const id = created.data.ingredient.id as string;

    const relinked = await call("update_ingredient", { id, inventiaItemId: "item-g2" });
    expect(relinked.data.ingredient).toMatchObject({
      inventiaItemId: "item-g2",
      latestUnitPriceYen: 40,
    });

    const converted = await call("update_ingredient", {
      id,
      baseDimension: "volume",
      baseUnit: "mL",
      inventiaItemId: "oil-ml",
    });
    expect(converted.error).toBeNull();
    expect(converted.data.ingredient).toMatchObject({
      baseUnit: "mL",
      inventiaItemId: "oil-ml",
      latestUnitPriceYen: null,
    });

    const reunit = await call("update_ingredient", { id, baseDimension: "mass", baseUnit: "g" });
    expect(reunit.data.ingredient).toMatchObject({ inventiaItemId: null });

    const relink = await call("update_ingredient", { id, inventiaItemId: "item-g" });
    expect(relink.data.ingredient.latestUnitPriceYen).toBe(27.5);
    const unlinked = await call("update_ingredient", { id, inventiaItemId: null });
    expect(unlinked.data.ingredient).toMatchObject({
      inventiaItemId: null,
      latestUnitPriceYen: null,
    });

    const conflict = await call("update_ingredient", {
      id,
      inventiaItemId: "item-g",
      inventia_item_id: "item-g2",
    });
    expect(conflict.error).toContain("must match");
  } finally {
    harness.cleanup();
  }
});

test("search_inventia_items, link_inventia_item and get_ingredient_stock use the Inventia connection", async () => {
  const { harness, call } = await setup(true);
  try {
    const found = await call("search_inventia_items", { query: "flour" });
    expect(found.data).toMatchObject({
      items: [{ id: "item-g", name: "Flour", currentQuantity: 1000 }],
      total: 1,
      truncated: false,
    });

    const created = await call("create_ingredient", massIngredient);
    const id = created.data.ingredient.id as string;
    const linked = await call("link_inventia_item", { ingredientId: id, itemId: "item-g" });
    expect(linked.data).toMatchObject({ synced: true, unitPriceYen: 27.5 });
    expect(linked.data.ingredient.inventiaItemId).toBe("item-g");

    expect((await call("get_ingredient_stock", { ingredientId: id })).data).toEqual({
      found: true,
      currentQuantity: 1000,
      baseUnit: "g",
    });

    const noPrice = await call("link_inventia_item", { ingredientId: id, itemId: "item-g3" });
    expect(noPrice.data).toMatchObject({ synced: false, unitPriceYen: null });
    expect(noPrice.data.ingredient).toMatchObject({
      inventiaItemId: "item-g3",
      latestUnitPriceYen: null,
    });

    const bad = await call("link_inventia_item", { ingredientId: id, itemId: "missing-1" });
    expect(bad.error).toContain("no longer exists");
  } finally {
    harness.cleanup();
  }
});

test("search_inventia_items reports a configuration error when Inventia is not configured", async () => {
  const { harness, call } = await setup(false);
  try {
    const result = await call("search_inventia_items", { query: "flour" });
    expect(result.error).toContain("Inventia");
  } finally {
    harness.cleanup();
  }
});

const recipeFor = (ingredientId: string, extra: Record<string, unknown> = {}) => ({
  name: "Flour dish",
  category: "test",
  recipe: {
    ingredients: [
      {
        id: "flour",
        ingredientId,
        name: "Flour",
        amount: 300,
        unit: "g",
        displayAmount: "300 g",
      },
    ],
    steps: [
      {
        id: "mix",
        stepNumber: 1,
        phase: "cook",
        title: "Mix",
        instruction: "Mix.",
        executionMode: "active",
        timing: { activeDurationSec: 60 },
        inputs: [{ type: "ingredient", ingredientEntryId: "flour" }],
      },
    ],
  },
  ...extra,
});

test("calculate_purchase_list reads Inventia stock and reports how Inventia was used", async () => {
  const { harness, call } = await setup(true);
  try {
    const created = await call("create_ingredient", {
      ...massIngredient,
      inventiaItemId: "item-g",
    });
    const id = created.data.ingredient.id as string;
    const recipe = await call("create_recipe", recipeFor(id));
    const recipeId = recipe.data.recipe.id as string;

    requests.length = 0;
    const used = await call("calculate_purchase_list", { recipeId });
    expect(used.data.inventiaStatus).toBe("used");
    expect(used.data.warnings).toEqual([]);
    expect(used.data.items[0]).toMatchObject({ stockQuantity: 1000, purchaseAmount: 0 });
    expect(requests).toContain("/api/items/item-g");

    const overridden = await call("calculate_purchase_list", {
      recipeId,
      inventory: { [id]: 100 },
    });
    expect(overridden.data.items[0]).toMatchObject({ stockQuantity: 100, purchaseAmount: 200 });

    harness.sqlite
      .prepare("UPDATE ingredients SET inventia_item_id = 'gone-item' WHERE id = ?")
      .run(id);
    const failed = await call("calculate_purchase_list", { recipeId });
    expect(failed.data.inventiaStatus).toBe("error");
    expect(failed.data.warnings[0]).toContain("Flour");
    expect(failed.data.items[0]).toMatchObject({ stockPresence: "unknown", purchaseAmount: 300 });

    harness.sqlite.prepare("UPDATE ingredients SET inventia_item_id = NULL").run();
    const unlinked = await call("calculate_purchase_list", { recipeId });
    expect(unlinked.data.inventiaStatus).toBe("not_linked");
  } finally {
    harness.cleanup();
  }
});

test("calculate_purchase_list says Inventia is unavailable when it is not configured", async () => {
  const { harness, call } = await setup(false);
  try {
    const created = await call("create_ingredient", massIngredient);
    const id = created.data.ingredient.id as string;
    const recipe = await call("create_recipe", recipeFor(id));
    harness.sqlite.prepare("UPDATE ingredients SET inventia_item_id = 'item-g'").run();
    const result = await call("calculate_purchase_list", {
      recipeId: recipe.data.recipe.id as string,
    });
    expect(result.data.inventiaStatus).toBe("unavailable");
    expect(result.data.warnings[0]).toContain("Inventia");
    expect(result.data.items[0]).toMatchObject({ stockQuantity: null, purchaseAmount: 300 });
  } finally {
    harness.cleanup();
  }
});

test("recipes can be read and edited in place without changing their ID", async () => {
  const { harness, call } = await setup(false);
  try {
    const ingredient = await call("create_ingredient", massIngredient);
    const ingredientId = ingredient.data.ingredient.id as string;
    const created = await call("create_recipe", recipeFor(ingredientId, { servings: 2 }));
    const recipeId = created.data.recipe.id as string;
    expect(created.data.recipe.servings).toBe(2);
    expect(created.data.recipe.recipe.servings).toBe(2);

    const meal = await call("record_meal", {
      eatenAt: "2026-11-09T12:00:00.000Z",
      sourceType: "self_cooked",
      title: "Dinner",
      items: [{ dishId: recipeId, name: "Flour dish", servingsFactor: 1 }],
    });
    expect(meal.error).toBeNull();

    const fetched = await call("get_recipe", { id: recipeId });
    expect(fetched.data.recipe.name).toBe("Flour dish");

    const edited = await call("update_recipe", {
      id: recipeId,
      name: "Flour dish v2",
      recipe: {
        ...recipeFor(ingredientId).recipe,
        steps: [{ ...recipeFor(ingredientId).recipe.steps[0], title: "Mix well" }],
      },
    });
    expect(edited.error).toBeNull();
    expect(edited.data.recipe).toMatchObject({ id: recipeId, name: "Flour dish v2", servings: 2 });
    expect(edited.data.recipe.recipe.steps[0].title).toBe("Mix well");
    expect(edited.data.recipe.recipe.servings).toBe(2);

    const serving = await call("update_recipe", { id: recipeId, servings: 4 });
    expect(serving.data.recipe.recipe.servings).toBe(4);
    expect(serving.data.recipe.recipe.steps[0].title).toBe("Mix well");

    const cyclic = await call("update_recipe", {
      id: recipeId,
      recipe: {
        ...recipeFor(ingredientId).recipe,
        steps: [{ ...recipeFor(ingredientId).recipe.steps[0], dependsOnStepIds: ["mix"] }],
      },
    });
    expect(cyclic.error).toContain("Invalid recipe DAG");
    expect((await call("update_recipe", { id: "nope", name: "x" })).error).toContain("not found");
    expect((await call("update_recipe", { id: recipeId })).error).toContain("At least one field");

    const mealRow = harness.sqlite.prepare("SELECT dish_id FROM meal_log_items LIMIT 1").get() as {
      dish_id: string | null;
    };
    expect(mealRow.dish_id).toBe(recipeId);
  } finally {
    harness.cleanup();
  }
});

test("create tools return the existing record for a repeated client ID", async () => {
  const { harness, call } = await setup(false);
  try {
    const first = await call("create_ingredient", { ...massIngredient, id: "flour-1" });
    const second = await call("create_ingredient", { ...massIngredient, id: "flour-1" });
    expect(first.data).toMatchObject({ created: true, ingredient: { id: "flour-1" } });
    expect(second.data).toMatchObject({ created: false, ingredient: { id: "flour-1" } });
    expect(ingredientCount(harness)).toBe(1);

    const recipe = recipeFor("flour-1", { id: "dish-1" });
    expect((await call("create_recipe", recipe)).data.created).toBe(true);
    expect((await call("create_recipe", recipe)).data.created).toBe(false);

    const mealArgs = {
      id: "meal-1",
      eatenAt: "2026-11-09T12:00:00.000Z",
      sourceType: "other",
      title: "Snack",
      items: [{ name: "Cracker", servingsFactor: 1 }],
    };
    expect((await call("record_meal", mealArgs)).data.created).toBe(true);
    expect((await call("record_meal", mealArgs)).data.created).toBe(false);
    const count = harness.sqlite.prepare("SELECT COUNT(*) AS c FROM meal_logs").get() as {
      c: number;
    };
    expect(count.c).toBe(1);
  } finally {
    harness.cleanup();
  }
});

test("meals can be listed, read, updated and deleted", async () => {
  const { harness, call } = await setup(false);
  try {
    for (const [index, day] of ["08", "09", "10"].entries())
      await call("record_meal", {
        id: `meal-${index}`,
        eatenAt: `2026-11-${day}T12:00:00.000Z`,
        sourceType: "other",
        title: `Meal ${index}`,
        memo: "keep me",
        items: [{ name: "Item", servingsFactor: 1 }],
      });

    const page = await call("list_meals", { limit: 2 });
    expect(page.data.meals).toHaveLength(2);
    expect(page.data).toMatchObject({ total: 3, hasMore: true });
    const rest = await call("list_meals", { limit: 2, offset: 2 });
    expect(rest.data).toMatchObject({ total: 3, hasMore: false });
    expect(rest.data.meals).toHaveLength(1);
    const ranged = await call("list_meals", { from: "2026-11-09T00:00:00.000Z" });
    expect(ranged.data.total).toBe(2);

    expect((await call("get_meal", { id: "meal-1" })).data.meal.title).toBe("Meal 1");
    const updated = await call("update_meal", { id: "meal-1", title: "Renamed", rating: 4 });
    expect(updated.data.meal).toMatchObject({ title: "Renamed", rating: 4, memo: "keep me" });
    expect((await call("update_meal", { id: "meal-1" })).error).toContain("At least one field");
    expect((await call("update_meal", { id: "none", title: "x" })).error).toContain("not found");

    expect((await call("delete_meal", { id: "meal-1" })).data).toEqual({
      success: true,
      deletedId: "meal-1",
    });
    expect((await call("get_meal", { id: "meal-1" })).error).toContain("not found");
  } finally {
    harness.cleanup();
  }
});

test("tools declare annotations and id aliases must agree", async () => {
  const { harness, secret, call } = await setup(false);
  try {
    const response = await api.fetch(
      new Request("http://localhost/api/mcp", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${secret}`,
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
        },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }),
      }),
      harness.env,
    );
    const listed = (await response.json()) as {
      result: { tools: { name: string; annotations?: Record<string, boolean> }[] };
    };
    const hints = Object.fromEntries(
      listed.result.tools.map((tool) => [tool.name, tool.annotations ?? {}]),
    );
    expect(hints.list_recipes).toMatchObject({ readOnlyHint: true });
    expect(hints.calculate_purchase_list).toMatchObject({ readOnlyHint: true });
    expect(hints.delete_recipe).toMatchObject({ destructiveHint: true, idempotentHint: true });
    expect(hints.update_ingredient).toMatchObject({ readOnlyHint: false, idempotentHint: true });
    expect(hints.create_recipe).toMatchObject({ readOnlyHint: false });

    const conflict = await call("delete_recipe", { id: "a", recipeId: "b" });
    expect(conflict.error).toContain("must match");
    const longId = await call("get_meal", { id: "x".repeat(129) });
    expect(longId.error).not.toBeNull();
  } finally {
    harness.cleanup();
  }
});
