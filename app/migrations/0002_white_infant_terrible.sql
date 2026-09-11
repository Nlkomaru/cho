CREATE TABLE `recipe_references` (
	`id` text PRIMARY KEY NOT NULL,
	`recipe_id` text NOT NULL,
	`position` integer NOT NULL,
	`title` text,
	`url` text,
	`note` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`recipe_id`) REFERENCES `recipes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `recipe_references_recipe_idx` ON `recipe_references` (`recipe_id`,`position`);--> statement-breakpoint
-- 旧 source_title / source_url を参考 1 件として引き継いでから列を落とす。
-- id は元のレシピ id から作る（1 レシピにつき 1 行なので衝突しない）
INSERT INTO `recipe_references` (`id`, `recipe_id`, `position`, `title`, `url`, `note`, `created_at`, `updated_at`)
SELECT 'ref-' || `id`, `id`, 0, `source_title`, `source_url`, NULL, `created_at`, `updated_at`
FROM `recipes`
WHERE `source_title` IS NOT NULL OR `source_url` IS NOT NULL;
--> statement-breakpoint
ALTER TABLE `recipes` DROP COLUMN `source_type`;--> statement-breakpoint
ALTER TABLE `recipes` DROP COLUMN `source_title`;--> statement-breakpoint
ALTER TABLE `recipes` DROP COLUMN `source_url`;
