import { createServerFn } from "@tanstack/react-start";
import type { CookInput } from "@/domain/cook";
import { cookInputSchema } from "@/domain/cook";
import { deleteCook, getCook, listCooks, saveCook } from "./cooks.server";
import { getDb } from "./db.server";
import { ownerImageKeys, removeImageObjects } from "./images.server";
import { runAction } from "./result";
import { requireSessionUser } from "./session.server";

/** 作った記録のサーバー関数 */

export const fetchCooks = createServerFn({ method: "GET" })
	.inputValidator((data: { recipeId: string | null }) => data)
	.handler(async ({ data }) => {
		await requireSessionUser();
		return listCooks(getDb(), data.recipeId);
	});

export const fetchCook = createServerFn({ method: "GET" })
	.inputValidator((data: { cookId: string }) => data)
	.handler(async ({ data }) => {
		await requireSessionUser();
		return getCook(getDb(), data.cookId);
	});

export const submitCook = createServerFn({ method: "POST" })
	.inputValidator((data: { cookId: string | null; input: CookInput }) => data)
	.handler(async ({ data }) =>
		runAction(async () => {
			await requireSessionUser();
			const input = cookInputSchema.parse(data.input);
			return {
				cookId: await saveCook(getDb(), { cookId: data.cookId, input }),
			};
		}),
	);

export const removeCook = createServerFn({ method: "POST" })
	.inputValidator((data: { cookId: string }) => data)
	.handler(async ({ data }) =>
		runAction(async () => {
			await requireSessionUser();
			const db = getDb();
			const keys = await ownerImageKeys(db, "cook", data.cookId);
			await deleteCook(db, data.cookId);
			await removeImageObjects(keys);
			return { cookId: data.cookId };
		}),
	);
