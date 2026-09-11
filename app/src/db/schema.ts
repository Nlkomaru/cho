import { relations, sql } from "drizzle-orm";
import {
	index,
	integer,
	real,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";

// 全テーブルの主キーは UUIDv7（domain/id.ts の newId で生成）。日時は ISO 8601 UTC の
// 文字列で持ち、表示側で JST へ直す。drizzle の enum は TS の型付けだけで DDL には出ない

/** レシピの種類。フランス料理・お菓子などを利用者が選ぶ */
export const recipeCategories = sqliteTable(
	"recipe_categories",
	{
		id: text("id").primaryKey(),
		// 利用者ごとのマスタ。ログインした本人の行だけを読み書きする
		ownerId: text("owner_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		slug: text("slug").notNull(),
		name: text("name").notNull(),
		// 選択肢の表示順
		sortOrder: integer("sort_order").notNull().default(0),
		createdAt: text("created_at").notNull(),
		updatedAt: text("updated_at").notNull(),
	},
	(t) => [
		uniqueIndex("recipe_categories_owner_slug_unique").on(t.ownerId, t.slug),
		index("recipe_categories_owner_idx").on(t.ownerId),
	],
);

/**
 * 材料マスタ。レシピの材料行はこの行を参照でき、参照があると単位換算と
 * Inventia の品目リンクが使える。
 */
export const ingredients = sqliteTable(
	"ingredients",
	{
		id: text("id").primaryKey(),
		// 利用者ごとのマスタ。密度や Inventia のリンクも本人のもの
		ownerId: text("owner_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		// 体積 1ml あたりの質量。大さじ・小さじ・カップ・ml を g へ換算する基準
		gramsPerMilliliter: real("grams_per_milliliter"),
		// Inventia の品目 id。材料から在庫の品目へ飛ぶためのリンク
		inventoryItemId: text("inventory_item_id"),
		note: text("note"),
		createdAt: text("created_at").notNull(),
		updatedAt: text("updated_at").notNull(),
	},
	(t) => [
		// 同じ利用者の中で材料名は重複させない。レシピ JSON の取り込みは名前で材料マスタを引く
		uniqueIndex("ingredients_owner_name_unique").on(t.ownerId, t.name),
		index("ingredients_owner_idx").on(t.ownerId),
	],
);

/**
 * 材料ごとの単位換算表。密度では表せない数え方（1個 = 50g）と、密度より
 * 実測を優先したい単位（はちみつの大さじ = 21g など）だけを持つ。
 */
export const ingredientConversions = sqliteTable(
	"ingredient_conversions",
	{
		id: text("id").primaryKey(),
		ingredientId: text("ingredient_id")
			.notNull()
			.references(() => ingredients.id, { onDelete: "cascade" }),
		unit: text("unit").notNull(),
		gramsPerUnit: real("grams_per_unit").notNull(),
		createdAt: text("created_at").notNull(),
		updatedAt: text("updated_at").notNull(),
	},
	(t) => [
		uniqueIndex("ingredient_conversions_ingredient_unit_unique").on(
			t.ingredientId,
			t.unit,
		),
		index("ingredient_conversions_ingredient_idx").on(t.ingredientId),
	],
);

export const recipes = sqliteTable(
	"recipes",
	{
		id: text("id").primaryKey(),
		// 作った記録もレシピ経由でこの利用者のものになる
		ownerId: text("owner_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		title: text("title").notNull(),
		categoryId: text("category_id")
			.notNull()
			.references(() => recipeCategories.id, { onDelete: "restrict" }),
		summary: text("summary"),
		// できあがり量（例: 18cm 1台、4人前）。単位は domain/units.ts の slug
		servingsValue: real("servings_value"),
		servingsUnit: text("servings_unit"),
		prepMinutes: integer("prep_minutes"),
		cookMinutes: integer("cook_minutes"),
		restMinutes: integer("rest_minutes"),
		// 検索用のタグ。JSON 配列の文字列として持つ
		tags: text("tags", { mode: "json" }).$type<string[]>().notNull(),
		note: text("note"),
		createdAt: text("created_at").notNull(),
		updatedAt: text("updated_at").notNull(),
	},
	(t) => [
		index("recipes_owner_idx").on(t.ownerId),
		index("recipes_category_idx").on(t.categoryId),
	],
);

/**
 * レシピの参考。参考にした本・サイト・動画などを複数持てる。
 * 参考が 1 つも無いレシピは、自分のレシピとして扱う。
 */
export const recipeReferences = sqliteTable(
	"recipe_references",
	{
		id: text("id").primaryKey(),
		recipeId: text("recipe_id")
			.notNull()
			.references(() => recipes.id, { onDelete: "cascade" }),
		position: integer("position").notNull(),
		// 本のページや記事の見出し。URL だけの参考なら null
		title: text("title"),
		url: text("url"),
		note: text("note"),
		createdAt: text("created_at").notNull(),
		updatedAt: text("updated_at").notNull(),
	},
	(t) => [index("recipe_references_recipe_idx").on(t.recipeId, t.position)],
);

export const recipeIngredients = sqliteTable(
	"recipe_ingredients",
	{
		id: text("id").primaryKey(),
		recipeId: text("recipe_id")
			.notNull()
			.references(() => recipes.id, { onDelete: "cascade" }),
		// レシピ内の並び順
		position: integer("position").notNull(),
		name: text("name").notNull(),
		// 「適量」は数量を持たないので null
		amountValue: real("amount_value"),
		amountUnit: text("amount_unit").notNull(),
		note: text("note"),
		// 材料マスタ。材料を消してもレシピの材料名は残す
		ingredientId: text("ingredient_id").references(() => ingredients.id, {
			onDelete: "set null",
		}),
		createdAt: text("created_at").notNull(),
		updatedAt: text("updated_at").notNull(),
	},
	(t) => [index("recipe_ingredients_recipe_idx").on(t.recipeId, t.position)],
);

export const recipeSteps = sqliteTable(
	"recipe_steps",
	{
		id: text("id").primaryKey(),
		recipeId: text("recipe_id")
			.notNull()
			.references(() => recipes.id, { onDelete: "cascade" }),
		position: integer("position").notNull(),
		text: text("text").notNull(),
		createdAt: text("created_at").notNull(),
		updatedAt: text("updated_at").notNull(),
	},
	(t) => [index("recipe_steps_recipe_idx").on(t.recipeId, t.position)],
);

/** レシピの参照画像。実体は R2 に置き、キーだけを持つ */
export const recipeImages = sqliteTable(
	"recipe_images",
	{
		id: text("id").primaryKey(),
		recipeId: text("recipe_id")
			.notNull()
			.references(() => recipes.id, { onDelete: "cascade" }),
		position: integer("position").notNull(),
		r2Key: text("r2_key").notNull(),
		contentType: text("content_type").notNull(),
		alt: text("alt"),
		createdAt: text("created_at").notNull(),
	},
	(t) => [index("recipe_images_recipe_idx").on(t.recipeId, t.position)],
);

/** 作った記録。いつ、どのレシピで作ったかと、そのときの写真や投稿リンクを持つ */
export const cookRecords = sqliteTable(
	"cook_records",
	{
		id: text("id").primaryKey(),
		recipeId: text("recipe_id")
			.notNull()
			.references(() => recipes.id, { onDelete: "cascade" }),
		// 作った日時。ISO 8601 UTC
		cookedAt: text("cooked_at").notNull(),
		// 5 段階の評価
		rating: integer("rating"),
		note: text("note"),
		// Instagram へ投稿したときのリンク
		instagramUrl: text("instagram_url"),
		createdAt: text("created_at").notNull(),
		updatedAt: text("updated_at").notNull(),
	},
	(t) => [
		index("cook_records_recipe_idx").on(t.recipeId, t.cookedAt),
		index("cook_records_cooked_at_idx").on(t.cookedAt),
	],
);

/** 作った記録の写真。実体は R2 に置き、キーだけを持つ */
export const cookImages = sqliteTable(
	"cook_images",
	{
		id: text("id").primaryKey(),
		cookRecordId: text("cook_record_id")
			.notNull()
			.references(() => cookRecords.id, { onDelete: "cascade" }),
		position: integer("position").notNull(),
		r2Key: text("r2_key").notNull(),
		contentType: text("content_type").notNull(),
		alt: text("alt"),
		createdAt: text("created_at").notNull(),
	},
	(t) => [index("cook_images_cook_record_idx").on(t.cookRecordId, t.position)],
);

// --- better-auth が使うテーブル ---
// `pnpm exec auth generate --config ./scripts/auth-cli-config.ts --output ./scripts/auth-schema.generated.ts`
// の生成物をそのまま置く。列名・型・索引は better-auth 側の期待と一致させる必要がある。
// 日時だけは他テーブルと違い epoch ミリ秒（timestamp_ms）で持つ

export const user = sqliteTable("user", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	email: text("email").notNull().unique(),
	emailVerified: integer("email_verified", { mode: "boolean" })
		.default(false)
		.notNull(),
	image: text("image"),
	createdAt: integer("created_at", { mode: "timestamp_ms" })
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.notNull(),
	updatedAt: integer("updated_at", { mode: "timestamp_ms" })
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.$onUpdate(() => new Date())
		.notNull(),
	// 登録を許可する Discord アカウントの判定に使う（auth/config.ts）
	discordUserId: text("discord_user_id"),
});

export const session = sqliteTable(
	"session",
	{
		id: text("id").primaryKey(),
		expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
		token: text("token").notNull().unique(),
		createdAt: integer("created_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" })
			.$onUpdate(() => new Date())
			.notNull(),
		ipAddress: text("ip_address"),
		userAgent: text("user_agent"),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
	},
	(table) => [index("session_userId_idx").on(table.userId)],
);

export const account = sqliteTable(
	"account",
	{
		id: text("id").primaryKey(),
		accountId: text("account_id").notNull(),
		providerId: text("provider_id").notNull(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		accessToken: text("access_token"),
		refreshToken: text("refresh_token"),
		idToken: text("id_token"),
		accessTokenExpiresAt: integer("access_token_expires_at", {
			mode: "timestamp_ms",
		}),
		refreshTokenExpiresAt: integer("refresh_token_expires_at", {
			mode: "timestamp_ms",
		}),
		scope: text("scope"),
		password: text("password"),
		createdAt: integer("created_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" })
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [index("account_userId_idx").on(table.userId)],
);

export const verification = sqliteTable(
	"verification",
	{
		id: text("id").primaryKey(),
		identifier: text("identifier").notNull(),
		value: text("value").notNull(),
		expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
		createdAt: integer("created_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const userRelations = relations(user, ({ many }) => ({
	sessions: many(session),
	accounts: many(account),
}));

export const sessionRelations = relations(session, ({ one }) => ({
	user: one(user, { fields: [session.userId], references: [user.id] }),
}));

export const accountRelations = relations(account, ({ one }) => ({
	user: one(user, { fields: [account.userId], references: [user.id] }),
}));
