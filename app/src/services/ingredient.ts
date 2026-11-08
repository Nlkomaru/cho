import type { Ingredient } from "../domain/ingredient";
import type { InventiaItemDto, InventiaPriceRecordDto } from "./inventia-client";

export interface IngredientRepository {
  list(): Promise<Ingredient[]>;
  getById(id: string): Promise<Ingredient | null>;
  create(input: Ingredient): Promise<Ingredient>;
  update(id: string, changes: Partial<Omit<Ingredient, "id">>): Promise<Ingredient | null>;
  delete(id: string): Promise<Ingredient | null>;
}
export interface IngredientInventiaClient {
  searchItems(query: string): Promise<InventiaItemDto[]>;
  getItemPrices(id: string): Promise<InventiaPriceRecordDto[]>;
}
export type IngredientServiceOptions = {
  repository: IngredientRepository;
  inventiaClient?: IngredientInventiaClient;
};
export type IngredientPriceSyncResult =
  | { synced: true; ingredient: Ingredient; unitPriceYen: number }
  | { synced: false; reason: "no_price_records"; ingredient: Ingredient };

export function createIngredientService({ repository, inventiaClient }: IngredientServiceOptions) {
  function requireInventiaClient(): IngredientInventiaClient {
    if (!inventiaClient) throw new Error("Inventia client is not configured");
    return inventiaClient;
  }
  return {
    list: () => repository.list(),
    get: (id: string) => repository.getById(id),
    create: (input: Ingredient) => repository.create(input),
    async update(id: string, changes: Partial<Omit<Ingredient, "id">>) {
      const current = await repository.getById(id);
      if (!current) return null;
      const dimensionChanged =
        changes.baseDimension !== undefined && changes.baseDimension !== current.baseDimension;
      const unitChanged = changes.baseUnit !== undefined && changes.baseUnit !== current.baseUnit;
      const update =
        dimensionChanged || unitChanged
          ? {
              ...changes,
              inventiaItemId: null,
              latestUnitPriceYen: null,
              latestPriceUpdatedAt: null,
            }
          : changes;
      return repository.update(id, update);
    },
    delete: (id: string) => repository.delete(id),
    searchInventiaItems(query: string) {
      return requireInventiaClient().searchItems(query);
    },
    async syncInventiaPrice(
      ingredientId: string,
      itemId: string,
    ): Promise<IngredientPriceSyncResult> {
      const client = requireInventiaClient();
      const ingredient = await repository.getById(ingredientId);
      if (!ingredient) throw new Error(`Ingredient not found: ${ingredientId}`);
      const prices = await client.getItemPrices(itemId);
      const latestPrice = prices[0];
      if (!latestPrice) return { synced: false, reason: "no_price_records", ingredient };
      const updated = await repository.update(ingredientId, {
        inventiaItemId: itemId,
        latestUnitPriceYen: latestPrice.unitPrice,
        latestPriceUpdatedAt: new Date().toISOString(),
      });
      if (!updated) throw new Error(`Ingredient disappeared during price sync: ${ingredientId}`);
      return { synced: true, ingredient: updated, unitPriceYen: latestPrice.unitPrice };
    },
  };
}
