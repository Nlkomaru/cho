import { asc, eq, and } from "drizzle-orm";
import type { createDbClient } from "../db/client";
import { mediaImages } from "../db/schema";

type Database = ReturnType<typeof createDbClient>;
type MediaImage = typeof mediaImages.$inferSelect;
type NewMediaImage = Omit<MediaImage, "createdAt"> & { createdAt?: string };

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
    async deleteById(id: string): Promise<MediaImage | null> {
      const [row] = await db.delete(mediaImages).where(eq(mediaImages.id, id)).returning();
      return row ?? null;
    },
  };
}
