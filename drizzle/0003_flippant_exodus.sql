CREATE TABLE `analysis_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`provider` text NOT NULL,
	`model` text NOT NULL,
	`requested` integer NOT NULL,
	`succeeded` integer NOT NULL,
	`fallback` integer NOT NULL,
	`duration_ms` integer NOT NULL,
	`status` text NOT NULL,
	`error_message` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_analysis_runs_created_at` ON `analysis_runs` (`created_at`);