import { createFileRoute } from "@tanstack/react-router";

import { getAuth } from "@/server/auth.server";

/**
 * better-auth のエンドポイント（/api/auth/*）。ログイン開始・コールバック・
 * ログアウト・セッション取得はすべて better-auth のハンドラーが処理する。
 */
export const Route = createFileRoute("/api/auth/$")({
	server: {
		handlers: {
			GET: ({ request }) => getAuth().handler(request),
			POST: ({ request }) => getAuth().handler(request),
		},
	},
});
