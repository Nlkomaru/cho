import { createFileRoute, redirect } from "@tanstack/react-router";
import { LogInIcon } from "lucide-react";
import { useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { fetchSessionUser } from "@/server/session.functions";

/** Discord のコールバックが付けてくる `?error=` の説明。未知の記号はそのまま出す */
const messageByErrorCode: Record<string, string> = {
	SIGN_UP_NOT_ALLOWED:
		"この Discord アカウントでは登録できません。登録できるのは許可リスト（ALLOWED_DISCORD_USER_IDS）に載っているアカウントだけです。",
	PROVIDER_NOT_ALLOWED: "Discord 以外の方法では登録できません。",
	signup_disabled:
		"新規登録は無効です。登録済みの Discord アカウントでログインしてください。",
	account_not_linked:
		"この Discord アカウントは登録済みのアカウントに結び付いていません。登録時と同じアカウントでログインしてください。",
	unable_to_get_user_info:
		"Discord からアカウント情報を取得できませんでした。もう一度お試しください。",
	email_not_found:
		"Discord のメールアドレスを取得できませんでした。Discord 側でメールの確認を済ませてください。",
	internal_server_error:
		"サーバー側でエラーが発生しました。設定（秘密値）を確認してください。",
};

/** `?error=` などの検索条件。無い場合は URL に出さない */
interface LoginSearch {
	error?: string;
	errorDescription?: string;
	redirect?: string;
}

export const Route = createFileRoute("/login")({
	validateSearch: (search: Record<string, unknown>): LoginSearch => {
		const result: LoginSearch = {};
		if (typeof search.error === "string") {
			result.error = search.error;
		}
		if (typeof search.error_description === "string") {
			result.errorDescription = search.error_description;
		}
		if (typeof search.redirect === "string") {
			result.redirect = search.redirect;
		}
		return result;
	},
	beforeLoad: async () => {
		const user = await fetchSessionUser();
		if (user) {
			throw redirect({ to: "/" });
		}
	},
	component: LoginPage,
});

function LoginPage() {
	const { error, errorDescription, redirect: redirectTo } = Route.useSearch();
	const [failed, setFailed] = useState<string | null>(null);
	const [isSigningIn, setIsSigningIn] = useState(false);
	const message =
		failed ?? errorDescription ?? (error ? messageByErrorCode[error] : null);

	const signIn = async () => {
		setIsSigningIn(true);
		setFailed(null);
		try {
			const result = await authClient.signIn.social({
				provider: "discord",
				callbackURL: redirectTo ?? "/",
			});
			if (result.error) {
				setFailed(result.error.message ?? "ログインを開始できませんでした。");
			}
		} catch (cause) {
			setFailed(
				cause instanceof Error
					? cause.message
					: "ログインを開始できませんでした。",
			);
		} finally {
			setIsSigningIn(false);
		}
	};

	return (
		<main className="flex min-h-svh items-center justify-center bg-muted/40 p-6">
			<div className="w-full max-w-md rounded-2xl border bg-card p-8 shadow-sm">
				<h1 className="text-2xl font-bold">Cho</h1>
				<p className="mt-2 text-sm text-muted-foreground">
					料理やお菓子作りの記録を管理します。自分の記録なので、登録できるアカウントは限られています。
				</p>
				<Button className="mt-6 w-full" disabled={isSigningIn} onClick={signIn}>
					<LogInIcon />
					{isSigningIn ? "Discord へ移動しています…" : "Discord でログイン"}
				</Button>
				{message ? (
					<Alert className="mt-4" variant="destructive">
						<AlertTitle>ログインできませんでした</AlertTitle>
						<AlertDescription>{message}</AlertDescription>
					</Alert>
				) : null}
				<p className="mt-6 text-xs text-muted-foreground">
					初めての場合は、Discord のユーザー id を{" "}
					<code>ALLOWED_DISCORD_USER_IDS</code> に設定してから
					ログインしてください。
				</p>
			</div>
		</main>
	);
}
