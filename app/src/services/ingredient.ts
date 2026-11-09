import type { Ingredient } from "../domain/ingredient";
import {
  assertIntegerStockAmount,
  assertInventiaUnitMatch,
  InventiaItemNotFoundError,
  type InventiaItemDto,
  type InventiaPriceRecordDto,
  type InventiaStockAdjustRequest,
  type InventiaStockOperationResult,
} from "./inventia-client";

export interface IngredientRepository {
  list(): Promise<Ingredient[]>;
  getById(id: string): Promise<Ingredient | null>;
  create(input: Ingredient): Promise<Ingredient>;
  update(id: string, changes: Partial<Omit<Ingredient, "id">>): Promise<Ingredient | null>;
  delete(id: string): Promise<Ingredient | null>;
}
export interface IngredientInventiaClient {
  searchItems(query: string): Promise<InventiaItemDto[]>;
  getItem(id: string): Promise<InventiaItemDto | null>;
  getItemPrices(id: string): Promise<InventiaPriceRecordDto[]>;
  adjustStock(id: string, input: InventiaStockAdjustRequest): Promise<InventiaStockOperationResult>;
}
export type IngredientServiceOptions = {
  repository: IngredientRepository;
  inventiaClient?: IngredientInventiaClient;
  providerId?: string;
};
export type IngredientStockResult = {
  found: boolean;
  currentQuantity: number | null;
  baseUnit: string | null;
};
export type IngredientPriceSyncResult =
  | { synced: true; ingredient: Ingredient; unitPriceYen: number }
  | { synced: false; reason: "no_price_records"; ingredient: Ingredient };

export function createIngredientService({
  repository,
  inventiaClient,
  providerId,
}: IngredientServiceOptions) {
  function requireInventiaClient(): IngredientInventiaClient {
    if (!inventiaClient) throw new Error("Inventia client is not configured");
    return inventiaClient;
  }
  async function resolveLink(
    ingredient: Pick<Ingredient, "baseDimension" | "baseUnit">,
    itemId: string,
  ) {
    const client = requireInventiaClient();
    const item = await client.getItem(itemId);
    if (!item) throw new InventiaItemNotFoundError();
    assertInventiaUnitMatch(ingredient, item);
    const latestPrice = (await client.getItemPrices(itemId))[0];
    return {
      inventiaItemId: itemId,
      latestUnitPriceYen: latestPrice?.unitPrice ?? null,
      latestPriceUpdatedAt: latestPrice ? new Date().toISOString() : null,
    };
  }
  return {
    list: () => repository.list(),
    get: (id: string) => repository.getById(id),
    async create(input: Ingredient) {
      if (input.inventiaItemId === null) return repository.create(input);
      return repository.create({
        ...input,
        ...(await resolveLink(input, input.inventiaItemId)),
      });
    },
    async update(id: string, changes: Partial<Omit<Ingredient, "id">>) {
      const current = await repository.getById(id);
      if (!current) return null;
      const dimensionChanged =
        changes.baseDimension !== undefined && changes.baseDimension !== current.baseDimension;
      const unitChanged = changes.baseUnit !== undefined && changes.baseUnit !== current.baseUnit;
      const unitReset =
        dimensionChanged || unitChanged
          ? { inventiaItemId: null, latestUnitPriceYen: null, latestPriceUpdatedAt: null }
          : {};
      const requested = changes.inventiaItemId;
      if (requested === undefined) return repository.update(id, { ...changes, ...unitReset });
      if (requested === null)
        return repository.update(id, {
          ...changes,
          inventiaItemId: null,
          latestUnitPriceYen: null,
          latestPriceUpdatedAt: null,
        });
      if (requested === current.inventiaItemId && !dimensionChanged && !unitChanged)
        return repository.update(id, changes);
      return repository.update(id, {
        ...changes,
        ...(await resolveLink({ ...current, ...changes }, requested)),
      });
    },
    /** Links an ingredient to an Inventia item after checking it exists and matches the unit. */
    async linkInventiaItem(
      ingredientId: string,
      itemId: string,
    ): Promise<IngredientPriceSyncResult & { ingredient: Ingredient }> {
      const ingredient = await repository.getById(ingredientId);
      if (!ingredient) throw new Error(`Ingredient not found: ${ingredientId}`);
      const link = await resolveLink(ingredient, itemId);
      const updated = await repository.update(ingredientId, link);
      if (!updated) throw new Error(`Ingredient disappeared during linking: ${ingredientId}`);
      return link.latestUnitPriceYen === null
        ? { synced: false, reason: "no_price_records", ingredient: updated }
        : { synced: true, ingredient: updated, unitPriceYen: link.latestUnitPriceYen };
    },
    delete: (id: string) => repository.delete(id),
    searchInventiaItems(query: string) {
      return requireInventiaClient().searchItems(query);
    },
    async inventiaStock(ingredientId: string): Promise<IngredientStockResult> {
      const client = requireInventiaClient();
      const ingredient = await repository.getById(ingredientId);
      if (!ingredient) throw new Error(`Ingredient not found: ${ingredientId}`);
      if (!ingredient.inventiaItemId)
        return { found: false, currentQuantity: null, baseUnit: null };
      const match = await client.getItem(ingredient.inventiaItemId);
      return match
        ? { found: true, currentQuantity: match.currentQuantity, baseUnit: match.baseUnit }
        : { found: false, currentQuantity: null, baseUnit: null };
    },
    async adjustInventiaStock(ingredientId: string, amount: number, idempotencyKey: string) {
      const client = requireInventiaClient();
      if (!providerId) throw new Error("Inventia providerId is not configured");
      const ingredient = await repository.getById(ingredientId);
      if (!ingredient) throw new Error(`Ingredient not found: ${ingredientId}`);
      if (!ingredient.inventiaItemId)
        throw new Error(`Ingredient is not linked to Inventia: ${ingredientId}`);
      const item = await client.getItem(ingredient.inventiaItemId);
      if (!item) throw new InventiaItemNotFoundError();
      assertInventiaUnitMatch(ingredient, item);
      assertIntegerStockAmount(amount, item.baseUnit);
      return client.adjustStock(ingredient.inventiaItemId, {
        delta: -amount,
        reason: "consume",
        idempotencyKey,
        note: `Cho: 在庫消費 ${ingredient.name}`,
        externalProviderId: providerId,
        externalId: ingredient.id,
      });
    },
    async syncInventiaPrice(
      ingredientId: string,
      itemId: string,
    ): Promise<IngredientPriceSyncResult> {
      const client = requireInventiaClient();
      const ingredient = await repository.getById(ingredientId);
      if (!ingredient) throw new Error(`Ingredient not found: ${ingredientId}`);
      const item = await client.getItem(itemId);
      if (!item) throw new InventiaItemNotFoundError();
      assertInventiaUnitMatch(ingredient, item);
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
