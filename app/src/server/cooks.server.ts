import { desc, eq, sql } from "drizzle-orm";

import type { ChoBatchItem, ChoDatabase } from "@/db/database";
import { runBatch } from "@/db/database";
import {
	cookImages,
	cookRecords,
	recipeCategories,
	recipes,
} from "@/db/schema";
import type { CookDetail, CookInput, CookListItem } from "@/domain/cook";
import { newId } from "@/domain/id";

/** 作った記録の読み書き。写真は R2 のキーだけを持ち、行の追加・削除は images.server.ts が行う */

export const listCooks = async (
	db: ChoDatabase,
	recipeId: string | null = null,
): Promise<readonly CookListItem[]> =>
	db
		.select({
			id: cookRecords.id,
			recipeId: cookRecords.recipeId,
			recipeTitle: recipes.title,
			categoryName: recipeCategories.name,
			cookedAt: cookRecords.cookedAt,
			rating: cookRecords.rating,
			note: cookRecords.note,
			instagramUrl: cookRecords.instagramUrl,
			imageCount: sql<number>`(select count(*) from ${cookImages} where ${cookImages.cookRecordId} = ${cookRecords.id})`,
		})
		.from(cookRecords)
		.innerJoin(recipes, eq(cookRecords.recipeId, recipes.id))
		.innerJoin(recipeCategories, eq(recipes.categoryId, recipeCategories.id))
		.where(recipeId === null ? undefined : eq(cookRecords.recipeId, recipeId))
		.orderBy(desc(cookRecords.cookedAt));

export const getCook = async (
	db: ChoDatabase,
	cookId: string,
): Promise<CookDetail | null> => {
	const [row] = await db
		.select({
			id: cookRecords.id,
			recipeId: cookRecords.recipeId,
			recipeTitle: recipes.title,
			cookedAt: cookRecords.cookedAt,
			rating: cookRecords.rating,
			note: cookRecords.note,
			instagramUrl: cookRecords.instagramUrl,
			createdAt: cookRecords.createdAt,
			updatedAt: cookRecords.updatedAt,
		})
		.from(cookRecords)
		.innerJoin(recipes, eq(cookRecords.recipeId, recipes.id))
		.where(eq(cookRecords.id, cookId));
	if (!row) {
		return null;
	}
	const images = await db
		.select({ id: cookImages.id, r2Key: cookImages.r2Key, alt: cookImages.alt })
		.from(cookImages)
		.where(eq(cookImages.cookRecordId, cookId))
		.orderBy(cookImages.position);
	return {
		...row,
		images: images.map((image) => ({
			id: image.id,
			key: image.r2Key,
			alt: image.alt,
		})),
	};
};

export const saveCook = async (
	db: ChoDatabase,
	{ cookId, input }: { cookId: string | null; input: CookInput },
): Promise<string> => {
	const [recipe] = await db
		.select({ id: recipes.id })
		.from(recipes)
		.where(eq(recipes.id, input.recipeId));
	if (!recipe) {
		throw new Error("レシピが見つかりません。");
	}
	const id = cookId ?? newId();
	const now = new Date().toISOString();
	const values = {
		recipeId: input.recipeId,
		cookedAt: input.cookedAt,
		rating: input.rating,
		note: input.note,
		instagramUrl: input.instagramUrl,
		updatedAt: now,
	};
	const statements: ChoBatchItem[] = [
		cookId === null
			? db.insert(cookRecords).values({ id, createdAt: now, ...values })
			: db.update(cookRecords).set(values).where(eq(cookRecords.id, cookId)),
	];
	await runBatch(db, statements);
	return id;
};

export const deleteCook = async (
	db: ChoDatabase,
	cookId: string,
): Promise<void> => {
	await runBatch(db, [
		db.delete(cookImages).where(eq(cookImages.cookRecordId, cookId)),
		db.delete(cookRecords).where(eq(cookRecords.id, cookId)),
	]);
};
