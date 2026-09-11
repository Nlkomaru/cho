import { eq } from "drizzle-orm";

import type { ChoDatabase } from "@/db/database";
import { chunkRows, runBatch } from "@/db/database";
import {
	ingredientConversions,
	ingredients,
	recipeCategories,
} from "@/db/schema";
import { newId } from "@/domain/id";

/**
 * 初回ログイン時に、その利用者へ配る初期マスタ。
 * 種類は料理の分類、材料はよく使う調味料と食材の換算表（密度は計量スプーン・
 * 計量カップの一般的な換算表に合わせた目安）。
 */
const defaultCategories: readonly {
	readonly slug: string;
	readonly name: string;
}[] = [
	{ slug: "french", name: "フランス料理" },
	{ slug: "italian", name: "イタリアン" },
	{ slug: "japanese", name: "和食" },
	{ slug: "chinese", name: "中華" },
	{ slug: "ethnic", name: "エスニック" },
	{ slug: "sweets", name: "お菓子" },
	{ slug: "bread", name: "パン" },
	{ slug: "drink", name: "ドリンク" },
	{ slug: "other", name: "その他" },
];

const defaultIngredients: readonly {
	readonly name: string;
	readonly gramsPerMilliliter: number | null;
	readonly note: string;
}[] = [
	{ name: "水", gramsPerMilliliter: 1, note: "1カップ = 200ml = 200g" },
	{
		name: "牛乳",
		gramsPerMilliliter: 1,
		note: "大さじ1 = 15g。1カップ = 200g",
	},
	{ name: "豆乳", gramsPerMilliliter: 1, note: "大さじ1 = 15g" },
	{
		name: "生クリーム",
		gramsPerMilliliter: 1,
		note: "大さじ1 = 15g。1パック = 200g",
	},
	{
		name: "上白糖",
		gramsPerMilliliter: 0.6,
		note: "大さじ1 = 9g、小さじ1 = 3g",
	},
	{
		name: "グラニュー糖",
		gramsPerMilliliter: 0.8,
		note: "大さじ1 = 12g、小さじ1 = 4g",
	},
	{ name: "粉糖", gramsPerMilliliter: 0.6, note: "大さじ1 = 9g" },
	{ name: "塩", gramsPerMilliliter: 1, note: "大さじ1 = 15g、小さじ1 = 5g" },
	{
		name: "薄力粉",
		gramsPerMilliliter: 0.6,
		note: "大さじ1 = 9g、1カップ = 120g（すりきり）",
	},
	{
		name: "強力粉",
		gramsPerMilliliter: 0.6,
		note: "大さじ1 = 9g、1カップ = 120g（すりきり）",
	},
	{ name: "片栗粉", gramsPerMilliliter: 0.6, note: "大さじ1 = 9g" },
	{ name: "コーンスターチ", gramsPerMilliliter: 0.6, note: "大さじ1 = 9g" },
	{ name: "ベーキングパウダー", gramsPerMilliliter: 0.8, note: "小さじ1 = 4g" },
	{ name: "ドライイースト", gramsPerMilliliter: 0.6, note: "小さじ1 = 3g" },
	{ name: "パン粉", gramsPerMilliliter: 0.2, note: "大さじ1 = 3g。乾燥パン粉" },
	{ name: "ココアパウダー", gramsPerMilliliter: 0.4, note: "大さじ1 = 6g" },
	{ name: "粉ゼラチン", gramsPerMilliliter: 0.6, note: "小さじ1 = 3g" },
	{
		name: "醤油",
		gramsPerMilliliter: 1.2,
		note: "大さじ1 = 18g、小さじ1 = 6g",
	},
	{ name: "味噌", gramsPerMilliliter: 1.2, note: "大さじ1 = 18g" },
	{ name: "みりん", gramsPerMilliliter: 1.2, note: "大さじ1 = 18g" },
	{ name: "料理酒", gramsPerMilliliter: 1, note: "大さじ1 = 15g" },
	{ name: "酢", gramsPerMilliliter: 1, note: "大さじ1 = 15g" },
	{ name: "白ワイン", gramsPerMilliliter: 1, note: "大さじ1 = 15g" },
	{
		name: "サラダ油",
		gramsPerMilliliter: 0.8,
		note: "大さじ1 = 12g、1カップ = 160g",
	},
	{ name: "ごま油", gramsPerMilliliter: 0.8, note: "大さじ1 = 12g" },
	{ name: "溶かしバター", gramsPerMilliliter: 0.8, note: "大さじ1 = 12g" },
	{ name: "はちみつ", gramsPerMilliliter: 1.4, note: "大さじ1 = 21g" },
	{ name: "ケチャップ", gramsPerMilliliter: 1, note: "大さじ1 = 15g" },
	{ name: "マヨネーズ", gramsPerMilliliter: 0.8, note: "大さじ1 = 12g" },
	{ name: "卵", gramsPerMilliliter: null, note: "1個 = 50g（Mサイズ・全卵）" },
	{ name: "玉ねぎ", gramsPerMilliliter: null, note: "1個 = 200g" },
	{ name: "じゃがいも", gramsPerMilliliter: null, note: "1個 = 150g" },
	{ name: "にんじん", gramsPerMilliliter: null, note: "1本 = 150g" },
	{ name: "トマト", gramsPerMilliliter: null, note: "1個 = 150g" },
	{ name: "きゅうり", gramsPerMilliliter: null, note: "1本 = 100g" },
	{ name: "ねぎ", gramsPerMilliliter: null, note: "1本 = 100g" },
	{ name: "なす", gramsPerMilliliter: null, note: "1本 = 80g" },
	{ name: "ピーマン", gramsPerMilliliter: null, note: "1個 = 35g" },
	{ name: "キャベツ", gramsPerMilliliter: null, note: "1玉 = 1200g" },
	{ name: "大根", gramsPerMilliliter: null, note: "1本 = 1000g" },
	{ name: "りんご", gramsPerMilliliter: null, note: "1個 = 300g" },
	{ name: "レモン", gramsPerMilliliter: null, note: "1個 = 100g" },
	{ name: "にんにく", gramsPerMilliliter: null, note: "1片 = 6g" },
	{ name: "しょうが", gramsPerMilliliter: null, note: "1片 = 15g" },
	{ name: "しいたけ", gramsPerMilliliter: null, note: "1枚 = 15g" },
	{ name: "ベーコン", gramsPerMilliliter: null, note: "1枚 = 20g" },
	{ name: "鶏もも肉", gramsPerMilliliter: null, note: "1枚 = 300g" },
	{ name: "鶏むね肉", gramsPerMilliliter: null, note: "1枚 = 300g" },
	{ name: "木綿豆腐", gramsPerMilliliter: null, note: "1丁 = 300g" },
	{ name: "絹ごし豆腐", gramsPerMilliliter: null, note: "1丁 = 300g" },
	{ name: "食パン", gramsPerMilliliter: null, note: "1枚（6枚切り）= 60g" },
	{ name: "スライスチーズ", gramsPerMilliliter: null, note: "1枚 = 18g" },
	{ name: "バナナ", gramsPerMilliliter: null, note: "1本 = 100g（可食部）" },
];

/** 数え方から g への換算。単位は canonical slug */
const defaultConversions: readonly {
	readonly ingredient: string;
	readonly unit: string;
	readonly gramsPerUnit: number;
}[] = [
	{ ingredient: "卵", unit: "piece", gramsPerUnit: 50 },
	{ ingredient: "玉ねぎ", unit: "piece", gramsPerUnit: 200 },
	{ ingredient: "じゃがいも", unit: "piece", gramsPerUnit: 150 },
	{ ingredient: "にんじん", unit: "stalk", gramsPerUnit: 150 },
	{ ingredient: "トマト", unit: "piece", gramsPerUnit: 150 },
	{ ingredient: "きゅうり", unit: "stalk", gramsPerUnit: 100 },
	{ ingredient: "ねぎ", unit: "stalk", gramsPerUnit: 100 },
	{ ingredient: "なす", unit: "stalk", gramsPerUnit: 80 },
	{ ingredient: "ピーマン", unit: "piece", gramsPerUnit: 35 },
	{ ingredient: "キャベツ", unit: "head", gramsPerUnit: 1200 },
	{ ingredient: "大根", unit: "stalk", gramsPerUnit: 1000 },
	{ ingredient: "りんご", unit: "piece", gramsPerUnit: 300 },
	{ ingredient: "レモン", unit: "piece", gramsPerUnit: 100 },
	{ ingredient: "にんにく", unit: "clove", gramsPerUnit: 6 },
	{ ingredient: "しょうが", unit: "clove", gramsPerUnit: 15 },
	{ ingredient: "しいたけ", unit: "slice", gramsPerUnit: 15 },
	{ ingredient: "ベーコン", unit: "slice", gramsPerUnit: 20 },
	{ ingredient: "鶏もも肉", unit: "slice", gramsPerUnit: 300 },
	{ ingredient: "鶏むね肉", unit: "slice", gramsPerUnit: 300 },
	{ ingredient: "木綿豆腐", unit: "slab", gramsPerUnit: 300 },
	{ ingredient: "絹ごし豆腐", unit: "slab", gramsPerUnit: 300 },
	{ ingredient: "食パン", unit: "slice", gramsPerUnit: 60 },
	{ ingredient: "スライスチーズ", unit: "slice", gramsPerUnit: 18 },
	{ ingredient: "バナナ", unit: "stalk", gramsPerUnit: 100 },
	{ ingredient: "生クリーム", unit: "pack", gramsPerUnit: 200 },
];

/** 新しい利用者へ初期マスタを入れる。2 回目以降は何もしない */
export const seedDefaultMasterData = async (
	db: ChoDatabase,
	ownerId: string,
): Promise<void> => {
	const [existing] = await db
		.select({ id: recipeCategories.id })
		.from(recipeCategories)
		.where(eq(recipeCategories.ownerId, ownerId))
		.limit(1);
	if (existing) {
		return;
	}
	const now = new Date().toISOString();
	const ingredientIds = new Map(
		defaultIngredients.map((ingredient) => [ingredient.name, newId()]),
	);
	const statements = [
		...chunkRows(
			defaultCategories.map((category, index) => ({
				id: newId(),
				ownerId,
				slug: category.slug,
				name: category.name,
				sortOrder: index,
				createdAt: now,
				updatedAt: now,
			})),
			6,
		).map((chunk) => db.insert(recipeCategories).values(chunk)),
		...chunkRows(
			defaultIngredients.map((ingredient) => ({
				id: ingredientIds.get(ingredient.name) ?? newId(),
				ownerId,
				name: ingredient.name,
				gramsPerMilliliter: ingredient.gramsPerMilliliter,
				inventoryItemId: null,
				note: ingredient.note,
				createdAt: now,
				updatedAt: now,
			})),
			8,
		).map((chunk) => db.insert(ingredients).values(chunk)),
		...chunkRows(
			defaultConversions.map((conversion) => ({
				id: newId(),
				ingredientId: ingredientIds.get(conversion.ingredient) ?? newId(),
				unit: conversion.unit,
				gramsPerUnit: conversion.gramsPerUnit,
				createdAt: now,
				updatedAt: now,
			})),
			6,
		).map((chunk) => db.insert(ingredientConversions).values(chunk)),
	];
	await runBatch(db, statements);
};
