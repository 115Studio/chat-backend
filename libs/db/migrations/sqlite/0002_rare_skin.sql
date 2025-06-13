CREATE TABLE `uploads` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`sha` text NOT NULL,
	`mime` text NOT NULL,
	`size` integer NOT NULL,
	`url` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uploads_id_index` ON `uploads` (`id`);--> statement-breakpoint
CREATE INDEX `uploads_user_id_index` ON `uploads` (`user_id`);--> statement-breakpoint
CREATE INDEX `uploads_sha_index` ON `uploads` (`sha`);--> statement-breakpoint
CREATE INDEX `uploads_created_at_index` ON `uploads` (`created_at`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_channels` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`owner_id` text NOT NULL,
	`is_pinned` integer DEFAULT false NOT NULL,
	`is_branch` integer DEFAULT false NOT NULL,
	`is_temporary` integer DEFAULT false NOT NULL,
	`is_public` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_channels`("id", "name", "owner_id", "is_pinned", "is_branch", "is_temporary", "is_public", "created_at") SELECT "id", "name", "owner_id", "is_pinned", "is_branch", "is_temporary", "is_public", "created_at" FROM `channels`;--> statement-breakpoint
DROP TABLE `channels`;--> statement-breakpoint
ALTER TABLE `__new_channels` RENAME TO `channels`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `channels_id_index` ON `channels` (`id`);--> statement-breakpoint
CREATE INDEX `channels_owner_id_index` ON `channels` (`owner_id`);--> statement-breakpoint
CREATE INDEX `channels_is_pinned_index` ON `channels` (`is_pinned`);--> statement-breakpoint
CREATE INDEX `channels_created_at_index` ON `channels` (`created_at`);--> statement-breakpoint
ALTER TABLE `messages` ADD `stages` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `messages` DROP COLUMN `content`;--> statement-breakpoint
ALTER TABLE `messages` DROP COLUMN `files`;