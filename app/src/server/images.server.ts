import { env } from "cloudflare:workers";
import { and, eq, sql } from "drizzle-orm";

import type { ChoDatabase } from "@/db/database";
import { cookImages, cookRecords, recipeImages, recipes } from "@/db/schema";
import { newId } from "@/domain/id";

/**
 * 画像の保管。実体は R2 に置き、D1 にはキーと種類だけを持つ。
 * キーは `recipes/<レシピ id>/<uuid>.<拡張子>` と `cooks/<記録 id>/<uuid>.<拡張子>`。
 */
export const imageScopes = ["recipe", "cook"] as const;

export type ImageScope = (typeof imageScopes)[number];

const extensionByContentType: Record<string, string> = {
	"image/jpeg": "jpg",
	"image/png": "png",
	"image/webp": "webp",
	"image/gif": "gif",
	"image/avif": "avif",
};

/** 1 枚あたりの上限。スマートフォンの写真が収まる範囲に収める */
export const maxImageBytes = 15 * 1024 * 1024;

const startsWith = (bytes: Uint8Array, signature: readonly number[]): boolean =>
	signature.every((value, index) => bytes[index] === value);

const ascii = (bytes: Uint8Array, offset: number, value: string): boolean =>
	[...value].every(
		(char, index) => bytes[offset + index] === char.charCodeAt(0),
	);

/** 先頭バイトから画像の種類を判定する。multipart の content-type だけでは信用しない */
export const detectImageContentType = (bytes: Uint8Array): string | null => {
	if (startsWith(bytes, [0xff, 0xd8, 0xff])) {
		return "image/jpeg";
	}
	if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
		return "image/png";
	}
	if (ascii(bytes, 0, "GIF87a") || ascii(bytes, 0, "GIF89a")) {
		return "image/gif";
	}
	if (ascii(bytes, 0, "RIFF") && ascii(bytes, 8, "WEBP")) {
		return "image/webp";
	}
	// ISO BMFF: 先頭 4 バイトはサイズ、続く 4 バイトが "ftyp"、その次のブランドで AVIF と判別する
	if (
		ascii(bytes, 4, "ftyp") &&
		(ascii(bytes, 8, "avif") || ascii(bytes, 8, "avis"))
	) {
		return "image/avif";
	}
	return null;
};

export interface StoredImage {
	readonly id: string;
	readonly key: string;
	readonly contentType: string;
}

/** 対象（レシピ・作った記録）がその利用者のものか確かめる */
const targetBelongsToOwner = async (
	db: ChoDatabase,
	ownerId: string,
	scope: ImageScope,
	targetId: string,
): Promise<boolean> => {
	const [row] =
		scope === "recipe"
			? await db
					.select({ id: recipes.id })
					.from(recipes)
					.where(and(eq(recipes.id, targetId), eq(recipes.ownerId, ownerId)))
			: await db
					.select({ id: cookRecords.id })
					.from(cookRecords)
					.innerJoin(recipes, eq(cookRecords.recipeId, recipes.id))
					.where(
						and(eq(cookRecords.id, targetId), eq(recipes.ownerId, ownerId)),
					);
	return row !== undefined;
};

export const addImage = async (
	db: ChoDatabase,
	{
		ownerId,
		scope,
		targetId,
		bytes,
	}: {
		ownerId: string;
		scope: ImageScope;
		targetId: string;
		bytes: Uint8Array;
	},
): Promise<StoredImage> => {
	if (bytes.byteLength === 0) {
		throw new Error("画像が空です。");
	}
	if (bytes.byteLength > maxImageBytes) {
		throw new Error(
			`画像は ${Math.floor(maxImageBytes / 1024 / 1024)}MB までです。`,
		);
	}
	const contentType = detectImageContentType(bytes);
	if (!contentType) {
		throw new Error("JPEG・PNG・WebP・GIF・AVIF の画像を選んでください。");
	}
	if (!(await targetBelongsToOwner(db, ownerId, scope, targetId))) {
		throw new Error(
			"保存先が見つかりません。先にレシピや記録を保存してください。",
		);
	}

	const id = newId();
	const key = `${scope === "recipe" ? "recipes" : "cooks"}/${targetId}/${id}.${extensionByContentType[contentType]}`;
	await env.IMAGES.put(key, bytes, { httpMetadata: { contentType } });

	const now = new Date().toISOString();
	if (scope === "recipe") {
		const [last] = await db
			.select({
				position: sql<number>`coalesce(max(${recipeImages.position}), -1)`,
			})
			.from(recipeImages)
			.where(eq(recipeImages.recipeId, targetId));
		await db.insert(recipeImages).values({
			id,
			recipeId: targetId,
			position: (last?.position ?? -1) + 1,
			r2Key: key,
			contentType,
			alt: null,
			createdAt: now,
		});
	} else {
		const [last] = await db
			.select({
				position: sql<number>`coalesce(max(${cookImages.position}), -1)`,
			})
			.from(cookImages)
			.where(eq(cookImages.cookRecordId, targetId));
		await db.insert(cookImages).values({
			id,
			cookRecordId: targetId,
			position: (last?.position ?? -1) + 1,
			r2Key: key,
			contentType,
			alt: null,
			createdAt: now,
		});
	}
	return { id, key, contentType };
};

/** 添付を外して R2 の実体も消す。他の利用者の画像と、行が無いキーには何もせず false を返す */
export const removeImage = async (
	db: ChoDatabase,
	ownerId: string,
	key: string,
): Promise<boolean> => {
	const [recipeRow] = await db
		.select({ id: recipeImages.id })
		.from(recipeImages)
		.innerJoin(recipes, eq(recipeImages.recipeId, recipes.id))
		.where(and(eq(recipeImages.r2Key, key), eq(recipes.ownerId, ownerId)));
	if (recipeRow) {
		await db.delete(recipeImages).where(eq(recipeImages.id, recipeRow.id));
		await env.IMAGES.delete(key);
		return true;
	}
	const [cookRow] = await db
		.select({ id: cookImages.id })
		.from(cookImages)
		.innerJoin(cookRecords, eq(cookImages.cookRecordId, cookRecords.id))
		.innerJoin(recipes, eq(cookRecords.recipeId, recipes.id))
		.where(and(eq(cookImages.r2Key, key), eq(recipes.ownerId, ownerId)));
	if (cookRow) {
		await db.delete(cookImages).where(eq(cookImages.id, cookRow.id));
		await env.IMAGES.delete(key);
		return true;
	}
	return false;
};

/** レシピと作った記録に紐付くキーを全部集める。まとめて消すときの対象になる */
export const targetImageKeys = async (
	db: ChoDatabase,
	scope: ImageScope,
	targetId: string,
): Promise<readonly string[]> => {
	const rows =
		scope === "recipe"
			? await db
					.select({ r2Key: recipeImages.r2Key })
					.from(recipeImages)
					.where(eq(recipeImages.recipeId, targetId))
			: await db
					.select({ r2Key: cookImages.r2Key })
					.from(cookImages)
					.where(eq(cookImages.cookRecordId, targetId));
	return rows.map((row) => row.r2Key);
};

export const removeImageObjects = async (
	keys: readonly string[],
): Promise<void> => {
	await Promise.all(keys.map((key) => env.IMAGES.delete(key)));
};

/** 画像の持ち主。レシピの owner_id、作った記録ならそのレシピの owner_id を返す */
export const imageOwnerId = async (
	db: ChoDatabase,
	key: string,
): Promise<string | null> => {
	const [recipeRow] = await db
		.select({ ownerId: recipes.ownerId })
		.from(recipeImages)
		.innerJoin(recipes, eq(recipeImages.recipeId, recipes.id))
		.where(eq(recipeImages.r2Key, key));
	if (recipeRow) {
		return recipeRow.ownerId;
	}
	const [cookRow] = await db
		.select({ ownerId: recipes.ownerId })
		.from(cookImages)
		.innerJoin(cookRecords, eq(cookImages.cookRecordId, cookRecords.id))
		.innerJoin(recipes, eq(cookRecords.recipeId, recipes.id))
		.where(eq(cookImages.r2Key, key));
	return cookRow?.ownerId ?? null;
};

/** キーが Cho の作った形かどうか。他人が組み立てたキーを読みに行かせない */
export const isChoImageKey = (key: string): boolean =>
	/^(recipes|cooks)\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp|gif|avif)$/.test(
		key,
	);

export const readImageObject = async (key: string) => env.IMAGES.get(key);
