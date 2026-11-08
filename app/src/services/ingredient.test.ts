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
  return { service: createIngredientService({ repository }), getStored: () => stored };
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
