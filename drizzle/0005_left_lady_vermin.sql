CREATE TABLE `alert_actions` (
	`alert_key` text PRIMARY KEY NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_alert_actions_status` ON `alert_actions` (`status`);