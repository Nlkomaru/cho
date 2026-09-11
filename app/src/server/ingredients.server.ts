import { asc, eq, sql } from "drizzle-orm";

import type { ChoBatchItem, ChoDatabase } from "@/db/database";
import { runBatch } from "@/db/database";
import {
	ingredientConversions,
	ingredients,
	recipeIngredients,
} from "@/db/schema";
import { newId } from "@/domain/id";
import type {
	IngredientInput,
	IngredientListItem,
	UnitConversion,
} from "@/domain/ingredient";
import type { UnitSlug } from "@/domain/units";

/** 材料マスタの読み書き。換算表は行ごと入れ替える */

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
		.orderBy(asc(ingredients.name));
	const conversions = await db
		.select({
			ingredientId: ingredientConversions.ingredientId,
			unit: ingredientConversions.unit,
			gramsPerUnit: ingredientConversions.gramsPerUnit,
		})
		.from(ingredientConversions);
	return withConversions(rows, conversions);
};

export const getIngredient = async (
	db: ChoDatabase,
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
		.where(eq(ingredients.id, ingredientId));
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
		ingredientId,
		input,
	}: { ingredientId: string | null; input: IngredientInput },
): Promise<string> => {
	const id = ingredientId ?? newId();
	const now = new Date().toISOString();
	const values = {
		name: input.name,
		gramsPerMilliliter: input.gramsPerMilliliter,
		inventoryItemId: input.inventoryItemId,
		note: input.note,
		updatedAt: now,
	};
	const conversions: UnitConversion[] = input.conversions;
	const statements: ChoBatchItem[] = [
		ingredientId === null
			? db.insert(ingredients).values({ id, createdAt: now, ...values })
			: db
					.update(ingredients)
					.set(values)
					.where(eq(ingredients.id, ingredientId)),
		db
			.delete(ingredientConversions)
			.where(eq(ingredientConversions.ingredientId, id)),
	];
	if (conversions.length > 0) {
		statements.push(
			db.insert(ingredientConversions).values(
				conversions.map((conversion) => ({
					id: newId(),
					ingredientId: id,
					unit: conversion.unit,
					gramsPerUnit: conversion.gramsPerUnit,
					createdAt: now,
					updatedAt: now,
				})),
			),
		);
	}
	await runBatch(db, statements);
	return id;
};

export const deleteIngredient = async (
	db: ChoDatabase,
	ingredientId: string,
): Promise<void> => {
	// レシピの材料行は名前を残したまま参照だけ外れる（ON DELETE SET NULL）
	await runBatch(db, [
		db
			.delete(ingredientConversions)
			.where(eq(ingredientConversions.ingredientId, ingredientId)),
		db.delete(ingredients).where(eq(ingredients.id, ingredientId)),
	]);
};

/** 材料を使っているレシピの材料行の数。削除前の確認と、材料一覧の表示に使う */
export const countIngredientUsages = async (
	db: ChoDatabase,
	ingredientId: string,
): Promise<number> => {
	const [row] = await db
		.select({ count: sql<number>`count(*)` })
		.from(recipeIngredients)
		.where(eq(recipeIngredients.ingredientId, ingredientId));
	return row?.count ?? 0;
};
