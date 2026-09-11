import { createServerFn } from "@tanstack/react-start";

import { readSessionUser } from "./session.server";

/** ログイン状態。画面のガードとヘッダーの表示に使う */
export const fetchSessionUser = createServerFn({ method: "GET" }).handler(
	async () => readSessionUser(),
);
