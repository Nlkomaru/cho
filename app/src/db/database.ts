import type { BatchItem } from "drizzle-orm/batch";
import type { DrizzleD1Database } from "drizzle-orm/d1";

import type * as schema from "./schema";

/** D1 の接続。`getDb()`（server/db.server.ts）が返す型 */
export type ChoDatabase = DrizzleD1Database<typeof schema>;

/** batch に積める 1 文 */
export type ChoBatchItem = BatchItem<"sqlite">;

/**
 * 1 文へ束縛する値の上限。D1 は 100 個までとされているが、実測では 100 個の
 * 文と数十個の文を同じ batch に混ぜたときに SQLITE_ERROR になるため、余裕を取る。
 */
export const maxBoundParameters = 50;

/**
 * D1 は 1 文あたり 100 個までしか値を束縛できないため、行を複数の INSERT に分ける。
 * 分けた文は runBatch で 1 トランザクションにまとめる。
 */
export const chunkRows = <T>(
	rows: readonly T[],
	columnsPerRow: number,
): T[][] => {
	const perStatement = Math.max(
		1,
		Math.floor(maxBoundParameters / columnsPerRow),
	);
	const chunks: T[][] = [];
	for (let index = 0; index < rows.length; index += perStatement) {
		chunks.push(rows.slice(index, index + perStatement));
	}
	return chunks;
};

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
