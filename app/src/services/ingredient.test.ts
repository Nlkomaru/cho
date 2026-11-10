import { expect, test } from "vite-plus/test";
import type { Ingredient } from "../domain/ingredient";
import { createIngredientService, type IngredientRepository } from "./ingredient";
import type { InventiaPriceRecordDto } from "./inventia-client";

const initialIngredient: Ingredient = {
  id: "flour",
  name: "Flour",
  normalizedName: "flour",
  baseDimension: "mass",
  baseUnit: "g",
  nutritionBasisAmount: 100,
  nutritionPerBasis: {
    caloriesKcal: 364,
    proteinG: 10,
    fatG: 1,
    carbohydrateG: 76,
    fiberG: null,
    saltEquivalentG: null,
    micronutrients: [],
  },
  gramPerUnit: null,
  inventiaItemId: "inventia-flour",
  latestUnitPriceYen: 80,
  latestPriceUpdatedAt: "2026-01-02T03:04:05.000Z",
  memo: null,
};

function fixture() {
  let stored = initialIngredient;
  const repository: IngredientRepository = {
    list: async () => [stored],
    getById: async (id) => (id === stored.id ? stored : null),
    create: async (input) => (stored = input),
    update: async (id, changes) => {
      if (id !== stored.id) return null;
      stored = { ...stored, ...changes };
      return stored;
    },
    delete: async (id) => (id === stored.id ? stored : null),
  };
  return {
    repository,
    service: createIngredientService({ repository }),
    getStored: () => stored,
  };
}

test("changing ingredient units clears Inventia link and price snapshot", async () => {
  const { service, getStored } = fixture();
  const updated = await service.update("flour", { baseDimension: "volume", baseUnit: "mL" });
  expect(updated).toMatchObject({
    baseDimension: "volume",
    baseUnit: "mL",
    inventiaItemId: null,
    latestUnitPriceYen: null,
    latestPriceUpdatedAt: null,
  });
  expect(getStored()).toEqual(updated);
});

test("name-only ingredient edit preserves Inventia link and price snapshot", async () => {
  const { service, getStored } = fixture();
  const updated = await service.update("flour", { name: "Bread flour" });
  expect(updated).toMatchObject({
    name: "Bread flour",
    inventiaItemId: "inventia-flour",
    latestUnitPriceYen: 80,
    latestPriceUpdatedAt: "2026-01-02T03:04:05.000Z",
  });
  expect(getStored()).toEqual(updated);
});

test("linked stock lookup uses the immutable Inventia item ID after a rename", async () => {
  const { repository } = fixture();
  const ids: string[] = [];
  const service = createIngredientService({
    repository,
    inventiaClient: {
      searchItems: async () => {
        throw new Error("Name search must not be used for linked stock");
      },
      getItem: async (id) => {
        ids.push(id);
        return {
          id,
          name: "Renamed flour",
          baseUnit: "g",
          baseDimension: "mass",
          currentQuantity: 1250,
        };
      },
      getItemPrices: async () => [],
      adjustStock: async () => {
        throw new Error("Stock must not be mutated");
      },
    },
  });
  expect(await service.inventiaStock("flour")).toEqual({
    found: true,
    currentQuantity: 1250,
    baseUnit: "g",
  });
  expect(ids).toEqual(["inventia-flour"]);
});

test("linking stores the upstream per-100 g unit price as the per-basis price", async () => {
  const { repository } = fixture();
  const service = createIngredientService({
    repository,
    inventiaClient: {
      searchItems: async () => [],
      getItem: async (id) => ({
        id,
        name: "Flour",
        baseUnit: "g",
        baseDimension: "mass",
        currentQuantity: 1000,
      }),
      getItemPrices: async () => [{ unitPrice: 27.5 }, { unitPrice: 30 }],
      adjustStock: async () => {
        throw new Error("Stock must not be mutated");
      },
    },
  });
  expect(await service.linkInventiaItem("flour", "inventia-flour")).toMatchObject({
    synced: true,
    unitPriceYen: 27.5,
    ingredient: { latestUnitPriceYen: 27.5 },
  });
});

test("linking refuses an item whose unit no longer matches", async () => {
  const { repository, getStored } = fixture();
  const service = createIngredientService({
    repository,
    inventiaClient: {
      searchItems: async () => [],
      getItem: async (id) => ({
        id,
        name: "Flour",
        baseUnit: "kg",
        baseDimension: "mass",
        currentQuantity: 1,
      }),
      getItemPrices: async () => [],
      adjustStock: async () => {
        throw new Error("Stock must not be mutated");
      },
    },
  });
  await expect(service.linkInventiaItem("flour", "inventia-flour")).rejects.toMatchObject({
    name: "InventiaUnitMismatchError",
    expectedUnit: "g",
    actualUnit: "kg",
  });
  expect(getStored()).toEqual(initialIngredient);
});

test("linking refuses a missing Inventia item", async () => {
  const { repository, getStored } = fixture();
  const service = createIngredientService({
    repository,
    inventiaClient: {
      searchItems: async () => [],
      getItem: async () => null,
      getItemPrices: async () => [],
      adjustStock: async () => {
        throw new Error("Stock must not be mutated");
      },
    },
  });
  await expect(service.linkInventiaItem("flour", "missing-item")).rejects.toMatchObject({
    name: "InventiaItemNotFoundError",
  });
  expect(getStored()).toEqual(initialIngredient);
});

test("stock consumption forwards the client idempotency key verbatim", async () => {
  const { repository } = fixture();
  const bodies: unknown[] = [];
  const service = createIngredientService({
    repository,
    providerId: "provider-7",
    inventiaClient: {
      searchItems: async () => [],
      getItem: async (id) => ({
        id,
        name: "Flour",
        baseUnit: "g",
        baseDimension: "mass",
        currentQuantity: 1000,
      }),
      getItemPrices: async () => [],
      adjustStock: async (id, body) => {
        bodies.push({ id, body });
        return { currentQuantity: 880, allocations: [] };
      },
    },
  });
  await service.adjustInventiaStock("flour", 120, "ui-key-42");
  expect(bodies).toEqual([
    {
      id: "inventia-flour",
      body: {
        delta: -120,
        reason: "consume",
        idempotencyKey: "ui-key-42",
        note: "Cho: 在庫消費 Flour",
        externalProviderId: "provider-7",
        externalId: "flour",
      },
    },
  ]);
});

test("stock consumption rejects non-integer amounts naming the item unit", async () => {
  const { repository } = fixture();
  const bodies: unknown[] = [];
  const service = createIngredientService({
    repository,
    providerId: "provider-7",
    inventiaClient: {
      searchItems: async () => [],
      getItem: async (id) => ({
        id,
        name: "Flour",
        baseUnit: "g",
        baseDimension: "mass",
        currentQuantity: 1000,
      }),
      getItemPrices: async () => [],
      adjustStock: async (id, body) => {
        bodies.push({ id, body });
        return { currentQuantity: 880, allocations: [] };
      },
    },
  });
  await expect(service.adjustInventiaStock("flour", 120.5, "ui-key-43")).rejects.toMatchObject({
    name: "InventiaAmountError",
    unit: "g",
    amount: 120.5,
  });
  expect(bodies).toEqual([]);
});

test("stock consumption refuses an item whose unit changed after linking", async () => {
  const { repository } = fixture();
  const bodies: unknown[] = [];
  const service = createIngredientService({
    repository,
    providerId: "provider-7",
    inventiaClient: {
      searchItems: async () => [],
      getItem: async (id) => ({
        id,
        name: "Flour",
        baseUnit: "kg",
        baseDimension: "mass",
        currentQuantity: 1,
      }),
      getItemPrices: async () => [],
      adjustStock: async (id, body) => {
        bodies.push({ id, body });
        return { currentQuantity: 880, allocations: [] };
      },
    },
  });
  await expect(service.adjustInventiaStock("flour", 120, "ui-key-44")).rejects.toMatchObject({
    name: "InventiaUnitMismatchError",
    expectedUnit: "g",
    actualUnit: "kg",
  });
  expect(bodies).toEqual([]);
});

function linkFixture(
  items: Record<string, { baseDimension: "mass" | "volume"; baseUnit: string }>,
) {
  const { repository, getStored } = fixture();
  const prices: Record<string, number> = { "inventia-flour": 80, "inventia-bread": 120 };
  const service = createIngredientService({
    repository,
    inventiaClient: {
      searchItems: async () => [],
      getItem: async (id) => {
        const item = items[id];
        return item ? { id, name: id, currentQuantity: 5, ...item } : null;
      },
      getItemPrices: async (id) => (prices[id] === undefined ? [] : [{ unitPrice: prices[id] }]),
      adjustStock: async () => {
        throw new Error("unused");
      },
    },
  });
  return { service, getStored };
}

test("an Inventia link sent together with a unit change survives and is checked against the new unit", async () => {
  const { service, getStored } = linkFixture({
    "inventia-oil": { baseDimension: "volume", baseUnit: "mL" },
  });
  const updated = await service.update("flour", {
    baseDimension: "volume",
    baseUnit: "mL",
    inventiaItemId: "inventia-oil",
  });
  expect(updated).toMatchObject({
    baseUnit: "mL",
    inventiaItemId: "inventia-oil",
    latestUnitPriceYen: null,
  });
  // The old flour price is not carried over; the timestamp records the empty lookup.
  expect(updated?.latestPriceUpdatedAt).not.toBe("2026-01-02T03:04:05.000Z");
  expect(getStored()).toEqual(updated);
});

test("relinking to another item replaces the previous item's price", async () => {
  const { service } = linkFixture({ "inventia-bread": { baseDimension: "mass", baseUnit: "g" } });
  const updated = await service.update("flour", { inventiaItemId: "inventia-bread" });
  expect(updated).toMatchObject({ inventiaItemId: "inventia-bread", latestUnitPriceYen: 120 });
  expect(updated?.latestPriceUpdatedAt).not.toBe("2026-01-02T03:04:05.000Z");
});

test("relinking to an item without price records clears the old price instead of keeping it", async () => {
  const { service } = linkFixture({ "inventia-new": { baseDimension: "mass", baseUnit: "g" } });
  const updated = await service.update("flour", { inventiaItemId: "inventia-new" });
  expect(updated).toMatchObject({ inventiaItemId: "inventia-new", latestUnitPriceYen: null });
  // The empty lookup is recorded so the stale-price refresh waits before asking again.
  expect(updated?.latestPriceUpdatedAt).not.toBe("2026-01-02T03:04:05.000Z");
});

function priceFixture(getItemPrices: () => Promise<InventiaPriceRecordDto[]>) {
  const { repository, getStored } = fixture();
  const service = createIngredientService({
    repository,
    inventiaClient: {
      searchItems: async () => [],
      getItem: async (id) => ({
        id,
        name: id,
        baseUnit: "g",
        baseDimension: "mass",
        currentQuantity: 5,
      }),
      getItemPrices,
      adjustStock: async () => {
        throw new Error("unused");
      },
    },
  });
  return { service, getStored };
}

test("linking without price records still saves the link with an empty price", async () => {
  const { service, getStored } = priceFixture(async () => []);
  const result = await service.linkInventiaItem("flour", "inventia-empty");
  expect(result).toMatchObject({ synced: false, reason: "no_price_records" });
  expect(getStored()).toMatchObject({
    inventiaItemId: "inventia-empty",
    latestUnitPriceYen: null,
  });
});

test("a failed price request does not block linking and is retried later", async () => {
  const { service, getStored } = priceFixture(async () => {
    throw new Error("Inventia is down");
  });
  const result = await service.linkInventiaItem("flour", "inventia-other");
  expect(result).toMatchObject({ synced: false, reason: "price_unavailable" });
  expect(getStored()).toMatchObject({
    inventiaItemId: "inventia-other",
    latestUnitPriceYen: null,
    latestPriceUpdatedAt: null,
  });
  const created = await service.create({
    ...initialIngredient,
    id: "flour",
    inventiaItemId: "inventia-new",
    latestUnitPriceYen: null,
    latestPriceUpdatedAt: null,
  });
  expect(created).toMatchObject({ inventiaItemId: "inventia-new", latestUnitPriceYen: null });
});

test("re-linking the same item keeps the cached price when the price request fails", async () => {
  const { service, getStored } = priceFixture(async () => {
    throw new Error("Inventia is down");
  });
  await service.linkInventiaItem("flour", "inventia-flour");
  expect(getStored()).toEqual(initialIngredient);
});

test("a price record for a different unit is not stored", async () => {
  const { service, getStored } = priceFixture(async () => [
    { unitPrice: 300, baseUnit: "mL", baseDimension: "volume" },
  ]);
  const result = await service.linkInventiaItem("flour", "inventia-other");
  expect(result).toMatchObject({ synced: false, reason: "price_unavailable" });
  expect(getStored().latestUnitPriceYen).toBeNull();
});

function refreshFixture(
  rows: Partial<Ingredient>[],
  prices: (id: string) => Promise<InventiaPriceRecordDto[]>,
) {
  let stored: Ingredient[] = rows.map((row, index) => ({
    ...initialIngredient,
    id: `ingredient-${index}`,
    ...row,
  }));
  const calls: string[] = [];
  const repository: IngredientRepository = {
    list: async () => stored,
    getById: async (id) => stored.find((item) => item.id === id) ?? null,
    create: async (input) => input,
    update: async (id, changes) => {
      stored = stored.map((item) => (item.id === id ? { ...item, ...changes } : item));
      return stored.find((item) => item.id === id) ?? null;
    },
    delete: async () => null,
  };
  const service = createIngredientService({
    repository,
    inventiaClient: {
      searchItems: async () => [],
      getItem: async () => {
        throw new Error("refresh must not re-read items");
      },
      getItemPrices: async (id) => {
        calls.push(id);
        return prices(id);
      },
      adjustStock: async () => {
        throw new Error("unused");
      },
    },
  });
  return { service, calls, rows: () => stored };
}

test("stale refresh updates only linked prices that are missing or older than 24 hours", async () => {
  const now = new Date("2026-11-10T12:00:00.000Z");
  const { service, calls, rows } = refreshFixture(
    [
      { inventiaItemId: "a", latestPriceUpdatedAt: "2026-11-10T00:00:00.000Z" },
      { inventiaItemId: "b", latestPriceUpdatedAt: "2026-11-09T11:00:00.000Z" },
      { inventiaItemId: "c", latestUnitPriceYen: null, latestPriceUpdatedAt: null },
      { inventiaItemId: null, latestUnitPriceYen: null, latestPriceUpdatedAt: null },
    ],
    async (id) => [{ unitPrice: id === "b" ? 90 : 55 }],
  );
  const refreshed = await service.refreshStalePrices({ now });
  expect(calls).toEqual(["c", "b"]);
  expect(refreshed.map((item) => item.id)).toEqual(["ingredient-2", "ingredient-1"]);
  expect(rows().map((item) => item.latestUnitPriceYen)).toEqual([80, 90, 55, null]);
  expect(rows()[1]?.latestPriceUpdatedAt).toBe(now.toISOString());
});

test("stale refresh is bounded, scoped by id and keeps cached prices on failure", async () => {
  const now = new Date("2026-11-10T12:00:00.000Z");
  const { service, calls, rows } = refreshFixture(
    Array.from({ length: 4 }, () => ({ latestPriceUpdatedAt: null })),
    async () => {
      throw new Error("Inventia is down");
    },
  );
  expect(await service.refreshStalePrices({ now, limit: 2 })).toEqual([]);
  expect(calls).toHaveLength(2);
  expect(rows().every((item) => item.latestUnitPriceYen === 80)).toBe(true);
  calls.length = 0;
  await service.refreshStalePrices({ now, ingredientIds: ["ingredient-3"] });
  expect(calls).toEqual(["inventia-flour"]);
});

test("stale refresh does nothing without an Inventia client", async () => {
  const { service } = fixture();
  expect(await service.refreshStalePrices()).toEqual([]);
});

test("linking a missing or unit-mismatched item is refused and leaves the ingredient untouched", async () => {
  const { service, getStored } = linkFixture({
    "inventia-ml": { baseDimension: "volume", baseUnit: "mL" },
  });
  await expect(service.update("flour", { inventiaItemId: "nope" })).rejects.toThrow(
    "was not found",
  );
  await expect(service.update("flour", { inventiaItemId: "inventia-ml" })).rejects.toThrow();
  await expect(service.linkInventiaItem("flour", "inventia-ml")).rejects.toThrow();
  expect(getStored()).toEqual(initialIngredient);
});

test("unlinking clears the stored price and re-sending the current link does not call Inventia", async () => {
  const { service } = fixture();
  const same = await service.update("flour", {
    inventiaItemId: "inventia-flour",
    name: "Flour 2",
  });
  expect(same).toMatchObject({ inventiaItemId: "inventia-flour", latestUnitPriceYen: 80 });
  const unlinked = await service.update("flour", { inventiaItemId: null });
  expect(unlinked).toMatchObject({
    inventiaItemId: null,
    latestUnitPriceYen: null,
    latestPriceUpdatedAt: null,
  });
});

test("a failed refresh records the attempt so failing ingredients stop holding the batch", async () => {
  const now = new Date("2026-11-10T12:00:00.000Z");
  const { service, calls, rows } = refreshFixture(
    [
      { inventiaItemId: "bad-1", latestPriceUpdatedAt: "2026-11-01T00:00:00.000Z" },
      { inventiaItemId: "bad-2", latestPriceUpdatedAt: "2026-11-01T00:00:00.000Z" },
      { inventiaItemId: "good", latestPriceUpdatedAt: "2026-11-05T00:00:00.000Z" },
    ],
    async (id) => {
      if (id.startsWith("bad")) throw new Error("404");
      return [{ unitPrice: 55 }];
    },
  );
  expect(await service.refreshStalePrices({ now, limit: 2 })).toEqual([]);
  expect(rows()[0]?.latestUnitPriceYen).toBe(80);
  // The old price is not shown as freshly checked; only the attempt is recorded.
  expect(rows()[0]?.latestPriceUpdatedAt).toBe("2026-11-01T00:00:00.000Z");
  expect(rows()[0]?.latestPriceAttemptedAt).toBe(now.toISOString());
  calls.length = 0;
  const refreshed = await service.refreshStalePrices({ now, limit: 2 });
  expect(calls).toEqual(["good"]);
  expect(refreshed.map((item) => item.latestUnitPriceYen)).toEqual([55]);
});

test("a refresh does not overwrite a link that changed while it ran", async () => {
  const now = new Date("2026-11-10T12:00:00.000Z");
  let stored: Ingredient = { ...initialIngredient, latestPriceUpdatedAt: null };
  const repository: IngredientRepository = {
    list: async () => [stored],
    getById: async () => stored,
    create: async (input) => input,
    update: async (_id, changes, onlyIfLinkedTo) => {
      if (onlyIfLinkedTo !== undefined && stored.inventiaItemId !== onlyIfLinkedTo) return null;
      stored = { ...stored, ...changes };
      return stored;
    },
    delete: async () => null,
  };
  const service = createIngredientService({
    repository,
    inventiaClient: {
      searchItems: async () => [],
      getItem: async () => null,
      getItemPrices: async () => {
        stored = { ...stored, inventiaItemId: "other-item", latestUnitPriceYen: 7 };
        return [{ unitPrice: 55 }];
      },
      adjustStock: async () => {
        throw new Error("unused");
      },
    },
  });
  expect(await service.refreshStalePrices({ now })).toEqual([]);
  expect(stored).toMatchObject({ inventiaItemId: "other-item", latestUnitPriceYen: 7 });
});

test("linking an item without price records keeps a price entered by hand", async () => {
  const { service, getStored } = linkFixture({
    "inventia-new": { baseDimension: "mass", baseUnit: "g" },
  });
  await service.update("flour", { inventiaItemId: null });
  await service.update("flour", { latestUnitPriceYen: 0.5 });
  const result = await service.linkInventiaItem("flour", "inventia-new");
  expect(result).toMatchObject({ synced: false, reason: "no_price_records" });
  expect(getStored()).toMatchObject({ inventiaItemId: "inventia-new", latestUnitPriceYen: 0.5 });
});

test("changing the basis amount of a linked ingredient converts the price again", async () => {
  const { service, getStored } = linkFixture({
    "inventia-flour": { baseDimension: "mass", baseUnit: "g" },
  });
  const updated = await service.update("flour", { nutritionBasisAmount: 1 });
  expect(updated?.inventiaItemId).toBe("inventia-flour");
  expect(updated?.latestUnitPriceYen).toBe(0.8);
  expect(getStored().latestUnitPriceYen).toBe(0.8);
});

test("an unlinked ingredient takes a hand-entered price, a linked one keeps the Inventia price", async () => {
  const { service, getStored } = fixture();
  await service.update("flour", { latestUnitPriceYen: 12 });
  expect(getStored().latestUnitPriceYen).toBe(80);

  await service.update("flour", { inventiaItemId: null, latestUnitPriceYen: 30 });
  expect(getStored()).toMatchObject({ inventiaItemId: null, latestUnitPriceYen: 30 });
  expect(getStored().latestPriceUpdatedAt).not.toBeNull();

  await service.update("flour", { name: "Bread flour" });
  expect(getStored().latestUnitPriceYen).toBe(30);
  await service.update("flour", { latestUnitPriceYen: null });
  expect(getStored()).toMatchObject({ latestUnitPriceYen: null, latestPriceUpdatedAt: null });
});

test("a new unlinked ingredient stores its hand-entered price", async () => {
  const { service } = fixture();
  const created = await service.create({
    ...initialIngredient,
    id: "sugar",
    inventiaItemId: null,
    latestUnitPriceYen: 25,
    latestPriceUpdatedAt: null,
  });
  expect(created.latestUnitPriceYen).toBe(25);
  expect(created.latestPriceUpdatedAt).not.toBeNull();
});
