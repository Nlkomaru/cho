import { createFileRoute } from "@tanstack/react-router";

import { recipeDocumentJsonSchema } from "@/domain/recipe-json-schema";

/**
 * レシピ JSON の JSON Schema。レシピを生成するツールや AI に渡す公開契約。
 * 中身は domain/recipe.ts の zod スキーマから生成するので、実装とずれない。
 */
export const Route = createFileRoute("/schemas/$file")({
	server: {
		handlers: {
			GET: ({ params }) => {
				if (params.file !== "recipe-v1.json") {
					return new Response("見つかりません。", { status: 404 });
				}
				return Response.json(recipeDocumentJsonSchema, {
					headers: { "cache-control": "public, max-age=3600" },
				});
			},
		},
	},
});
