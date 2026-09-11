import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import type { Auth } from "better-auth";
import { betterAuth } from "better-auth";

import { createAuthOptions } from "./auth/config";
import { getDb } from "./db.server";
import { seedDefaultMasterData } from "./master-data.server";
import { readSecret, requireSecret } from "./secrets.server";

const readAuthSecrets = () => {
	const missing = [
		"BETTER_AUTH_SECRET",
		"DISCORD_CLIENT_ID",
		"DISCORD_CLIENT_SECRET",
	].filter((name) => readSecret(name) === null);
	if (missing.length > 0) {
		throw new Error(
			`認証の秘密値が未設定です: ${missing.join(", ")}。ローカルは app/.dev.vars、本番は wrangler secret put で設定してください。`,
		);
	}
	return {
		secret: requireSecret("BETTER_AUTH_SECRET"),
		discordClientId: requireSecret("DISCORD_CLIENT_ID"),
		discordClientSecret: requireSecret("DISCORD_CLIENT_SECRET"),
		// 未設定なら誰も登録できない。既存ユーザーのログインは許可リストに依らず通る
		allowedDiscordUserIds: (readSecret("ALLOWED_DISCORD_USER_IDS") ?? "")
			.split(/[\s,]+/)
			.filter((id) => id.length > 0),
	};
};

let cached: Auth | null = null;

/**
 * better-auth のインスタンス。秘密値が未設定のときにアプリ全体を落とさないよう、
 * 最初のアクセスまで生成を遅らせる。
 */
export const getAuth = (): Auth => {
	cached ??= betterAuth(
		createAuthOptions({
			database: drizzleAdapter(getDb(), { provider: "sqlite" }),
			secrets: readAuthSecrets(),
			// 利用者ごとの初期マスタ。ログイン時に 1 度だけ入る
			onUserCreated: (userId) => seedDefaultMasterData(getDb(), userId),
			baseURL: {
				// preview の URL も含める。host が一致しないときは本番へ倒す
				allowedHosts: [
					"cho.nikomaru.dev",
					"*.nikomaru.workers.dev",
					"localhost:*",
					"127.0.0.1:*",
				],
				protocol: "auto",
				fallback: "https://cho.nikomaru.dev",
			},
		}),
	);
	return cached;
};
