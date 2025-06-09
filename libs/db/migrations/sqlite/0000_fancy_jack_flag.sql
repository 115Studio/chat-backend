CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text,
	`name` text NOT NULL,
	`plan` integer DEFAULT 1 NOT NULL,
	`oauth_id` text,
	`oauth_provider` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_id_index` ON `users` (`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_oauth_id_index` ON `users` (`oauth_id`);