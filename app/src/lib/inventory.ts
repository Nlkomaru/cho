/**
 * Inventia（在庫管理）へのリンク。
 * 材料マスタに Inventia の品目 id を入れておくと、レシピの材料から在庫の品目へ飛べる。
 */
export const inventiaBaseUrl =
	import.meta.env.VITE_INVENTIA_BASE_URL ?? "https://inventia.nikomaru.dev";

export const inventiaItemUrl = (inventoryItemId: string): string =>
	`${inventiaBaseUrl}/inventory/items/${encodeURIComponent(inventoryItemId)}`;
