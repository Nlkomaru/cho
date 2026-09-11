import { z } from "zod";

/**
 * サーバー関数の戻り値。失敗は例外ではなく値で返し、画面にそのまま出せる日本語にする。
 */
export type ActionResult<T> =
	| { readonly ok: true; readonly data: T }
	| { readonly ok: false; readonly message: string };

const describeError = (error: unknown): string => {
	if (error instanceof z.ZodError) {
		return error.issues
			.map((issue) => {
				const path = issue.path.join(".");
				return path.length > 0 ? `${path}: ${issue.message}` : issue.message;
			})
			.join(" / ");
	}
	if (error instanceof Error) {
		return error.message;
	}
	return "処理に失敗しました。";
};

export const runAction = async <T>(
	action: () => Promise<T>,
): Promise<ActionResult<T>> => {
	try {
		return { ok: true, data: await action() };
	} catch (error) {
		return { ok: false, message: describeError(error) };
	}
};
