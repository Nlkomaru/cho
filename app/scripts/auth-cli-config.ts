// better-auth CLI（`pnpm exec auth generate`）で D1 用のスキーマを生成するためだけの設定。
// 実アプリの設定は app/src/server/auth/config.ts にあり、ここは Drizzle の接続を持たない。
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";

import { createAuthOptions } from "../src/server/auth/config";

export const auth = betterAuth(
	createAuthOptions({
		database: drizzleAdapter({}, { provider: "sqlite" }),
		baseURL: "http://localhost:3000",
		secrets: {
			secret: "schema-generation-only",
			discordClientId: "schema-generation-only",
			discordClientSecret: "schema-generation-only",
			allowedDiscordUserIds: [],
		},
	}),
);
