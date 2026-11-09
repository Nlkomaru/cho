import { and, asc, eq, inArray, lt, notInArray, sql } from "drizzle-orm";
import type { createDbClient } from "../db/client";
import { dishes, mediaImages } from "../db/schema";

type Database = ReturnType<typeof createDbClient>;
export type MediaImage = typeof mediaImages.$inferSelect;

/** D1 allows 100 bound parameters per statement. */
const ID_CHUNK_SIZE = 90;
type NewMediaImage = Omit<MediaImage, "createdAt"> & { createdAt?: string };

/** Guards covers that were set before the claim migration ran. */
const notCoverOfAnyDish = notInArray(
  mediaImages.id,
  sql`(SELECT ${dishes.coverImageId} FROM ${dishes} WHERE ${dishes.coverImageId} IS NOT NULL)`,
);

function validateMetadata(input: NewMediaImage): void {
  for (const [field, value] of Object.entries({
    id: input.id,
    targetType: input.targetType,
    targetId: input.targetId,
    objectKey: input.objectKey,
    contentType: input.contentType,
  })) {
    if (value.trim().length === 0) throw new TypeError(`${field} must be non-empty`);
  }
  if (!Number.isInteger(input.byteSize) || input.byteSize <= 0) {
    throw new RangeError("byteSize must be a positive integer");
  }
}

export function createMediaImageRepository(db: Database) {
  return {
    async create(input: NewMediaImage): Promise<MediaImage> {
      validateMetadata(input);
      const [row] = await db.insert(mediaImages).values(input).returning();
      if (!row) throw new Error("Media image insert completed without a readable row");
      return row;
    },
    async getById(id: string): Promise<MediaImage | null> {
      const [row] = await db.select().from(mediaImages).where(eq(mediaImages.id, id)).limit(1);
      return row ?? null;
    },
    async listForTarget(targetType: string, targetId: string): Promise<MediaImage[]> {
      return db
        .select()
        .from(mediaImages)
        .where(and(eq(mediaImages.targetType, targetType), eq(mediaImages.targetId, targetId)))
        .orderBy(asc(mediaImages.sortOrder), asc(mediaImages.id));
    },
    async setTarget(
      id: string,
      targetType: string,
      targetId: string,
      sortOrder: number,
    ): Promise<MediaImage | null> {
      if (!targetType.trim() || !targetId.trim())
        throw new TypeError("targetType and targetId must be non-empty");
      if (!Number.isInteger(sortOrder) || sortOrder < 0)
        throw new RangeError("sortOrder must be a non-negative integer");
      const [row] = await db
        .update(mediaImages)
        .set({ targetType, targetId, sortOrder })
        .where(eq(mediaImages.id, id))
        .returning();
      return row ?? null;
    },
    async listByIds(ids: readonly string[]): Promise<MediaImage[]> {
      const unique = [...new Set(ids)];
      const rows: MediaImage[] = [];
      for (let index = 0; index < unique.length; index += ID_CHUNK_SIZE) {
        const chunk = unique.slice(index, index + ID_CHUNK_SIZE);
        rows.push(...(await db.select().from(mediaImages).where(inArray(mediaImages.id, chunk))));
      }
      return rows;
    },
    /**
     * Unassigned images that have been unassigned for more than `olderThanHours`, oldest first.
     * `created_at` is reset when an image is released, so it marks the start of the grace period.
     * Images still referenced as a dish cover are never listed.
     */
    async listStaleUnassigned(olderThanHours: number, limit: number): Promise<MediaImage[]> {
      if (!Number.isInteger(olderThanHours) || olderThanHours < 0)
        throw new RangeError("olderThanHours must be a non-negative integer");
      if (!Number.isInteger(limit) || limit < 1 || limit > ID_CHUNK_SIZE)
        throw new RangeError(`limit must be an integer from 1 to ${ID_CHUNK_SIZE}`);
      return db
        .select()
        .from(mediaImages)
        .where(
          and(
            eq(mediaImages.targetType, "unassigned"),
            eq(mediaImages.targetId, "unassigned"),
            lt(mediaImages.createdAt, sql`datetime('now', ${`-${olderThanHours} hours`})`),
            notCoverOfAnyDish,
          ),
        )
        .orderBy(asc(mediaImages.createdAt))
        .limit(limit);
    },
    /** Deletes only rows that are still unassigned, so a concurrent claim wins. */
    async deleteUnassigned(ids: readonly string[]): Promise<MediaImage[]> {
      if (ids.length === 0) return [];
      if (ids.length > ID_CHUNK_SIZE)
        throw new RangeError(`At most ${ID_CHUNK_SIZE} images can be deleted at once`);
      return db
        .delete(mediaImages)
        .where(
          and(
            inArray(mediaImages.id, [...ids]),
            eq(mediaImages.targetType, "unassigned"),
            eq(mediaImages.targetId, "unassigned"),
            notCoverOfAnyDish,
          ),
        )
        .returning();
    },
    async deleteById(id: string): Promise<MediaImage | null> {
      const [row] = await db.delete(mediaImages).where(eq(mediaImages.id, id)).returning();
      return row ?? null;
    },
  };
}
