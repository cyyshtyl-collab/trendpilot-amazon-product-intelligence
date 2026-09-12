CREATE TABLE `candidate_snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`candidate_id` integer NOT NULL,
	`captured_date` text NOT NULL,
	`price` text DEFAULT '$0' NOT NULL,
	`bsr` integer DEFAULT 0 NOT NULL,
	`rating` real DEFAULT 0 NOT NULL,
	`reviews` integer DEFAULT 0 NOT NULL,
	`review_growth` integer DEFAULT 0 NOT NULL,
	`search_volume` integer DEFAULT 0 NOT NULL,
	`trend` integer DEFAULT 0 NOT NULL,
	`revenue` text DEFAULT '$0' NOT NULL,
	`margin` integer DEFAULT 0 NOT NULL,
	`captured_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_snapshots_candidate_date` ON `candidate_snapshots` (`candidate_id`,`captured_date`);--> statement-breakpoint
CREATE INDEX `idx_snapshots_captured_date` ON `candidate_snapshots` (`captured_date`);