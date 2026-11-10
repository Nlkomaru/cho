import {
  type Ingredient,
  inventiaUnitPriceToBasisPrice,
  isInventiaPriceStale,
} from "../domain/ingredient";
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
  /**
   * `onlyIfLinkedTo` makes the write conditional on the ingredient still being linked to that
   * Inventia item; it resolves to null when the link changed in the meantime.
   */
  update(
    id: string,
    changes: Partial<Omit<Ingredient, "id">>,
    onlyIfLinkedTo?: string,
  ): Promise<Ingredient | null>;
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
/**
 * Outcome of linking an ingredient to an Inventia item. The link is saved in every case;
 * `synced: false` only means no price could be stored yet (`price_unavailable` = the price
 * request failed, so a later refresh retries it).
 */
export type IngredientPriceSyncResult =
  | { synced: true; ingredient: Ingredient; unitPriceYen: number }
  | { synced: false; reason: "no_price_records" | "price_unavailable"; ingredient: Ingredient };

/** Upper bound of ingredients refreshed per call so a page view stays cheap. */
export const priceRefreshBatchSize = 10;

type PriceFetch = { ok: true; unitPriceYen: number | null } | { ok: false };

export function createIngredientService({
  repository,
  inventiaClient,
  providerId,
}: IngredientServiceOptions) {
  function requireInventiaClient(): IngredientInventiaClient {
    if (!inventiaClient) throw new Error("Inventia client is not configured");
    return inventiaClient;
  }
  /** Reads the latest Inventia price in Cho's per-basis unit. Never throws. */
  async function fetchBasisPrice(
    ingredient: Pick<Ingredient, "baseDimension" | "baseUnit" | "nutritionBasisAmount">,
    itemId: string,
  ): Promise<PriceFetch> {
    try {
      const latest = (await requireInventiaClient().getItemPrices(itemId))[0];
      if (!latest) return { ok: true, unitPriceYen: null };
      if (
        (latest.baseDimension !== undefined && latest.baseDimension !== ingredient.baseDimension) ||
        (latest.baseUnit !== undefined && latest.baseUnit !== ingredient.baseUnit)
      )
        return { ok: false };
      const unitPriceYen = inventiaUnitPriceToBasisPrice(latest.unitPrice, ingredient);
      return unitPriceYen === null ? { ok: false } : { ok: true, unitPriceYen };
    } catch {
      return { ok: false };
    }
  }
  /**
   * Verifies the item (missing items and unit mismatches reject) and builds the link fields.
   * A failed price lookup does not block the link: the price stays empty (or, when re-linking
   * the same item, keeps its cached value) and `latestPriceUpdatedAt` stays unset so the next
   * view retries it.
   */
  async function resolveLink(
    ingredient: Pick<
      Ingredient,
      | "baseDimension"
      | "baseUnit"
      | "nutritionBasisAmount"
      | "inventiaItemId"
      | "latestUnitPriceYen"
      | "latestPriceUpdatedAt"
    >,
    itemId: string,
  ) {
    const client = requireInventiaClient();
    const item = await client.getItem(itemId);
    if (!item)
      throw ingredient.inventiaItemId === itemId
        ? new InventiaItemNotFoundError()
        : new InventiaItemNotFoundError(
            "The Inventia item was not found. Check the Inventia item ID.",
          );
    assertInventiaUnitMatch(ingredient, item);
    const price = await fetchBasisPrice(ingredient, itemId);
    if (price.ok)
      return {
        fields: {
          inventiaItemId: itemId,
          // Inventia has no price yet: keep a hand-entered price (not linked before) or the same
          // item's cache; a price that came from a different item is dropped.
          latestUnitPriceYen:
            price.unitPriceYen ??
            (ingredient.inventiaItemId === null || ingredient.inventiaItemId === itemId
              ? ingredient.latestUnitPriceYen
              : null),
          latestPriceUpdatedAt: new Date().toISOString(),
        },
        priceFetched: true,
        priceFound: price.unitPriceYen !== null,
      };
    const sameItem = ingredient.inventiaItemId === itemId;
    return {
      fields: {
        inventiaItemId: itemId,
        latestUnitPriceYen: sameItem ? ingredient.latestUnitPriceYen : null,
        latestPriceUpdatedAt: sameItem ? ingredient.latestPriceUpdatedAt : null,
      },
      priceFetched: false,
      priceFound: false,
    };
  }
  /** Price fields for a hand-entered unit price (per basis amount) on an unlinked ingredient. */
  const manualPriceFields = (price: number | null) => ({
    latestUnitPriceYen: price,
    latestPriceUpdatedAt: price === null ? null : new Date().toISOString(),
  });
  return {
    list: () => repository.list(),
    get: (id: string) => repository.getById(id),
    async create(input: Ingredient) {
      if (input.inventiaItemId === null)
        return repository.create({ ...input, ...manualPriceFields(input.latestUnitPriceYen) });
      return repository.create({
        ...input,
        ...(await resolveLink({ ...input, inventiaItemId: null }, input.inventiaItemId)).fields,
      });
    },
    async update(id: string, input: Partial<Omit<Ingredient, "id">>) {
      const current = await repository.getById(id);
      if (!current) return null;
      // A hand-entered price only applies while the ingredient is not linked to Inventia
      const { latestUnitPriceYen: manualPrice, ...changes } = input;
      const manual = manualPrice === undefined ? {} : manualPriceFields(manualPrice);
      const dimensionChanged =
        changes.baseDimension !== undefined && changes.baseDimension !== current.baseDimension;
      const unitChanged = changes.baseUnit !== undefined && changes.baseUnit !== current.baseUnit;
      const unitReset =
        dimensionChanged || unitChanged
          ? { inventiaItemId: null, latestUnitPriceYen: null, latestPriceUpdatedAt: null }
          : {};
      const basisChanged =
        changes.nutritionBasisAmount !== undefined &&
        changes.nutritionBasisAmount !== current.nutritionBasisAmount;
      const requested = changes.inventiaItemId;
      if (requested === undefined) {
        // The stored price is per basis amount, so a new basis needs a fresh conversion.
        if (basisChanged && !dimensionChanged && !unitChanged && current.inventiaItemId) {
          const price = await fetchBasisPrice({ ...current, ...changes }, current.inventiaItemId);
          return repository.update(id, {
            ...changes,
            latestUnitPriceYen: price.ok ? (price.unitPriceYen ?? null) : null,
            latestPriceUpdatedAt: price.ok ? new Date().toISOString() : null,
          });
        }
        const unlinked = !current.inventiaItemId || dimensionChanged || unitChanged;
        return repository.update(id, { ...changes, ...unitReset, ...(unlinked ? manual : {}) });
      }
      if (requested === null)
        return repository.update(id, {
          ...changes,
          inventiaItemId: null,
          latestUnitPriceYen: null,
          latestPriceUpdatedAt: null,
          ...manual,
        });
      if (
        requested === current.inventiaItemId &&
        !dimensionChanged &&
        !unitChanged &&
        !basisChanged
      )
        return repository.update(id, changes);
      return repository.update(id, {
        ...changes,
        ...(
          await resolveLink(
            {
              ...current,
              ...changes,
              // The cached price only survives a failed lookup when the same item is re-linked.
              inventiaItemId:
                dimensionChanged || unitChanged || basisChanged ? null : current.inventiaItemId,
              latestUnitPriceYen:
                dimensionChanged || unitChanged || basisChanged ? null : current.latestUnitPriceYen,
            },
            requested,
          )
        ).fields,
      });
    },
    /**
     * Links an ingredient to an Inventia item after checking it exists and matches the unit.
     * The link is saved even when Inventia has no price record or the price request fails.
     */
    async linkInventiaItem(
      ingredientId: string,
      itemId: string,
    ): Promise<IngredientPriceSyncResult> {
      const ingredient = await repository.getById(ingredientId);
      if (!ingredient) throw new Error(`Ingredient not found: ${ingredientId}`);
      const { fields, priceFetched, priceFound } = await resolveLink(ingredient, itemId);
      const updated = await repository.update(ingredientId, fields);
      if (!updated) throw new Error(`Ingredient disappeared during linking: ${ingredientId}`);
      if (updated.latestUnitPriceYen !== null && priceFound)
        return {
          synced: true,
          ingredient: updated,
          unitPriceYen: updated.latestUnitPriceYen,
        };
      return {
        synced: false,
        reason: priceFetched ? "no_price_records" : "price_unavailable",
        ingredient: updated,
      };
    },
    /**
     * Refreshes cached Inventia prices of linked ingredients that are stale (see
     * isInventiaPriceStale), oldest first and at most `limit` per call. Individual failures keep
     * the cached value. Returns only the ingredients whose price was written.
     */
    async refreshStalePrices(
      options: { ingredientIds?: readonly string[]; limit?: number; now?: Date } = {},
    ): Promise<Ingredient[]> {
      if (!inventiaClient) return [];
      const now = options.now ?? new Date();
      const wanted = options.ingredientIds ? new Set(options.ingredientIds) : null;
      const stale = (await repository.list())
        .filter((item) => (wanted ? wanted.has(item.id) : true))
        .filter((item) => isInventiaPriceStale(item, now))
        .sort(
          (a, b) =>
            (a.latestPriceUpdatedAt ? Date.parse(a.latestPriceUpdatedAt) : 0) -
            (b.latestPriceUpdatedAt ? Date.parse(b.latestPriceUpdatedAt) : 0),
        )
        .slice(0, options.limit ?? priceRefreshBatchSize);
      const results = await Promise.all(
        stale.map(async (ingredient) => {
          const itemId = ingredient.inventiaItemId;
          if (!itemId) return null;
          const price = await fetchBasisPrice(ingredient, itemId);
          try {
            // A failed lookup keeps the cached price and only records the attempt, so the old
            // price is never shown as freshly checked while failing ingredients still wait for
            // their retry window instead of holding every batch slot. The write only lands while the link is unchanged.
            const updated = await repository.update(
              ingredient.id,
              !price.ok
                ? { latestPriceAttemptedAt: now.toISOString() }
                : price.unitPriceYen !== null
                  ? {
                      latestUnitPriceYen: price.unitPriceYen,
                      latestPriceUpdatedAt: now.toISOString(),
                      latestPriceAttemptedAt: now.toISOString(),
                    }
                  : {
                      latestPriceUpdatedAt: now.toISOString(),
                      latestPriceAttemptedAt: now.toISOString(),
                    },
              itemId,
            );
            return price.ok && price.unitPriceYen !== null ? updated : null;
          } catch {
            return null;
          }
        }),
      );
      return results.filter((item): item is Ingredient => item !== null);
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
  };
}
