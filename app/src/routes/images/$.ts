import { createFileRoute } from "@tanstack/react-router";

import { getDb } from "@/server/db.server";
import {
	imageOwnerId,
	isChoImageKey,
	readImageObject,
} from "@/server/images.server";
import { sessionUserFromHeaders } from "@/server/session.server";

/**
 * 保存した画像の配信。キーは `recipes/<id>/<uuid>.<拡張子>` の形だけを受け付ける。
 * 記録は自分専用なので、ログインしていない相手には返さない。
 */
export const Route = createFileRoute("/images/$")({
	server: {
		handlers: {
			GET: async ({ request, params }) => {
				const user = await sessionUserFromHeaders(request.headers);
				if (!user) {
					return new Response("ログインが必要です。", { status: 401 });
				}
				const key = params._splat;
				if (!key || !isChoImageKey(key)) {
					return new Response("見つかりません。", { status: 404 });
				}
				// 他の利用者の画像は存在しないものとして返す
				if ((await imageOwnerId(getDb(), key)) !== user.id) {
					return new Response("見つかりません。", { status: 404 });
				}
				const object = await readImageObject(key);
				if (!object) {
					return new Response("見つかりません。", { status: 404 });
				}
				if (request.headers.get("if-none-match") === object.httpEtag) {
					return new Response(null, {
						status: 304,
						headers: { etag: object.httpEtag },
					});
				}
				return new Response(object.body, {
					headers: {
						"content-type":
							object.httpMetadata?.contentType ?? "application/octet-stream",
						"cache-control": "private, max-age=86400",
						etag: object.httpEtag,
					},
				});
			},
		},
	},
});
