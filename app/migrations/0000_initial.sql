-- Legacy baseline of the deployed production database.
--
-- Production D1 (`cho`) was created by the retired recipe / cook-record schema
-- (migrations `0000_great_loners.sql` ... `0003_lame_gateway.sql`) and already
-- contains this exact `ingredients` shape. The operator therefore records this
-- file in `d1_migrations` after verifying the shape read-only, instead of
-- executing it against production:
--
--   INSERT INTO d1_migrations (name) VALUES ('0000_initial.sql');
--
-- New databases execute it here so `0001_reconcile_legacy_schema.sql` can
-- rebuild the table from a known shape. Do not add `IF NOT EXISTS`: every
-- statement must fail loudly if the shape is not the expected one.
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
CREATE UNIQUE INDEX `ingredients_owner_name_unique` ON `ingredients` (`owner_id`, `name`);
--> statement-breakpoint
CREATE INDEX `ingredients_owner_idx` ON `ingredients` (`owner_id`);
