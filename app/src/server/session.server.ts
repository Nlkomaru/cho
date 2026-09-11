import { getRequestHeaders } from "@tanstack/react-start/server";

import { getAuth } from "./auth.server";

/** ログイン中の利用者。Cho は自分専用なので、記録はすべてこの人のものとして扱う */
export interface SessionUser {
	readonly id: string;
	readonly name: string;
	readonly email: string;
	readonly image: string | null;
}

export const sessionUserFromHeaders = async (
	headers: Headers,
): Promise<SessionUser | null> => {
	const session = await getAuth().api.getSession({ headers });
	if (!session) {
		return null;
	}
	return {
		id: session.user.id,
		name: session.user.name,
		email: session.user.email,
		image: session.user.image ?? null,
	};
};

export const readSessionUser = (): Promise<SessionUser | null> =>
	sessionUserFromHeaders(getRequestHeaders());

/** 書き込みの入口で必ず通す。ログインしていなければ例外にして、画面へ理由を返す */
export const requireSessionUser = async (): Promise<SessionUser> => {
	const user = await readSessionUser();
	if (!user) {
		throw new Error("ログインが必要です。もう一度ログインしてください。");
	}
	return user;
};
