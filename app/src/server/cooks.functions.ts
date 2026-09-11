import { createServerFn } from "@tanstack/react-start";
import type { CookInput } from "@/domain/cook";
import { cookInputSchema } from "@/domain/cook";
import { deleteCook, getCook, listCooks, saveCook } from "./cooks.server";
import { getDb } from "./db.server";
import { removeImageObjects, targetImageKeys } from "./images.server";
import { runAction } from "./result";
import { requireSessionUser } from "./session.server";

/** 作った記録のサーバー関数 */

export const fetchCooks = createServerFn({ method: "GET" })
	.inputValidator((data: { recipeId: string | null }) => data)
	.handler(async ({ data }) => {
		const user = await requireSessionUser();
		return listCooks(getDb(), user.id, data.recipeId);
	});

export const fetchCook = createServerFn({ method: "GET" })
	.inputValidator((data: { cookId: string }) => data)
	.handler(async ({ data }) => {
		const user = await requireSessionUser();
		return getCook(getDb(), user.id, data.cookId);
	});

export const submitCook = createServerFn({ method: "POST" })
	.inputValidator((data: { cookId: string | null; input: CookInput }) => data)
	.handler(async ({ data }) =>
		runAction(async () => {
			const user = await requireSessionUser();
			const input = cookInputSchema.parse(data.input);
			return {
				cookId: await saveCook(getDb(), {
					ownerId: user.id,
					cookId: data.cookId,
					input,
				}),
			};
		}),
	);

export const removeCook = createServerFn({ method: "POST" })
	.inputValidator((data: { cookId: string }) => data)
	.handler(async ({ data }) =>
		runAction(async () => {
			const user = await requireSessionUser();
			const db = getDb();
			const keys = await targetImageKeys(db, "cook", data.cookId);
			await deleteCook(db, user.id, data.cookId);
			await removeImageObjects(keys);
			return { cookId: data.cookId };
		}),
	);
