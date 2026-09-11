import { createFileRoute } from "@tanstack/react-router";

import { getDb } from "@/server/db.server";
import type { ImageScope } from "@/server/images.server";
import {
	addImage,
	imageScopes,
	isChoImageKey,
	removeImage,
} from "@/server/images.server";
import { sessionUserFromHeaders } from "@/server/session.server";

/**
 * 画像の追加と削除。multipart で受け取り、実体は R2 へ置く。
 * 追加は `scope`（recipe / cook）と `ownerId`、`file` を必要とする。
 */
export const Route = createFileRoute("/api/images")({
	server: {
		handlers: {
			POST: async ({ request }) => {
				const user = await sessionUserFromHeaders(request.headers);
				if (!user) {
					return Response.json(
						{ message: "ログインが必要です。" },
						{ status: 401 },
					);
				}
				const form = await request.formData();
				const scope = form.get("scope");
				const ownerId = form.get("ownerId");
				const file = form.get("file");
				if (
					typeof scope !== "string" ||
					!imageScopes.includes(scope as ImageScope)
				) {
					return Response.json(
						{ message: "保存先の種類が不正です。" },
						{ status: 400 },
					);
				}
				if (typeof ownerId !== "string" || ownerId.length === 0) {
					return Response.json(
						{ message: "保存先の id がありません。" },
						{ status: 400 },
					);
				}
				if (!(file instanceof File)) {
					return Response.json(
						{ message: "画像が添付されていません。" },
						{ status: 400 },
					);
				}
				try {
					const stored = await addImage(getDb(), {
						scope: scope as ImageScope,
						ownerId,
						bytes: new Uint8Array(await file.arrayBuffer()),
					});
					return Response.json(stored);
				} catch (error) {
					const message =
						error instanceof Error
							? error.message
							: "画像を保存できませんでした。";
					return Response.json({ message }, { status: 400 });
				}
			},
			DELETE: async ({ request }) => {
				const user = await sessionUserFromHeaders(request.headers);
				if (!user) {
					return Response.json(
						{ message: "ログインが必要です。" },
						{ status: 401 },
					);
				}
				const key = new URL(request.url).searchParams.get("key");
				if (!key || !isChoImageKey(key)) {
					return Response.json(
						{ message: "画像の指定が不正です。" },
						{ status: 400 },
					);
				}
				await removeImage(getDb(), key);
				return Response.json({ key });
			},
		},
	},
});
