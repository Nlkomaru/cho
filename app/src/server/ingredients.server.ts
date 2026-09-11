import { and, asc, eq, sql } from "drizzle-orm";

import type { ChoBatchItem, ChoDatabase } from "@/db/database";
import { chunkRows, runBatch } from "@/db/database";
import {
	ingredientConversions,
	ingredients,
	recipeIngredients,
	recipes,
} from "@/db/schema";
import { newId } from "@/domain/id";
import type {
	IngredientInput,
	IngredientListItem,
	UnitConversion,
} from "@/domain/ingredient";
import type { UnitSlug } from "@/domain/units";

/**
 * 材料マスタの読み書き。利用者ごとのマスタで、換算表は行ごと入れ替える。
 * 他の利用者の行は、id を知っていても読めない・書き換えられない。
 */

const withConversions = (
	rows: readonly {
		id: string;
		name: string;
		gramsPerMilliliter: number | null;
		inventoryItemId: string | null;
		note: string | null;
		updatedAt: string;
	}[],
	conversions: readonly {
		ingredientId: string;
		unit: string;
		gramsPerUnit: number;
	}[],
): readonly IngredientListItem[] =>
	rows.map((row) => ({
		...row,
		conversions: conversions
			.filter((conversion) => conversion.ingredientId === row.id)
			.map((conversion) => ({
				unit: conversion.unit as UnitSlug,
				gramsPerUnit: conversion.gramsPerUnit,
			})),
	}));

export const listIngredients = async (
	db: ChoDatabase,
	ownerId: string,
): Promise<readonly IngredientListItem[]> => {
	const rows = await db
		.select({
			id: ingredients.id,
			name: ingredients.name,
			gramsPerMilliliter: ingredients.gramsPerMilliliter,
			inventoryItemId: ingredients.inventoryItemId,
			note: ingredients.note,
			updatedAt: ingredients.updatedAt,
		})
		.from(ingredients)
		.where(eq(ingredients.ownerId, ownerId))
		.orderBy(asc(ingredients.name));
	const conversions = await db
		.select({
			ingredientId: ingredientConversions.ingredientId,
			unit: ingredientConversions.unit,
			gramsPerUnit: ingredientConversions.gramsPerUnit,
		})
		.from(ingredientConversions)
		.innerJoin(
			ingredients,
			eq(ingredientConversions.ingredientId, ingredients.id),
		)
		.where(eq(ingredients.ownerId, ownerId));
	return withConversions(rows, conversions);
};

export const getIngredient = async (
	db: ChoDatabase,
	ownerId: string,
	ingredientId: string,
): Promise<IngredientListItem | null> => {
	const [row] = await db
		.select({
			id: ingredients.id,
			name: ingredients.name,
			gramsPerMilliliter: ingredients.gramsPerMilliliter,
			inventoryItemId: ingredients.inventoryItemId,
			note: ingredients.note,
			updatedAt: ingredients.updatedAt,
		})
		.from(ingredients)
		.where(
			and(eq(ingredients.id, ingredientId), eq(ingredients.ownerId, ownerId)),
		);
	if (!row) {
		return null;
	}
	const conversions = await db
		.select({
			ingredientId: ingredientConversions.ingredientId,
			unit: ingredientConversions.unit,
			gramsPerUnit: ingredientConversions.gramsPerUnit,
		})
		.from(ingredientConversions)
		.where(eq(ingredientConversions.ingredientId, ingredientId));
	return withConversions([row], conversions)[0] ?? null;
};

export const saveIngredient = async (
	db: ChoDatabase,
	{
		ownerId,
		ingredientId,
		input,
	}: { ownerId: string; ingredientId: string | null; input: IngredientInput },
): Promise<string> => {
	if (
		ingredientId !== null &&
		(await getIngredient(db, ownerId, ingredientId)) === null
	) {
		throw new Error("材料が見つかりません。");
	}

	const id = ingredientId ?? newId();
	const now = new Date().toISOString();
	const values = {
		name: input.name,
		gramsPerMilliliter: input.gramsPerMilliliter,
		inventoryItemId: input.inventoryItemId,
		note: input.note,
		updatedAt: now,
	};
	const conversions: readonly UnitConversion[] = input.conversions;
	const statements: ChoBatchItem[] = [
		ingredientId === null
			? db
					.insert(ingredients)
					.values({ id, ownerId, createdAt: now, ...values })
			: db
					.update(ingredients)
					.set(values)
					.where(
						and(
							eq(ingredients.id, ingredientId),
							eq(ingredients.ownerId, ownerId),
						),
					),
		db
			.delete(ingredientConversions)
			.where(eq(ingredientConversions.ingredientId, id)),
	];
	for (const chunk of chunkRows(
		conversions.map((conversion) => ({
			id: newId(),
			ingredientId: id,
			unit: conversion.unit,
			gramsPerUnit: conversion.gramsPerUnit,
			createdAt: now,
			updatedAt: now,
		})),
		6,
	)) {
		statements.push(db.insert(ingredientConversions).values(chunk));
	}
	await runBatch(db, statements);
	return id;
};

export const deleteIngredient = async (
	db: ChoDatabase,
	ownerId: string,
	ingredientId: string,
): Promise<void> => {
	if ((await getIngredient(db, ownerId, ingredientId)) === null) {
		throw new Error("材料が見つかりません。");
	}
	// レシピの材料行は名前を残したまま参照だけ外れる（ON DELETE SET NULL）
	await runBatch(db, [
		db
			.delete(ingredientConversions)
			.where(eq(ingredientConversions.ingredientId, ingredientId)),
		db
			.delete(ingredients)
			.where(
				and(eq(ingredients.id, ingredientId), eq(ingredients.ownerId, ownerId)),
			),
	]);
};

/** 材料を使っているレシピの材料行の数。削除前の確認と、材料一覧の表示に使う */
export const countIngredientUsages = async (
	db: ChoDatabase,
	ownerId: string,
	ingredientId: string,
): Promise<number> => {
	const [row] = await db
		.select({ count: sql<number>`count(*)` })
		.from(recipeIngredients)
		.innerJoin(recipes, eq(recipeIngredients.recipeId, recipes.id))
		.where(
			and(
				eq(recipeIngredients.ingredientId, ingredientId),
				eq(recipes.ownerId, ownerId),
			),
		);
	return row?.count ?? 0;
};
