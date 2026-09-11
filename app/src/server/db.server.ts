import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";

import * as schema from "@/db/schema";

/**
 * D1 への接続。`.server.ts` はクライアントのバンドルから除外されるため、
 * binding を使うコードはこのファイル経由でしか書けない。
 */
export const getDb = () => drizzle(env.DB, { schema });
