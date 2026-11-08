import { eq } from "drizzle-orm";
import type { createDbClient } from "../db/client";
import { appSettings } from "../db/schema";

type Database = ReturnType<typeof createDbClient>;
export type SettingsKey = "openrouter" | "inventia";
export interface StoredSettings {
  key: SettingsKey;
  encryptedPayload: string;
  publicConfig: unknown | null;
  updatedAt: string;
}

function mapRecord(row: typeof appSettings.$inferSelect): StoredSettings {
  return {
    key: row.key,
    encryptedPayload: row.encryptedPayload,
    publicConfig: row.publicConfigJson === null ? null : JSON.parse(row.publicConfigJson),
    updatedAt: row.updatedAt,
  };
}

export function createSettingsRepository(db: Database) {
  return {
    async get(key: SettingsKey): Promise<StoredSettings | null> {
      const [row] = await db.select().from(appSettings).where(eq(appSettings.key, key)).limit(1);
      return row ? mapRecord(row) : null;
    },
    async upsert(
      key: SettingsKey,
      input: { encryptedPayload: string; publicConfig: unknown | null },
    ): Promise<StoredSettings> {
      const updatedAt = new Date().toISOString();
      const [row] = await db
        .insert(appSettings)
        .values({
          key,
          encryptedPayload: input.encryptedPayload,
          publicConfigJson: input.publicConfig === null ? null : JSON.stringify(input.publicConfig),
          updatedAt,
        })
        .onConflictDoUpdate({
          target: appSettings.key,
          set: {
            encryptedPayload: input.encryptedPayload,
            publicConfigJson:
              input.publicConfig === null ? null : JSON.stringify(input.publicConfig),
            updatedAt,
          },
        })
        .returning();
      if (!row) throw new Error("Settings upsert completed without a readable row");
      return mapRecord(row);
    },
  };
}
