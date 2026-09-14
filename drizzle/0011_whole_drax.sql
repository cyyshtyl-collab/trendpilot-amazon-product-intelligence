CREATE TABLE `app_users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`username` text NOT NULL,
	`password_hash` text NOT NULL,
	`password_salt` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_app_users_username` ON `app_users` (`username`);--> statement-breakpoint
INSERT INTO `app_users` (`username`,`password_hash`,`password_salt`,`role`,`status`,`created_at`,`updated_at`) VALUES ('test001','e8423fb7cd44d735b08f4d2579fa0661d783a844d63191b9fdf67129a54bbf89','d25a999621e07226bd58b58940757c76','member','active',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
