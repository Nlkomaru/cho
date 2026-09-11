import type { BetterAuthOptions } from "better-auth";
import { APIError } from "better-auth/api";
import { tanstackStartCookies } from "better-auth/tanstack-start";

/**
 * better-auth の設定。D1 の接続は呼び出し側から渡す。
 *
 * 登録は Discord の許可リストに載っているアカウントだけに許す。Cho は自分専用の
 * 調理記録なので、誰でも登録できると記録が混ざる。許可リストが空なら新規登録は
 * すべて拒否し、既存ユーザーのログインだけを通す。
 */
export interface AuthConfigInput {
	readonly database: BetterAuthOptions["database"];
	readonly secrets: {
		readonly secret: string;
		readonly discordClientId: string;
		readonly discordClientSecret: string;
		readonly allowedDiscordUserIds: readonly string[];
	};
	/** 本番は独自ドメイン、開発は localhost と preview の URL を許可する */
	readonly baseURL: BetterAuthOptions["baseURL"];
	/**
	 * 利用者が増えたときの後処理。利用者ごとの初期マスタを入れるために、
	 * binding を持つ側（auth.server.ts）から渡す。
	 */
	readonly onUserCreated?: (userId: string) => Promise<void>;
}

const forbiddenMessage = "この Discord アカウントは登録を許可されていません。";
const forbiddenCodes = {
	// /login?error=... に載せる記号。画面はこれで文言を選ぶ
	notAllowed: "SIGN_UP_NOT_ALLOWED",
	providerNotAllowed: "PROVIDER_NOT_ALLOWED",
} as const;

export const createAuthOptions = ({
	database,
	secrets,
	baseURL,
	onUserCreated,
}: AuthConfigInput): BetterAuthOptions => {
	const allowedDiscordUserIds = new Set(secrets.allowedDiscordUserIds);

	return {
		appName: "Cho",
		baseURL,
		secret: secrets.secret,
		database,
		user: {
			additionalFields: {
				// Discord のユーザー id。profiles から写し、登録の可否判定に使う。
				// input を false にするとプロフィールからの取り込みも止まるため既定のままにする
				discordUserId: { type: "string", required: false },
			},
		},
		socialProviders: {
			discord: {
				clientId: secrets.discordClientId,
				clientSecret: secrets.discordClientSecret,
				mapProfileToUser: (profile) => ({ discordUserId: profile.id }),
			},
		},
		account: {
			// 同じメールアドレスの別 Discord アカウントを既存ユーザーへ結び付けない。
			// ログインできるのは登録時と同じ Discord アカウントだけにする
			accountLinking: { disableImplicitLinking: true },
		},
		databaseHooks: {
			user: {
				create: {
					before: async (user) => {
						const discordUserId = user.discordUserId;
						if (
							typeof discordUserId !== "string" ||
							!allowedDiscordUserIds.has(discordUserId)
						) {
							throw new APIError("FORBIDDEN", {
								code: forbiddenCodes.notAllowed,
								message: forbiddenMessage,
							});
						}
					},
					// 利用者ごとの初期マスタ（種類・材料・換算表）を入れる
					after: async (user) => {
						await onUserCreated?.(user.id);
					},
				},
			},
			account: {
				// ユーザー行が先に作られる経路でも Discord 以外のアカウントを残さない
				create: {
					before: async (account) => {
						if (account.providerId !== "discord") {
							throw new APIError("FORBIDDEN", {
								code: forbiddenCodes.providerNotAllowed,
								message: "Discord 以外では登録できません。",
							});
						}
						if (!allowedDiscordUserIds.has(String(account.accountId))) {
							throw new APIError("FORBIDDEN", {
								code: forbiddenCodes.notAllowed,
								message: forbiddenMessage,
							});
						}
					},
				},
			},
		},
		onAPIError: {
			// 失敗時はログイン画面へ戻し、理由を ?error= で表示する
			errorURL: "/login",
		},
		plugins: [tanstackStartCookies()],
	};
};
