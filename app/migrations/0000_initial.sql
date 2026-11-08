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
