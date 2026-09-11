import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { cookRecords } from "@/db/schema";
import type { RecipeInput } from "@/domain/recipe";
import {
	recipeDocumentSchema,
	recipeInputFromDocument,
	recipeInputSchema,
} from "@/domain/recipe";
import { getDb } from "./db.server";
import { ownerImageKeys, removeImageObjects } from "./images.server";
import {
	deleteCategory,
	deleteRecipe,
	getRecipeDetail,
	listCategories,
	listRecipes,
	saveCategory,
	saveRecipe,
} from "./recipes.server";
import { runAction } from "./result";
import { requireSessionUser } from "./session.server";

/** レシピと種類のサーバー関数。読み取りは loader から、書き込みは画面から呼ぶ */

const categoryInputSchema = z
	.object({
		slug: z
			.string()
			.trim()
			.min(1)
			.max(50)
			.regex(
				/^[a-z0-9-]+$/,
				"slug は英小文字・数字・ハイフンで入力してください",
			),
		name: z.string().trim().min(1).max(50),
	})
	.strict();

export type CategoryInput = z.output<typeof categoryInputSchema>;

export const fetchCategories = createServerFn({ method: "GET" }).handler(
	async () => {
		await requireSessionUser();
		return listCategories(getDb());
	},
);

export const fetchRecipes = createServerFn({ method: "GET" }).handler(
	async () => {
		await requireSessionUser();
		return listRecipes(getDb());
	},
);

export const fetchRecipe = createServerFn({ method: "GET" })
	.inputValidator((data: { recipeId: string }) => data)
	.handler(async ({ data }) => {
		await requireSessionUser();
		return getRecipeDetail(getDb(), data.recipeId);
	});

export const submitRecipe = createServerFn({ method: "POST" })
	.inputValidator(
		(data: { recipeId: string | null; input: RecipeInput }) => data,
	)
	.handler(async ({ data }) =>
		runAction(async () => {
			await requireSessionUser();
			const input = recipeInputSchema.parse(data.input);
			return {
				recipeId: await saveRecipe(getDb(), { recipeId: data.recipeId, input }),
			};
		}),
	);

/** レシピ JSON を取り込む。種類の slug と材料名は保存時に既存のマスタへ突き合わせる */
export const importRecipeDocument = createServerFn({ method: "POST" })
	.inputValidator((data: { json: string }) => data)
	.handler(async ({ data }) =>
		runAction(async () => {
			await requireSessionUser();
			let raw: unknown;
			try {
				raw = JSON.parse(data.json);
			} catch {
				throw new Error(
					"JSON として読み取れませんでした。括弧やカンマを確認してください。",
				);
			}
			const document = recipeDocumentSchema.parse(raw);
			const recipeId = await saveRecipe(getDb(), {
				recipeId: null,
				input: recipeInputFromDocument(document),
			});
			return { recipeId };
		}),
	);

export const removeRecipe = createServerFn({ method: "POST" })
	.inputValidator((data: { recipeId: string }) => data)
	.handler(async ({ data }) =>
		runAction(async () => {
			await requireSessionUser();
			const db = getDb();
			const keys = await ownerImageKeys(db, "recipe", data.recipeId);
			const cookIds = await db
				.select({ id: cookRecords.id })
				.from(cookRecords)
				.where(eq(cookRecords.recipeId, data.recipeId));
			const cookKeys = (
				await Promise.all(
					cookIds.map((cook) => ownerImageKeys(db, "cook", cook.id)),
				)
			).flat();
			await deleteRecipe(db, data.recipeId);
			await removeImageObjects([...keys, ...cookKeys]);
			return { recipeId: data.recipeId };
		}),
	);

export const submitCategory = createServerFn({ method: "POST" })
	.inputValidator(
		(data: { categoryId: string | null; input: CategoryInput }) => data,
	)
	.handler(async ({ data }) =>
		runAction(async () => {
			await requireSessionUser();
			const input = categoryInputSchema.parse(data.input);
			return {
				categoryId: await saveCategory(getDb(), {
					categoryId: data.categoryId,
					...input,
				}),
			};
		}),
	);

export const removeCategory = createServerFn({ method: "POST" })
	.inputValidator((data: { categoryId: string }) => data)
	.handler(async ({ data }) =>
		runAction(async () => {
			await requireSessionUser();
			await deleteCategory(getDb(), data.categoryId);
			return { categoryId: data.categoryId };
		}),
	);
