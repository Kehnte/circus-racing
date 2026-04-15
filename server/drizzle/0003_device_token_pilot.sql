CREATE TABLE IF NOT EXISTS `device_token` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`tokenHash` text NOT NULL,
	`token_raw` text,
	`pilot_id` text REFERENCES pilot(id) ON DELETE CASCADE,
	`createdAt` text DEFAULT (datetime('now')) NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `device_token_tokenHash_unique` ON `device_token` (`tokenHash`);
