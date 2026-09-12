CREATE TABLE `trend_signals` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`keyword` text NOT NULL,
	`source` text NOT NULL,
	`market` text NOT NULL,
	`traffic_text` text DEFAULT '' NOT NULL,
	`traffic_value` integer DEFAULT 0 NOT NULL,
	`published_at` text DEFAULT '' NOT NULL,
	`captured_date` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_trend_signals_unique` ON `trend_signals` (`keyword`,`source`,`market`,`captured_date`);--> statement-breakpoint
CREATE INDEX `idx_trend_signals_created_at` ON `trend_signals` (`created_at`);