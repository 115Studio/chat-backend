CREATE TABLE `channels` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`owner_id` text NOT NULL,
	`is_pinned` integer DEFAULT 0 NOT NULL,
	`is_branch` integer DEFAULT 0 NOT NULL,
	`is_temporary` integer DEFAULT 0 NOT NULL,
	`is_public` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `channels_id_index` ON `channels` (`id`);--> statement-breakpoint
CREATE INDEX `channels_owner_id_index` ON `channels` (`owner_id`);--> statement-breakpoint
CREATE INDEX `channels_is_pinned_index` ON `channels` (`is_pinned`);--> statement-breakpoint
CREATE INDEX `channels_created_at_index` ON `channels` (`created_at`);--> statement-breakpoint
CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`group_id` text NOT NULL,
	`channel_id` text NOT NULL,
	`user_id` text NOT NULL,
	`state` integer NOT NULL,
	`role` text NOT NULL,
	`model` text NOT NULL,
	`content` text,
	`files` text,
	`created_at` integer NOT NULL,
	`updated_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `messages_id_index` ON `messages` (`id`);--> statement-breakpoint
CREATE INDEX `messages_channel_id_index` ON `messages` (`channel_id`);--> statement-breakpoint
CREATE INDEX `messages_user_id_index` ON `messages` (`user_id`);--> statement-breakpoint
CREATE INDEX `messages_created_at_index` ON `messages` (`created_at`);