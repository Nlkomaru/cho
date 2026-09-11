import { z } from "zod";

import type { RecipeImage } from "./recipe";

/**
 * 作った記録。どのレシピを、いつ作ったかと、そのときの写真・感想・投稿リンクを持つ。
 */
export const cookInputSchema = z
	.object({
		recipeId: z.string().trim().min(1).max(100),
		// 入力はタイムゾーン付きの ISO 8601。保存は UTC に正規化する
		cookedAt: z.iso
			.datetime({ offset: true })
			.transform((value) => new Date(value).toISOString()),
		rating: z.int().min(1).max(5).nullable(),
		note: z.string().trim().max(2000).nullable(),
		instagramUrl: z.url().max(500).nullable(),
	})
	.strict();

export type CookInput = z.output<typeof cookInputSchema>;

export interface CookListItem {
	readonly id: string;
	readonly recipeId: string;
	readonly recipeTitle: string;
	readonly categoryName: string;
	readonly cookedAt: string;
	readonly rating: number | null;
	readonly note: string | null;
	readonly instagramUrl: string | null;
	readonly imageCount: number;
}

export interface CookDetail {
	readonly id: string;
	readonly recipeId: string;
	readonly recipeTitle: string;
	readonly cookedAt: string;
	readonly rating: number | null;
	readonly note: string | null;
	readonly instagramUrl: string | null;
	readonly images: readonly RecipeImage[];
	readonly createdAt: string;
	readonly updatedAt: string;
}
