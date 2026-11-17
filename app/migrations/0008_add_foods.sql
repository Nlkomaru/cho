-- Add staple foods table and link meal_log_items to foods.
CREATE TABLE `foods` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`category` text,
	`serving_label` text NOT NULL,
	`price_yen` real,
	`nutrition_json` text NOT NULL,
	`memo` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `foods_name_idx` ON `foods` (`name`);
--> statement-breakpoint
ALTER TABLE `meal_log_items` ADD `food_id` text REFERENCES `foods`(`id`) ON DELETE set null;
--> statement-breakpoint
CREATE INDEX `meal_log_items_food_idx` ON `meal_log_items` (`food_id`);
