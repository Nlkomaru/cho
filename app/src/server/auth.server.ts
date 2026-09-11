import { env } from "cloudflare:workers";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import type { Auth } from "better-auth";
import { betterAuth } from "better-auth";

import { createAuthOptions } from "./auth/config";
import { getDb } from "./db.server";

/**
 * `wrangler secret put` で設定する値。`wrangler types` の生成物には現れないため、
 * ここで形を宣言して読み出す。
 */
interface AuthSecretBindings {
	readonly BETTER_AUTH_SECRET: string;
	readonly DISCORD_CLIENT_ID: string;
	readonly DISCORD_CLIENT_SECRET: string;
	/** 登録を許可する Discord ユーザー id。カンマまたは空白区切り */
	readonly ALLOWED_DISCORD_USER_IDS: string;
}

const readAuthSecrets = () => {
	const bindings = env as unknown as Partial<AuthSecretBindings>;
	const secret = bindings.BETTER_AUTH_SECRET;
	const discordClientId = bindings.DISCORD_CLIENT_ID;
	const discordClientSecret = bindings.DISCORD_CLIENT_SECRET;
	if (!secret || !discordClientId || !discordClientSecret) {
		const missing = [
			!secret ? "BETTER_AUTH_SECRET" : null,
			!discordClientId ? "DISCORD_CLIENT_ID" : null,
			!discordClientSecret ? "DISCORD_CLIENT_SECRET" : null,
		].filter((name) => name !== null);
		throw new Error(
			`認証の秘密値が未設定です: ${missing.join(", ")}。ローカルは app/.dev.vars、本番は wrangler secret put で設定してください。`,
		);
	}
	return {
		secret,
		discordClientId,
		discordClientSecret,
		// 未設定なら誰も登録できない。既存ユーザーのログインは許可リストに依らず通る
		allowedDiscordUserIds: (bindings.ALLOWED_DISCORD_USER_IDS ?? "")
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
