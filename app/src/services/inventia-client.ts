import { z } from "zod";

export interface InventiaConfig {
  baseUrl: string;
  decryptedToken: string;
  cloudflareAccessClientId?: string | null;
  cloudflareAccessClientSecret?: string | null;
  stockWritesEnabled?: boolean;
}
export interface InventiaItemDto {
  id: string;
  name: string;
  baseUnit: string;
  baseDimension: "mass" | "volume" | "count";
  currentQuantity: number;
}
export interface InventiaPriceRecordDto {
  unitPrice: number;
}
export interface InventiaStockAdjustRequest {
  delta: number;
  reason: "consume";
  idempotencyKey: string;
  note: string;
  externalProviderId: string;
  externalId: string;
}
export interface InventiaStockOperationResult {
  currentQuantity: number;
  allocations: unknown[];
}

export interface InventiaClient {
  searchItems(query: string): Promise<InventiaItemDto[]>;
  getItem(id: string): Promise<InventiaItemDto | null>;
  getItemPrices(id: string): Promise<InventiaPriceRecordDto[]>;
  adjustStock(id: string, input: InventiaStockAdjustRequest): Promise<InventiaStockOperationResult>;
}

export class InventiaHttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string | null = null,
    readonly upstreamMessage: string | null = null,
  ) {
    super(`Inventia request failed (${status}${code ? ` ${code}` : ""})`);
    this.name = "InventiaHttpError";
  }
}

export class InventiaUnitMismatchError extends Error {
  constructor(
    readonly expectedUnit: string,
    readonly actualUnit: string,
  ) {
    super(
      `Inventia item is now measured in ${actualUnit}, but the ingredient uses ${expectedUnit}. Re-link the ingredient to an item measured in ${expectedUnit}.`,
    );
    this.name = "InventiaUnitMismatchError";
  }
}

export class InventiaAmountError extends Error {
  constructor(
    readonly amount: number,
    readonly unit: string,
  ) {
    super(
      Number.isInteger(amount)
        ? `Inventia stock amount must be at least 1 ${unit}.`
        : `Inventia stock amount must be a whole number of ${unit}; received ${amount}.`,
    );
    this.name = "InventiaAmountError";
  }
}

export class InventiaItemNotFoundError extends Error {
  constructor() {
    super("The linked Inventia item no longer exists. Re-link the ingredient to an Inventia item.");
    this.name = "InventiaItemNotFoundError";
  }
}

export class InventiaSearchLimitError extends Error {
  constructor(readonly pageLimit: number) {
    super(
      `Too many Inventia items match this query. Narrow the search query instead of loading every page (searched ${pageLimit} pages).`,
    );
    this.name = "InventiaSearchLimitError";
  }
}

export type InventiaFailureStatus = 400 | 404 | 409 | 502;
export interface InventiaFailure {
  status: InventiaFailureStatus;
  error: string;
}

const upstreamFailures: Record<string, InventiaFailure> = {
  INSUFFICIENT_STOCK: {
    status: 409,
    error: "Inventia does not have enough stock for this item.",
  },
  EXTERNAL_PROVIDER_NOT_FOUND: {
    status: 409,
    error:
      "Inventia does not recognize the configured Provider ID. Correct it in the Cho integration settings.",
  },
  ITEM_NOT_FOUND: {
    status: 404,
    error: "The Inventia item no longer exists. Re-link the ingredient to an Inventia item.",
  },
  LOT_NOT_FOUND: {
    status: 409,
    error: "Inventia has no matching lot for this item. Check the item's lots in Inventia.",
  },
  IDEMPOTENCY_CONFLICT: {
    status: 409,
    error:
      "This stock request conflicts with an earlier request that used the same idempotency key. Retry with a new key.",
  },
};

export function describeInventiaFailure(error: unknown, fallback: string): InventiaFailure {
  if (error instanceof InventiaAmountError) return { status: 400, error: error.message };
  if (error instanceof InventiaUnitMismatchError) return { status: 409, error: error.message };
  if (error instanceof InventiaItemNotFoundError) return { status: 404, error: error.message };
  if (error instanceof InventiaSearchLimitError) return { status: 400, error: error.message };
  if (error instanceof InventiaHttpError) {
    const mapped = error.code ? upstreamFailures[error.code] : undefined;
    if (mapped) return mapped;
    if (error.status === 401)
      return {
        status: 409,
        error: "Inventia rejected the API token. Issue a valid token in Inventia settings.",
      };
    if (error.status === 403)
      return {
        status: 409,
        error:
          "Inventia denied access. Check the API token and Cloudflare Access service credentials.",
      };
    if (error.status >= 300 && error.status < 400)
      return {
        status: 409,
        error: "Inventia requires Cloudflare Access service credentials.",
      };
    if (error.status >= 400 && error.status < 500) return { status: 400, error: fallback };
    return { status: 502, error: fallback };
  }
  return { status: 502, error: fallback };
}

export function inventiaRequestErrorMessage(error: unknown, fallback: string): string {
  return describeInventiaFailure(error, fallback).error;
}

export function assertInventiaUnitMatch(
  ingredient: { baseDimension: string; baseUnit: string },
  item: { baseDimension: string; baseUnit: string },
): void {
  if (ingredient.baseDimension !== item.baseDimension || ingredient.baseUnit !== item.baseUnit)
    throw new InventiaUnitMismatchError(ingredient.baseUnit, item.baseUnit);
}

export function assertIntegerStockAmount(amount: number, unit: string): void {
  if (!Number.isInteger(amount) || amount < 1) throw new InventiaAmountError(amount, unit);
}

const errorBodySchema = z.object({
  error: z.object({ code: z.string(), message: z.string() }),
});
const itemSchema = z.object({
  id: z.string(),
  name: z.string().trim().min(1),
  baseUnit: z.string(),
  baseDimension: z.enum(["mass", "volume", "count"]),
  currentQuantity: z.number(),
});
const priceSchema = z.object({ unitPrice: z.number() });
const maxSearchPages = 10;
const itemPageSchema = z.object({
  items: z.array(itemSchema),
  nextCursor: z.string().nullable(),
});
const pricePageSchema = z.object({
  items: z.array(priceSchema),
  nextCursor: z.string().nullable(),
});
const stockResultSchema = z.object({
  currentQuantity: z.number(),
  allocations: z.array(z.unknown()),
});
const stockRequestSchema = z.object({
  delta: z.int().refine((value) => value !== 0),
  reason: z.literal("consume"),
  idempotencyKey: z.string(),
  note: z.string(),
  externalProviderId: z.string(),
  externalId: z.string(),
});

export function createInventiaClient(config: InventiaConfig): InventiaClient {
  const baseUrl = config.baseUrl.replace(/\/+$/, "");
  const token = config.decryptedToken.trim();
  if (!token.startsWith("inv_") || token.length <= 4)
    throw new TypeError("Inventia token must be a decrypted inv_ token");
  const headers = new Headers({
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  });
  if (config.cloudflareAccessClientId && config.cloudflareAccessClientSecret) {
    headers.set("CF-Access-Client-Id", config.cloudflareAccessClientId);
    headers.set("CF-Access-Client-Secret", config.cloudflareAccessClientSecret);
  }
  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${baseUrl}${path}`, {
      ...init,
      redirect: "manual",
      headers: new Headers({
        ...Object.fromEntries(headers),
        ...Object.fromEntries(new Headers(init?.headers)),
      }),
    });
    if (!response.ok) {
      let code: string | null = null;
      let message: string | null = null;
      try {
        const parsed = errorBodySchema.safeParse(await response.json());
        if (parsed.success) {
          code = parsed.data.error.code;
          message = parsed.data.error.message;
        }
      } catch {
        // Non-JSON error bodies still map by status.
      }
      throw new InventiaHttpError(response.status, code, message);
    }
    return response.json() as Promise<T>;
  }
  return {
    async searchItems(query: string): Promise<InventiaItemDto[]> {
      const items: InventiaItemDto[] = [];
      let cursor: string | null = null;
      let pages = 0;
      do {
        if (pages >= maxSearchPages) throw new InventiaSearchLimitError(maxSearchPages);
        const params = new URLSearchParams({ q: query, limit: "100" });
        if (cursor) params.set("cursor", cursor);
        const result = await request<unknown>(`/api/items?${params}`);
        const page = itemPageSchema.parse(result);
        items.push(...page.items);
        cursor = page.nextCursor;
        pages += 1;
      } while (cursor !== null);
      return items;
    },
    async getItem(id: string): Promise<InventiaItemDto | null> {
      try {
        return itemSchema.parse(await request<unknown>(`/api/items/${encodeURIComponent(id)}`));
      } catch (error) {
        if (error instanceof InventiaHttpError && error.status === 404) return null;
        throw error;
      }
    },
    async getItemPrices(id: string): Promise<InventiaPriceRecordDto[]> {
      const result = await request<unknown>(`/api/items/${encodeURIComponent(id)}/prices?limit=5`);
      return pricePageSchema.parse(result).items;
    },
    async adjustStock(
      id: string,
      input: InventiaStockAdjustRequest,
    ): Promise<InventiaStockOperationResult> {
      if (!config.stockWritesEnabled) throw new Error("Inventia stock writes are disabled");
      const body = stockRequestSchema.parse(input);
      const result = await request<unknown>(`/api/items/${encodeURIComponent(id)}/adjustments`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      return stockResultSchema.parse(result);
    },
  };
}
