import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";

import type { ChoBatchItem, ChoDatabase } from "@/db/database";
import { chunkRows, runBatch } from "@/db/database";
import {
	cookImages,
	cookRecords,
	ingredientConversions,
	ingredients,
	recipeCategories,
	recipeImages,
	recipeIngredients,
	recipeReferences,
	recipeSteps,
	recipes,
} from "@/db/schema";
import { newId } from "@/domain/id";
import type {
	IngredientReference,
	RecipeDetail,
	RecipeImage,
	RecipeInput,
	RecipeListItem,
} from "@/domain/recipe";
import type { UnitSlug } from "@/domain/units";

/**
 * レシピと種類の読み書き。レシピの材料と手順は丸ごと入れ替える（差分更新はしない）。
 * レシピ JSON と同じ形の入力を受け取り、同じ形で組み立てて返す。
 */

export interface RecipeCategory {
	readonly id: string;
	readonly slug: string;
	readonly name: string;
	readonly sortOrder: number;
}

export const listCategories = async (
	db: ChoDatabase,
	ownerId: string,
): Promise<readonly RecipeCategory[]> =>
	db
		.select({
			id: recipeCategories.id,
			slug: recipeCategories.slug,
			name: recipeCategories.name,
			sortOrder: recipeCategories.sortOrder,
		})
		.from(recipeCategories)
		.where(eq(recipeCategories.ownerId, ownerId))
		.orderBy(asc(recipeCategories.sortOrder), asc(recipeCategories.name));

export const listRecipes = async (
	db: ChoDatabase,
	ownerId: string,
): Promise<readonly RecipeListItem[]> =>
	db
		.select({
			id: recipes.id,
			title: recipes.title,
			summary: recipes.summary,
			tags: recipes.tags,
			updatedAt: recipes.updatedAt,
			categorySlug: recipeCategories.slug,
			categoryName: recipeCategories.name,
			cookCount: sql<number>`count(${cookRecords.id})`,
			latestCookedAt: sql<string | null>`max(${cookRecords.cookedAt})`,
		})
		.from(recipes)
		.innerJoin(recipeCategories, eq(recipes.categoryId, recipeCategories.id))
		.leftJoin(cookRecords, eq(cookRecords.recipeId, recipes.id))
		.where(eq(recipes.ownerId, ownerId))
		.groupBy(recipes.id)
		.orderBy(desc(recipes.updatedAt));

const imageFromRow = (row: {
	id: string;
	r2Key: string;
	alt: string | null;
}): RecipeImage => ({
	id: row.id,
	key: row.r2Key,
	alt: row.alt,
});

export const getRecipeDetail = async (
	db: ChoDatabase,
	ownerId: string,
	recipeId: string,
): Promise<RecipeDetail | null> => {
	const [row] = await db
		.select({
			id: recipes.id,
			title: recipes.title,
			summary: recipes.summary,
			servingsValue: recipes.servingsValue,
			servingsUnit: recipes.servingsUnit,
			prepMinutes: recipes.prepMinutes,
			cookMinutes: recipes.cookMinutes,
			restMinutes: recipes.restMinutes,
			tags: recipes.tags,
			note: recipes.note,
			createdAt: recipes.createdAt,
			updatedAt: recipes.updatedAt,
			categorySlug: recipeCategories.slug,
			categoryName: recipeCategories.name,
		})
		.from(recipes)
		.innerJoin(recipeCategories, eq(recipes.categoryId, recipeCategories.id))
		.where(and(eq(recipes.id, recipeId), eq(recipes.ownerId, ownerId)));
	if (!row) {
		return null;
	}

	const [ingredientRows, stepRows, referenceRows, imageRows, cookRows] =
		await Promise.all([
			db
				.select({
					id: recipeIngredients.id,
					name: recipeIngredients.name,
					amountValue: recipeIngredients.amountValue,
					amountUnit: recipeIngredients.amountUnit,
					note: recipeIngredients.note,
					ingredientId: recipeIngredients.ingredientId,
					masterName: ingredients.name,
					gramsPerMilliliter: ingredients.gramsPerMilliliter,
					inventoryItemId: ingredients.inventoryItemId,
				})
				.from(recipeIngredients)
				.leftJoin(
					ingredients,
					eq(recipeIngredients.ingredientId, ingredients.id),
				)
				.where(eq(recipeIngredients.recipeId, recipeId))
				.orderBy(asc(recipeIngredients.position)),
			db
				.select({ id: recipeSteps.id, text: recipeSteps.text })
				.from(recipeSteps)
				.where(eq(recipeSteps.recipeId, recipeId))
				.orderBy(asc(recipeSteps.position)),
			db
				.select({
					id: recipeReferences.id,
					title: recipeReferences.title,
					url: recipeReferences.url,
					note: recipeReferences.note,
				})
				.from(recipeReferences)
				.where(eq(recipeReferences.recipeId, recipeId))
				.orderBy(asc(recipeReferences.position)),
			db
				.select({
					id: recipeImages.id,
					r2Key: recipeImages.r2Key,
					alt: recipeImages.alt,
					position: recipeImages.position,
				})
				.from(recipeImages)
				.where(eq(recipeImages.recipeId, recipeId))
				.orderBy(asc(recipeImages.position)),
			db
				.select({
					id: cookRecords.id,
					cookedAt: cookRecords.cookedAt,
					rating: cookRecords.rating,
					note: cookRecords.note,
					instagramUrl: cookRecords.instagramUrl,
				})
				.from(cookRecords)
				.where(eq(cookRecords.recipeId, recipeId))
				.orderBy(desc(cookRecords.cookedAt)),
		]);

	const masterIngredientIds = [
		...new Set(
			ingredientRows
				.map((ingredient) => ingredient.ingredientId)
				.filter((id) => id !== null),
		),
	];
	const conversionRows: {
		ingredientId: string;
		unit: string;
		gramsPerUnit: number;
	}[] = [];
	for (const chunk of chunkRows(masterIngredientIds, 1)) {
		conversionRows.push(
			...(await db
				.select({
					ingredientId: ingredientConversions.ingredientId,
					unit: ingredientConversions.unit,
					gramsPerUnit: ingredientConversions.gramsPerUnit,
				})
				.from(ingredientConversions)
				.where(inArray(ingredientConversions.ingredientId, chunk))),
		);
	}
	const conversions = conversionRows;

	const cookIds = cookRows.map((cook) => cook.id);
	const cookImageRows: {
		id: string;
		cookRecordId: string;
		r2Key: string;
		alt: string | null;
		position: number;
	}[] = [];
	for (const chunk of chunkRows(cookIds, 1)) {
		cookImageRows.push(
			...(await db
				.select({
					id: cookImages.id,
					cookRecordId: cookImages.cookRecordId,
					r2Key: cookImages.r2Key,
					alt: cookImages.alt,
					position: cookImages.position,
				})
				.from(cookImages)
				.where(inArray(cookImages.cookRecordId, chunk))
				.orderBy(asc(cookImages.position))),
		);
	}

	return {
		id: row.id,
		title: row.title,
		categorySlug: row.categorySlug,
		categoryName: row.categoryName,
		summary: row.summary,
		tags: row.tags,
		updatedAt: row.updatedAt,
		createdAt: row.createdAt,
		cookCount: cookRows.length,
		latestCookedAt: cookRows[0]?.cookedAt ?? null,
		servings:
			row.servingsUnit === null
				? null
				: { value: row.servingsValue, unit: row.servingsUnit as UnitSlug },
		times: {
			prepMinutes: row.prepMinutes,
			cookMinutes: row.cookMinutes,
			restMinutes: row.restMinutes,
		},
		note: row.note,
		references: referenceRows,
		ingredients: ingredientRows.map((ingredient) => {
			const reference: IngredientReference | null =
				ingredient.ingredientId === null || ingredient.masterName === null
					? null
					: {
							id: ingredient.ingredientId,
							name: ingredient.masterName,
							gramsPerMilliliter: ingredient.gramsPerMilliliter,
							inventoryItemId: ingredient.inventoryItemId,
							conversions: conversions
								.filter(
									(conversion) =>
										conversion.ingredientId === ingredient.ingredientId,
								)
								.map((conversion) => ({
									unit: conversion.unit as UnitSlug,
									gramsPerUnit: conversion.gramsPerUnit,
								})),
						};
			return {
				id: ingredient.id,
				name: ingredient.name,
				amount: {
					value: ingredient.amountValue,
					unit: ingredient.amountUnit as UnitSlug,
				},
				note: ingredient.note,
				ingredient: reference,
			};
		}),
		steps: stepRows,
		images: imageRows.map(imageFromRow),
		cooks: cookRows.map((cook) => ({
			id: cook.id,
			cookedAt: cook.cookedAt,
			rating: cook.rating,
			note: cook.note,
			instagramUrl: cook.instagramUrl,
			images: cookImageRows
				.filter((image) => image.cookRecordId === cook.id)
				.map((image) => imageFromRow(image)),
		})),
	};
};

/** 材料名から材料マスタを引く。レシピ JSON の取り込みで名前だけの材料を結び付ける */
const ingredientIdsByName = async (
	db: ChoDatabase,
	ownerId: string,
	names: readonly string[],
): Promise<Map<string, string>> => {
	const unique = [...new Set(names)];
	if (unique.length === 0) {
		return new Map();
	}
	// IN の値も 1 文へ束縛できる数に収める（材料は最大 100 件ある）
	const rows: { id: string; name: string }[] = [];
	for (const chunk of chunkRows(unique, 1)) {
		rows.push(
			...(await db
				.select({ id: ingredients.id, name: ingredients.name })
				.from(ingredients)
				.where(
					and(
						eq(ingredients.ownerId, ownerId),
						inArray(ingredients.name, chunk),
					),
				)),
		);
	}
	return new Map(rows.map((row) => [row.name, row.id]));
};

export const saveRecipe = async (
	db: ChoDatabase,
	{
		ownerId,
		recipeId,
		input,
	}: { ownerId: string; recipeId: string | null; input: RecipeInput },
): Promise<string> => {
	if (
		recipeId !== null &&
		(await getRecipeDetail(db, ownerId, recipeId)) === null
	) {
		throw new Error("レシピが見つかりません。");
	}
	const [category] = await db
		.select({ id: recipeCategories.id })
		.from(recipeCategories)
		.where(
			and(
				eq(recipeCategories.ownerId, ownerId),
				eq(recipeCategories.slug, input.categorySlug),
			),
		);
	if (!category) {
		throw new Error(`レシピの種類「${input.categorySlug}」が見つかりません。`);
	}

	const id = recipeId ?? newId();
	const now = new Date().toISOString();
	const masterIds = await ingredientIdsByName(
		db,
		ownerId,
		input.ingredients.map((ingredient) => ingredient.name),
	);

	const values = {
		title: input.title,
		categoryId: category.id,
		summary: input.summary,
		servingsValue: input.servings?.value ?? null,
		servingsUnit: input.servings?.unit ?? null,
		prepMinutes: input.times.prepMinutes,
		cookMinutes: input.times.cookMinutes,
		restMinutes: input.times.restMinutes,
		tags: input.tags,
		note: input.note,
		updatedAt: now,
	};

	const statements: ChoBatchItem[] = [
		recipeId === null
			? db.insert(recipes).values({ id, ownerId, createdAt: now, ...values })
			: db
					.update(recipes)
					.set(values)
					.where(and(eq(recipes.id, recipeId), eq(recipes.ownerId, ownerId))),
		db.delete(recipeIngredients).where(eq(recipeIngredients.recipeId, id)),
		db.delete(recipeSteps).where(eq(recipeSteps.recipeId, id)),
		db.delete(recipeReferences).where(eq(recipeReferences.recipeId, id)),
	];
	if (input.references.length > 0) {
		for (const chunk of chunkRows(
			input.references.map((reference, index) => ({
				id: newId(),
				recipeId: id,
				position: index,
				title: reference.title,
				url: reference.url,
				note: reference.note,
				createdAt: now,
				updatedAt: now,
			})),
			8,
		)) {
			statements.push(db.insert(recipeReferences).values(chunk));
		}
	}
	if (input.ingredients.length > 0) {
		for (const chunk of chunkRows(
			input.ingredients.map((ingredient, index) => ({
				id: newId(),
				recipeId: id,
				position: index,
				name: ingredient.name,
				amountValue: ingredient.amount.value,
				amountUnit: ingredient.amount.unit,
				note: ingredient.note,
				// 明示された参照を優先し、無ければ名前が一致する材料マスタへ結び付ける
				ingredientId:
					ingredient.ingredientId ?? masterIds.get(ingredient.name) ?? null,
				createdAt: now,
				updatedAt: now,
			})),
			9,
		)) {
			statements.push(db.insert(recipeIngredients).values(chunk));
		}
	}
	if (input.steps.length > 0) {
		for (const chunk of chunkRows(
			input.steps.map((step, index) => ({
				id: newId(),
				recipeId: id,
				position: index,
				text: step.text,
				createdAt: now,
				updatedAt: now,
			})),
			6,
		)) {
			statements.push(db.insert(recipeSteps).values(chunk));
		}
	}
	await runBatch(db, statements);
	return id;
};

export const deleteRecipe = async (
	db: ChoDatabase,
	ownerId: string,
	recipeId: string,
): Promise<void> => {
	if ((await getRecipeDetail(db, ownerId, recipeId)) === null) {
		throw new Error("レシピが見つかりません。");
	}
	// 子テーブルは ON DELETE CASCADE だが、D1 の外部キー設定に依存しないよう明示的に消す
	const cookRows = await db
		.select({ id: cookRecords.id })
		.from(cookRecords)
		.where(eq(cookRecords.recipeId, recipeId));
	await runBatch(db, [
		db
			.delete(recipeIngredients)
			.where(eq(recipeIngredients.recipeId, recipeId)),
		db.delete(recipeSteps).where(eq(recipeSteps.recipeId, recipeId)),
		db.delete(recipeReferences).where(eq(recipeReferences.recipeId, recipeId)),
		db.delete(recipeImages).where(eq(recipeImages.recipeId, recipeId)),
		...chunkRows(
			cookRows.map((cook) => cook.id),
			1,
		).map((chunk) =>
			db.delete(cookImages).where(inArray(cookImages.cookRecordId, chunk)),
		),
		db.delete(cookRecords).where(eq(cookRecords.recipeId, recipeId)),
		db
			.delete(recipes)
			.where(and(eq(recipes.id, recipeId), eq(recipes.ownerId, ownerId))),
	]);
};

export const saveCategory = async (
	db: ChoDatabase,
	{
		ownerId,
		categoryId,
		slug,
		name,
	}: { ownerId: string; categoryId: string | null; slug: string; name: string },
): Promise<string> => {
	if (categoryId !== null) {
		const [existing] = await db
			.select({ id: recipeCategories.id })
			.from(recipeCategories)
			.where(
				and(
					eq(recipeCategories.id, categoryId),
					eq(recipeCategories.ownerId, ownerId),
				),
			);
		if (!existing) {
			throw new Error("レシピの種類が見つかりません。");
		}
	}
	const now = new Date().toISOString();
	if (categoryId === null) {
		const [last] = await db
			.select({ sortOrder: recipeCategories.sortOrder })
			.from(recipeCategories)
			.where(eq(recipeCategories.ownerId, ownerId))
			.orderBy(desc(recipeCategories.sortOrder))
			.limit(1);
		const id = newId();
		await db.insert(recipeCategories).values({
			id,
			ownerId,
			slug,
			name,
			sortOrder: (last?.sortOrder ?? -1) + 1,
			createdAt: now,
			updatedAt: now,
		});
		return id;
	}
	await db
		.update(recipeCategories)
		.set({ slug, name, updatedAt: now })
		.where(
			and(
				eq(recipeCategories.id, categoryId),
				eq(recipeCategories.ownerId, ownerId),
			),
		);
	return categoryId;
};

export const deleteCategory = async (
	db: ChoDatabase,
	ownerId: string,
	categoryId: string,
): Promise<void> => {
	const [used] = await db
		.select({ count: sql<number>`count(*)` })
		.from(recipes)
		.where(
			and(eq(recipes.categoryId, categoryId), eq(recipes.ownerId, ownerId)),
		);
	if (used && used.count > 0) {
		throw new Error("この種類を使っているレシピがあるため削除できません。");
	}
	await db
		.delete(recipeCategories)
		.where(
			and(
				eq(recipeCategories.id, categoryId),
				eq(recipeCategories.ownerId, ownerId),
			),
		);
};
