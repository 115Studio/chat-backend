CREATE TABLE `byok` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`key` text NOT NULL,
	`models` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `byok_id_index` ON `byok` (`id`);--> statement-breakpoint
CREATE INDEX `byok_user_id_index` ON `byok` (`user_id`);--> statement-breakpoint
CREATE TABLE `personality` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`default` integer DEFAULT false NOT NULL,
	`prompt` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `personality_id_index` ON `personality` (`id`);--> statement-breakpoint
CREATE INDEX `personality_user_id_index` ON `personality` (`user_id`);--> statement-breakpoint
ALTER TABLE `users` ADD `default_model` text DEFAULT 'gpt-3.5-turbo' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `display_models` text DEFAULT '[]' NOT NULL;