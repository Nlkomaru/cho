import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import type { InventiaItem } from "./inventia.server";
import { isInventiaConfigured, searchInventiaItems } from "./inventia.server";
import { runAction } from "./result";
import { requireSessionUser } from "./session.server";

/** Inventia の品目検索。材料マスタから在庫の品目へ結び付けるときに使う */

export const isInventiaLinkAvailable = createServerFn({
	method: "GET",
}).handler(async (): Promise<boolean> => {
	await requireSessionUser();
	return isInventiaConfigured();
});

const querySchema = z.object({ query: z.string().trim().min(1).max(200) });

export const searchInventia = createServerFn({ method: "POST" })
	.inputValidator((data: { query: string }) => data)
	.handler(async ({ data }) =>
		runAction<readonly InventiaItem[]>(async () => {
			await requireSessionUser();
			const parsed = querySchema.parse(data);
			return searchInventiaItems(parsed.query);
		}),
	);
