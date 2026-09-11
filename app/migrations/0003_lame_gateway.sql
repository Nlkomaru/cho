-- 種類・材料・レシピを利用者ごとに分ける。利用者データ（recipes / cook_records / user）は
-- この時点で 0 件なので、共有だったマスタは作り直し、初回ログイン時に利用者ごとへ入れ直す。
-- SQLite は外部キー付きの NOT NULL 列を既存の表へ足せないため、表ごと作り直す。
-- 子テーブルが参照する表を消したままにすると外部キー検査が落ちるので、DROP の直後に CREATE する。
PRAGMA defer_foreign_keys = TRUE;
--> statement-breakpoint
DELETE FROM `ingredient_conversions`;
--> statement-breakpoint
DELETE FROM `recipe_ingredients`;
--> statement-breakpoint
DELETE FROM `ingredients`;
--> statement-breakpoint
DELETE FROM `recipe_steps`;
--> statement-breakpoint
DELETE FROM `recipe_references`;
--> statement-breakpoint
DELETE FROM `recipe_images`;
--> statement-breakpoint
DELETE FROM `cook_images`;
--> statement-breakpoint
DELETE FROM `cook_records`;
--> statement-breakpoint
DELETE FROM `recipes`;
--> statement-breakpoint
DELETE FROM `recipe_categories`;
--> statement-breakpoint
DROP INDEX `ingredients_name_unique`;
--> statement-breakpoint
DROP TABLE `ingredients`;
--> statement-breakpoint
CREATE TABLE `ingredients` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`name` text NOT NULL,
	`grams_per_milliliter` real,
	`inventory_item_id` text,
	`note` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ingredients_owner_name_unique` ON `ingredients` (`owner_id`,`name`);--> statement-breakpoint
CREATE INDEX `ingredients_owner_idx` ON `ingredients` (`owner_id`);--> statement-breakpoint
DROP INDEX `recipe_categories_slug_unique`;
--> statement-breakpoint
DROP TABLE `recipe_categories`;
--> statement-breakpoint
CREATE TABLE `recipe_categories` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `recipe_categories_owner_slug_unique` ON `recipe_categories` (`owner_id`,`slug`);--> statement-breakpoint
CREATE INDEX `recipe_categories_owner_idx` ON `recipe_categories` (`owner_id`);--> statement-breakpoint
DROP TABLE `recipes`;
--> statement-breakpoint
CREATE TABLE `recipes` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`title` text NOT NULL,
	`category_id` text NOT NULL,
	`summary` text,
	`servings_value` real,
	`servings_unit` text,
	`prep_minutes` integer,
	`cook_minutes` integer,
	`rest_minutes` integer,
	`tags` text NOT NULL,
	`note` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`category_id`) REFERENCES `recipe_categories`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `recipes_owner_idx` ON `recipes` (`owner_id`);--> statement-breakpoint
CREATE INDEX `recipes_category_idx` ON `recipes` (`category_id`);
