import { z } from "zod";

import { recipeDocumentSchema } from "./recipe";

/**
 * レシピ JSON の JSON Schema（draft 2020-12）。外部の生成ツールに配る公開契約で、
 * /schemas/recipe-v1.json から取得できる。
 */
export const recipeDocumentJsonSchema = {
	...z.toJSONSchema(recipeDocumentSchema, {
		target: "draft-2020-12",
		io: "input",
	}),
	$id: "https://cho.nikomaru.dev/schemas/recipe-v1.json",
	title: "Cho recipe document v1",
	description:
		"Cho のレシピ JSON。単位は日本語表記（大さじ）でも slug（tbsp）でもよく、取り込み時に slug へ正規化する。",
} as const;
