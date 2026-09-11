import { env } from "cloudflare:workers";

/**
 * `wrangler secret put` で設定する値。`wrangler types` の生成物には現れないため、
 * ここで一度だけ型を付けて読み出す。未設定は null で返し、呼び出し側が
 * 「何を設定すればよいか」を利用者向けの文言で伝える。
 */
export const readSecret = (name: string): string | null => {
	const bindings = env as unknown as Record<string, unknown>;
	const value = bindings[name];
	return typeof value === "string" && value.length > 0 ? value : null;
};

/** 秘密値が未設定のときに、設定方法まで示して止める */
export const requireSecret = (name: string): string => {
	const value = readSecret(name);
	if (value === null) {
		throw new Error(
			`${name} が設定されていません。ローカルは app/.dev.vars、本番は wrangler secret put で設定してください。`,
		);
	}
	return value;
};
