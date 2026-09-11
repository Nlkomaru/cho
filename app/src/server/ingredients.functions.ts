import { createServerFn } from "@tanstack/react-start";
import type { IngredientInput } from "@/domain/ingredient";
import { ingredientInputSchema } from "@/domain/ingredient";
import { getDb } from "./db.server";
import {
	countIngredientUsages,
	deleteIngredient,
	getIngredient,
	listIngredients,
	saveIngredient,
} from "./ingredients.server";
import { runAction } from "./result";
import { requireSessionUser } from "./session.server";

/** 材料マスタのサーバー関数 */

export const fetchIngredients = createServerFn({ method: "GET" }).handler(
	async () => {
		const user = await requireSessionUser();
		return listIngredients(getDb(), user.id);
	},
);

export const fetchIngredient = createServerFn({ method: "GET" })
	.inputValidator((data: { ingredientId: string }) => data)
	.handler(async ({ data }) => {
		const user = await requireSessionUser();
		const db = getDb();
		const ingredient = await getIngredient(db, user.id, data.ingredientId);
		if (!ingredient) {
			return null;
		}
		return {
			ingredient,
			usageCount: await countIngredientUsages(db, user.id, data.ingredientId),
		};
	});

export const submitIngredient = createServerFn({ method: "POST" })
	.inputValidator(
		(data: { ingredientId: string | null; input: IngredientInput }) => data,
	)
	.handler(async ({ data }) =>
		runAction(async () => {
			const user = await requireSessionUser();
			const input = ingredientInputSchema.parse(data.input);
			return {
				ingredientId: await saveIngredient(getDb(), {
					ownerId: user.id,
					ingredientId: data.ingredientId,
					input,
				}),
			};
		}),
	);

export const removeIngredient = createServerFn({ method: "POST" })
	.inputValidator((data: { ingredientId: string }) => data)
	.handler(async ({ data }) =>
		runAction(async () => {
			const user = await requireSessionUser();
			await deleteIngredient(getDb(), user.id, data.ingredientId);
			return { ingredientId: data.ingredientId };
		}),
	);
