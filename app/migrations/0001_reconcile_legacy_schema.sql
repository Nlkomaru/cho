-- Reconcile the deployed legacy schema with the Cho schema from
-- `app/src/db/schema.ts` without losing rows.
--
-- 1. The legacy `ingredients` table (owned by the retired recipe schema) keeps
--    its rows under `ingredients_legacy_v0`. Renaming preserves those rows and
--    leaves `recipe_ingredients` / `ingredient_conversions` resolvable.
-- 2. `ingredients` is recreated with the shape declared in
--    `app/src/db/schema.ts`, and every legacy row is copied with explicit
--    defaults:
--      - density rows (`grams_per_milliliter > 0`) become `volume` / `mL`
--        with a 100 mL nutrition basis and the density as `gram_per_unit`.
--      - other rows become `count` / `個` with a one-unit nutrition basis.
--      - `inventory_item_id` is the Inventia item id, so it maps to
--        `inventia_item_id`; the legacy price columns never existed.
--      - nutrition was never stored, so the zero facts are written and `memo`
--        records that the units and nutrition still need review.
--      - duplicate names across owners get a `#n-<id>` suffix so the unique
--        `normalized_name` index holds.
--      - names are trimmed (blank becomes `名称未設定`), blank Inventia ids
--        become NULL, and names / memos are capped at the 120-character /
--        2000-character limits enforced by `app/src/domain/ingredient.ts`, so
--        every imported row parses in the app.
--    The archive keeps the original notes, density and Inventia item id.
-- 3. The six missing Cho tables are created with the exact DDL of the
--    seven-table `0000_initial.sql` from the previous revision of this
--    repository.
--
-- Every statement is unconditional on purpose: a shape other than the one
-- verified read-only stops the batch instead of being silently accepted.
ALTER TABLE `ingredients` RENAME TO `ingredients_legacy_v0`;
--> statement-breakpoint
CREATE TABLE `ingredients` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`normalized_name` text NOT NULL,
	`base_dimension` text NOT NULL CHECK (`base_dimension` IN ('mass', 'volume', 'count')),
	`base_unit` text NOT NULL,
	`nutrition_basis_amount` real NOT NULL CHECK (`nutrition_basis_amount` > 0),
	`nutrition_json` text NOT NULL,
	`gram_per_unit` real,
	`inventia_item_id` text,
	`latest_unit_price_yen` real,
	`latest_price_updated_at` text,
	`memo` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
INSERT INTO `ingredients` (
	`id`, `name`, `normalized_name`, `base_dimension`, `base_unit`,
	`nutrition_basis_amount`, `nutrition_json`, `gram_per_unit`,
	`inventia_item_id`, `latest_unit_price_yen`, `latest_price_updated_at`,
	`memo`, `created_at`, `updated_at`
)
WITH `legacy` AS (
	SELECT
		`id`,
		CASE
			WHEN trim(`name`) = '' THEN '名称未設定'
			ELSE substr(trim(`name`), 1, 120)
		END AS `name`,
		lower(
			CASE
				WHEN trim(`name`) = '' THEN '名称未設定'
				ELSE substr(trim(`name`), 1, 120)
			END
		) AS `base_normalized`,
		CASE
			WHEN `grams_per_milliliter` IS NOT NULL AND `grams_per_milliliter` > 0 THEN 'volume'
			ELSE 'count'
		END AS `base_dimension`,
		CASE
			WHEN `grams_per_milliliter` IS NOT NULL AND `grams_per_milliliter` > 0 THEN 'mL'
			ELSE '個'
		END AS `base_unit`,
		CASE
			WHEN `grams_per_milliliter` IS NOT NULL AND `grams_per_milliliter` > 0 THEN 100
			ELSE 1
		END AS `nutrition_basis_amount`,
		CASE
			WHEN `grams_per_milliliter` IS NOT NULL AND `grams_per_milliliter` > 0
				THEN `grams_per_milliliter`
			ELSE NULL
		END AS `gram_per_unit`,
		NULLIF(substr(trim(`inventory_item_id`), 1, 128), '') AS `inventia_item_id`,
		`note`,
		`created_at`,
		`updated_at`
	FROM `ingredients_legacy_v0`
),
`ranked` AS (
	SELECT
		`legacy`.*,
		ROW_NUMBER() OVER (
			PARTITION BY `base_normalized`
			ORDER BY `created_at`, `id`
		) AS `duplicate_rank`
	FROM `legacy`
)
SELECT
	`id`,
	`name`,
	CASE
		WHEN `duplicate_rank` = 1 THEN `base_normalized`
		ELSE `base_normalized` || '#' || `duplicate_rank` || '-' || substr(`id`, 1, 8)
	END,
	`base_dimension`,
	`base_unit`,
	`nutrition_basis_amount`,
	'{"caloriesKcal":0,"proteinG":0,"fatG":0,"carbohydrateG":0,"fiberG":null,"saltEquivalentG":null,"micronutrients":[]}',
	`gram_per_unit`,
	`inventia_item_id`,
	NULL,
	NULL,
	CASE
		WHEN `note` IS NULL OR trim(`note`) = ''
			THEN '旧スキーマから移行しました。基準単位と栄養価の確認が必要です。'
		ELSE substr(
			'旧スキーマから移行しました。基準単位と栄養価の確認が必要です。' || char(10) || `note`,
			1,
			2000
		)
	END,
	`created_at`,
	`updated_at`
FROM `ranked`;
--> statement-breakpoint
CREATE UNIQUE INDEX `ingredients_normalized_name_uq` ON `ingredients` (`normalized_name`);
--> statement-breakpoint
CREATE INDEX `ingredients_inventia_item_idx` ON `ingredients` (`inventia_item_id`);
--> statement-breakpoint
CREATE TABLE `media_images` (
	`id` text PRIMARY KEY NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`object_key` text NOT NULL,
	`content_type` text NOT NULL,
	`byte_size` integer NOT NULL,
	`width` integer,
	`height` integer,
	`blurhash` text,
	`caption` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `media_images_object_key_uq` ON `media_images` (`object_key`);
--> statement-breakpoint
CREATE INDEX `media_images_target_order_idx` ON `media_images` (`target_type`, `target_id`, `sort_order`);
--> statement-breakpoint
CREATE TABLE `dishes` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`category` text,
	`servings` integer NOT NULL CHECK (`servings` > 0),
	`recipe_json` text NOT NULL,
	`cached_total_nutrition_json` text,
	`cached_total_cost_yen` real,
	`cover_image_id` text REFERENCES `media_images`(`id`) ON UPDATE no action ON DELETE set null,
	`notes` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `dish_ingredients` (
	`id` text PRIMARY KEY NOT NULL,
	`dish_id` text NOT NULL REFERENCES `dishes`(`id`) ON UPDATE no action ON DELETE cascade,
	`ingredient_id` text NOT NULL REFERENCES `ingredients`(`id`) ON UPDATE no action ON DELETE restrict,
	`recipe_entry_id` text NOT NULL,
	`amount` real NOT NULL CHECK (`amount` > 0),
	`display_amount` text NOT NULL,
	`role` text NOT NULL CHECK (`role` IN ('main', 'seasoning', 'topping', 'optional')),
	`group_symbol` text,
	`group_label` text,
	`prep_note` text,
	`sort_order` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `dish_ingredients_recipe_entry_uq` ON `dish_ingredients` (`dish_id`, `recipe_entry_id`);
--> statement-breakpoint
CREATE INDEX `dish_ingredients_dish_order_idx` ON `dish_ingredients` (`dish_id`, `sort_order`);
--> statement-breakpoint
CREATE INDEX `dish_ingredients_ingredient_idx` ON `dish_ingredients` (`ingredient_id`);
--> statement-breakpoint
CREATE TABLE `meal_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`eaten_at` text NOT NULL,
	`meal_timing` text,
	`source_type` text NOT NULL CHECK (`source_type` IN ('self_cooked', 'cafeteria', 'convenience', 'supermarket', 'snack', 'restaurant', 'other')),
	`place_name` text,
	`title` text NOT NULL,
	`total_price_yen` real,
	`total_nutrition_json` text,
	`rating` integer,
	`memo` text,
	`inventia_consumption_status` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `meal_logs_eaten_at_idx` ON `meal_logs` (`eaten_at`);
--> statement-breakpoint
CREATE TABLE `meal_log_items` (
	`id` text PRIMARY KEY NOT NULL,
	`meal_log_id` text NOT NULL REFERENCES `meal_logs`(`id`) ON UPDATE no action ON DELETE cascade,
	`dish_id` text REFERENCES `dishes`(`id`) ON UPDATE no action ON DELETE set null,
	`ingredient_id` text REFERENCES `ingredients`(`id`) ON UPDATE no action ON DELETE set null,
	`name` text NOT NULL,
	`servings_factor` real DEFAULT 1 NOT NULL,
	`price_yen` real,
	`nutrition_json` text,
	`ingredient_cost_breakdown_json` text,
	`estimation_source` text,
	`sort_order` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `meal_log_items_log_order_idx` ON `meal_log_items` (`meal_log_id`, `sort_order`);
--> statement-breakpoint
CREATE INDEX `meal_log_items_dish_idx` ON `meal_log_items` (`dish_id`);
--> statement-breakpoint
CREATE INDEX `meal_log_items_ingredient_idx` ON `meal_log_items` (`ingredient_id`);
--> statement-breakpoint
CREATE TABLE `app_settings` (
	`key` text PRIMARY KEY NOT NULL CHECK (`key` IN ('openrouter', 'inventia')),
	`encrypted_payload` text NOT NULL,
	`public_config_json` text,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
