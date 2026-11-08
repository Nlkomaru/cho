import { z } from "zod";

export interface InventiaConfig {
  baseUrl: string;
  decryptedToken: string;
  cloudflareAccessClientId?: string | null;
  cloudflareAccessClientSecret?: string | null;
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

const itemSchema = z.object({
  id: z.string(),
  name: z.string().trim().min(1),
  baseUnit: z.string(),
  baseDimension: z.enum(["mass", "volume", "count"]),
  currentQuantity: z.number(),
});
const priceSchema = z.object({ unitPrice: z.number() });
const stockResultSchema = z.object({
  currentQuantity: z.number(),
  allocations: z.array(z.unknown()),
});
const stockRequestSchema = z.object({
  delta: z.number(),
  reason: z.literal("consume"),
  idempotencyKey: z.string(),
  note: z.string(),
  externalProviderId: z.string(),
  externalId: z.string(),
});

export function createInventiaClient(config: InventiaConfig) {
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
      headers: new Headers({
        ...Object.fromEntries(headers),
        ...Object.fromEntries(new Headers(init?.headers)),
      }),
    });
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(
        `Inventia request failed (${response.status} ${response.statusText})${detail ? `: ${detail.slice(0, 500)}` : ""}`,
      );
    }
    return response.json() as Promise<T>;
  }
  return {
    async searchItems(query: string): Promise<InventiaItemDto[]> {
      const result = await request<unknown>(`/api/items?q=${encodeURIComponent(query)}`);
      return z.array(itemSchema).parse(result);
    },
    async getItemPrices(id: string): Promise<InventiaPriceRecordDto[]> {
      const result = await request<unknown>(`/api/items/${encodeURIComponent(id)}/prices?limit=5`);
      return z.array(priceSchema).parse(result);
    },
    async adjustStock(
      id: string,
      input: InventiaStockAdjustRequest,
    ): Promise<InventiaStockOperationResult> {
      const body = stockRequestSchema.parse(input);
      const result = await request<unknown>(`/api/items/${encodeURIComponent(id)}/stock/adjust`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      return stockResultSchema.parse(result);
    },
  };
}
