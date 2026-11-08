import { expect, test } from "vite-plus/test";
import type { Ingredient } from "../domain/ingredient";
import { createIngredientService, type IngredientRepository } from "./ingredient";

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

test("price synchronization retains the upstream per-basis unit price", async () => {
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
  expect(await service.syncInventiaPrice("flour", "inventia-flour")).toMatchObject({
    synced: true,
    unitPriceYen: 27.5,
    ingredient: { latestUnitPriceYen: 27.5 },
  });
});

test("price synchronization refuses an item whose unit no longer matches", async () => {
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
  await expect(service.syncInventiaPrice("flour", "inventia-flour")).rejects.toMatchObject({
    name: "InventiaUnitMismatchError",
    expectedUnit: "g",
    actualUnit: "kg",
  });
  expect(getStored()).toEqual(initialIngredient);
});

test("price synchronization refuses a missing Inventia item", async () => {
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
  await expect(service.syncInventiaPrice("flour", "missing-item")).rejects.toMatchObject({
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
