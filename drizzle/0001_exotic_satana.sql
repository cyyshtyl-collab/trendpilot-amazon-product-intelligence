ALTER TABLE `candidates` ADD `asin` text;--> statement-breakpoint
ALTER TABLE `candidates` ADD `price` text DEFAULT '$0' NOT NULL;--> statement-breakpoint
ALTER TABLE `candidates` ADD `bsr` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `candidates` ADD `rating` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `candidates` ADD `search_volume` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `candidates` ADD `review_growth` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_candidates_asin_market` ON `candidates` (`asin`,`market`);