CREATE TABLE `mcp_api_tokens` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `owner_subject` text NOT NULL,
  `prefix` text NOT NULL,
  `secret_hash` text NOT NULL UNIQUE,
  `allowed_tools` text NOT NULL,
  `created_at` text NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  `expires_at` text,
  `revoked_at` text,
  `last_used_at` text
);
--> statement-breakpoint
CREATE INDEX `mcp_api_tokens_owner_idx` ON `mcp_api_tokens` (`owner_subject`, `created_at`);
--> statement-breakpoint
CREATE TABLE `mcp_tool_usage_daily` (
  `token_id` text NOT NULL REFERENCES `mcp_api_tokens` (`id`) ON DELETE CASCADE,
  `tool_name` text NOT NULL,
  `utc_date` text NOT NULL,
  `call_count` integer NOT NULL DEFAULT 0 CHECK (`call_count` >= 0),
  PRIMARY KEY (`token_id`, `tool_name`, `utc_date`)
);
--> statement-breakpoint
CREATE INDEX `mcp_tool_usage_date_idx` ON `mcp_tool_usage_daily` (`utc_date`);
