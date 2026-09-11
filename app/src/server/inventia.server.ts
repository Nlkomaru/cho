import { env } from "cloudflare:workers";
import { z } from "zod";

import { readSecret } from "./secrets.server";

/**
 * Inventia の HTTP API を API トークンで呼ぶ。
 * 認証は Inventia の「API トークン」画面で発行した値を `INVENTIA_API_TOKEN` に入れる。
 */

const defaultBaseUrl = "https://inventia.nikomaru.dev";

const inventiaItemSchema = z.object({
	id: z.string().min(1),
	name: z.string(),
	baseUnit: z.string(),
	baseDimension: z.string(),
	currentQuantity: z.number(),
});

const inventiaItemListSchema = z.object({
	items: z.array(inventiaItemSchema),
	nextCursor: z.string().nullable(),
});

const inventiaErrorSchema = z.object({
	error: z.object({ code: z.string(), message: z.string() }),
});

export interface InventiaItem {
	readonly id: string;
	readonly name: string;
	readonly baseUnit: string;
	readonly baseDimension: string;
	readonly currentQuantity: number;
}

/** トークンが設定されているか。設定画面の案内の出し分けに使う */
export const isInventiaConfigured = (): boolean =>
	readSecret("INVENTIA_API_TOKEN") !== null;

const baseUrl = (): string => env.INVENTIA_BASE_URL ?? defaultBaseUrl;

/** Inventia の応答から利用者向けの理由を取り出す。取れなければ既定の文言を返す */
const describeFailure = async (
	response: Response,
	fallback: string,
): Promise<string> => {
	if (response.status === 401) {
		return "Inventia の API トークンが無効か、失効しています。Inventia の設定でトークンを発行し直してください。";
	}
	const parsed = inventiaErrorSchema.safeParse(
		await response.json().catch(() => null),
	);
	return parsed.success ? parsed.data.error.message : fallback;
};

export const searchInventiaItems = async (
	query: string,
): Promise<readonly InventiaItem[]> => {
	const token = readSecret("INVENTIA_API_TOKEN");
	if (token === null) {
		throw new Error(
			"INVENTIA_API_TOKEN が設定されていません。Inventia の設定で API トークンを発行し、ローカルは app/.dev.vars、本番は wrangler secret put で設定してください。",
		);
	}

	const url = new URL("/api/items", baseUrl());
	url.searchParams.set("q", query);
	url.searchParams.set("limit", "20");
	url.searchParams.set("sort", "name");
	url.searchParams.set("sortDirection", "asc");

	const response = await fetch(url, {
		headers: { accept: "application/json", authorization: `Bearer ${token}` },
	});
	if (!response.ok) {
		throw new Error(
			await describeFailure(
				response,
				"Inventia の品目を検索できませんでした。",
			),
		);
	}
	const parsed = inventiaItemListSchema.safeParse(
		await response.json().catch(() => null),
	);
	if (!parsed.success) {
		throw new Error("Inventia の応答を読み取れませんでした。");
	}
	return parsed.data.items.map((item) => ({
		id: item.id,
		name: item.name,
		baseUnit: item.baseUnit,
		baseDimension: item.baseDimension,
		currentQuantity: item.currentQuantity,
	}));
};
