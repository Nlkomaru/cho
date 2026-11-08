import { drizzle, type DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "./schema";

export function createDbClient(binding: D1Database): DrizzleD1Database<typeof schema> {
  return drizzle(binding, { schema });
}
