CREATE TABLE `weekly_reports` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`week_start` text NOT NULL,
	`title` text NOT NULL,
	`markdown` text NOT NULL,
	`tracked_count` integer DEFAULT 0 NOT NULL,
	`high_potential_count` integer DEFAULT 0 NOT NULL,
	`watch_count` integer DEFAULT 0 NOT NULL,
	`alert_count` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'ready' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_weekly_reports_week_start` ON `weekly_reports` (`week_start`);--> statement-breakpoint
CREATE INDEX `idx_weekly_reports_created_at` ON `weekly_reports` (`created_at`);