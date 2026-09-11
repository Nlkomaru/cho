import { z } from "zod";

import type { Amount, UnitConversion } from "./ingredient";
import { amountInputSchema } from "./units";

/**
 * レシピ JSON（schemaVersion 1）。
 *
 * レシピの入力・取り込み・書き出しはすべてこの形を通す。DB では材料や手順を
 * 別テーブルに分けるが、受け渡しは 1 つの文書として扱うと検証も差分も単純になる。
 * 画像は DB 側の持ち物なので文書に含めない。
 *
 * 単位は日本語の表記（`大さじ`）でも slug（`tbsp`）でもよく、境界で slug へ正規化する。
 * `ingredientId` は材料マスタの id。名前が一致する材料マスタがあれば、取り込み時に
 * 自動で結び付ける。
 */
export const recipeDocumentVersion = 1;

/**
 * 参考にした本・サイト・動画など。1 件につきタイトルか URL のどちらかが必要で、
 * 参考が 1 つも無いレシピは自分のレシピとして扱う。
 */
export const recipeReferenceInputSchema = z
	.object({
		title: z.string().trim().max(200).nullable(),
		url: z
			.url({ error: "URL の形式が正しくありません（例: https://example.com）" })
			.max(500)
			.nullable(),
		note: z.string().trim().max(500).nullable(),
	})
	.strict()
	.refine((reference) => reference.title !== null || reference.url !== null, {
		message: "参考にはタイトルか URL のどちらかを入れてください",
		path: ["title"],
	});

/** レシピ 1 件分の入力。レシピ JSON（schemaVersion 1）の中身と同じ形にする */
export const recipeInputSchema = z
	.object({
		title: z.string().trim().min(1).max(200),
		categorySlug: z.string().trim().min(1).max(50),
		summary: z.string().trim().max(1000).nullable(),
		/** できあがり量。「18cm 1台」「4人前」など */
		servings: amountInputSchema.nullable(),
		times: z.object({
			prepMinutes: z.int().min(0).max(1440).nullable(),
			cookMinutes: z.int().min(0).max(1440).nullable(),
			restMinutes: z.int().min(0).max(1440).nullable(),
		}),
		ingredients: z
			.array(
				z.object({
					name: z.string().trim().min(1).max(100),
					amount: amountInputSchema,
					note: z.string().trim().max(200).nullable(),
					ingredientId: z.string().trim().min(1).max(100).nullable(),
				}),
			)
			.max(100),
		steps: z
			.array(z.object({ text: z.string().trim().min(1).max(2000) }))
			.min(1)
			.max(100),
		references: z.array(recipeReferenceInputSchema).max(20),
		tags: z.array(z.string().trim().min(1).max(30)).max(20),
		note: z.string().trim().max(2000).nullable(),
	})
	.strict();

export const recipeDocumentSchema = z
	.object({
		// 先頭に置く。書き出した JSON を読むときに形式の版がすぐ分かる
		schemaVersion: z.literal(recipeDocumentVersion),
		...recipeInputSchema.shape,
	})
	.strict();

export type RecipeInput = z.output<typeof recipeInputSchema>;

export type RecipeDocument = z.output<typeof recipeDocumentSchema>;

/** 取り込んだレシピ JSON から、保存に使う入力だけを取り出す */
export const recipeInputFromDocument = (
	document: RecipeDocument,
): RecipeInput => ({
	title: document.title,
	categorySlug: document.categorySlug,
	summary: document.summary,
	servings: document.servings,
	times: document.times,
	ingredients: document.ingredients,
	steps: document.steps,
	references: document.references,
	tags: document.tags,
	note: document.note,
});

export interface IngredientReference {
	readonly id: string;
	readonly name: string;
	readonly gramsPerMilliliter: number | null;
	readonly conversions: readonly UnitConversion[];
	/** Inventia の品目 id。材料から在庫の品目へ飛ぶためのリンク */
	readonly inventoryItemId: string | null;
}

export interface RecipeIngredient {
	readonly id: string;
	readonly name: string;
	readonly amount: Amount;
	readonly note: string | null;
	readonly ingredient: IngredientReference | null;
}

export interface RecipeStep {
	readonly id: string;
	readonly text: string;
}

export interface RecipeImage {
	readonly id: string;
	/** R2 のオブジェクトキー。表示は /images/<key> から配信する */
	readonly key: string;
	readonly alt: string | null;
}

export interface RecipeTimes {
	readonly prepMinutes: number | null;
	readonly cookMinutes: number | null;
	readonly restMinutes: number | null;
}

export interface RecipeReference {
	readonly id: string;
	readonly title: string | null;
	readonly url: string | null;
	readonly note: string | null;
}

export interface CookRecordSummary {
	readonly id: string;
	readonly cookedAt: string;
	readonly rating: number | null;
	readonly note: string | null;
	readonly instagramUrl: string | null;
	readonly images: readonly RecipeImage[];
}

export interface RecipeListItem {
	readonly id: string;
	readonly title: string;
	readonly categorySlug: string;
	readonly categoryName: string;
	readonly summary: string | null;
	readonly tags: readonly string[];
	readonly updatedAt: string;
	readonly cookCount: number;
	readonly latestCookedAt: string | null;
}

export interface RecipeDetail extends RecipeListItem {
	readonly servings: Amount | null;
	readonly times: RecipeTimes;
	readonly ingredients: readonly RecipeIngredient[];
	readonly steps: readonly RecipeStep[];
	readonly images: readonly RecipeImage[];
	readonly references: readonly RecipeReference[];
	readonly note: string | null;
	readonly createdAt: string;
	readonly cooks: readonly CookRecordSummary[];
}

/** 保存されているレシピをレシピ JSON へ書き出す */
export function recipeDocumentFromDetail(detail: RecipeDetail) {
	return recipeDocumentSchema.parse({
		schemaVersion: recipeDocumentVersion,
		title: detail.title,
		categorySlug: detail.categorySlug,
		summary: detail.summary,
		servings: detail.servings,
		times: detail.times,
		ingredients: detail.ingredients.map((ingredient) => ({
			name: ingredient.name,
			amount: ingredient.amount,
			note: ingredient.note,
			ingredientId: ingredient.ingredient?.id ?? null,
		})),
		steps: detail.steps.map((step) => ({ text: step.text })),
		references: detail.references.map((reference) => ({
			title: reference.title,
			url: reference.url,
			note: reference.note,
		})),
		tags: [...detail.tags],
		note: detail.note,
	});
}
