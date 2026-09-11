import type { BatchItem } from "drizzle-orm/batch";
import type { DrizzleD1Database } from "drizzle-orm/d1";

import type * as schema from "./schema";

/** D1 の接続。`getDb()`（server/db.server.ts）が返す型 */
export type ChoDatabase = DrizzleD1Database<typeof schema>;

/** batch に積める 1 文 */
export type ChoBatchItem = BatchItem<"sqlite">;

/**
 * 複数の書き込みを D1 の batch で 1 トランザクションにまとめる。
 *
 * D1 は `BEGIN` を直接受け付けないため、drizzle の transaction() ではなく batch を使う。
 * batch の型は非空タプルを要求するので、1 件以上あることを確認してから読み替える。
 */
export const runBatch = async (
	db: ChoDatabase,
	statements: readonly ChoBatchItem[],
): Promise<void> => {
	if (statements.length === 0) {
		return;
	}
	await db.batch(statements as [ChoBatchItem, ...ChoBatchItem[]]);
};
