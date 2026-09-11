CREATE TABLE `candidates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`market` text NOT NULL,
	`score` integer NOT NULL,
	`verdict` text NOT NULL,
	`trend` integer DEFAULT 0 NOT NULL,
	`revenue` text DEFAULT '$0' NOT NULL,
	`reviews` integer DEFAULT 0 NOT NULL,
	`margin` integer DEFAULT 0 NOT NULL,
	`scores_json` text NOT NULL,
	`signals_json` text NOT NULL,
	`pains_json` text NOT NULL,
	`selling_point` text DEFAULT '' NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_candidates_score` ON `candidates` (`score`);--> statement-breakpoint
CREATE INDEX `idx_candidates_verdict` ON `candidates` (`verdict`);