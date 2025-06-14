ALTER TABLE `channels` ADD `updated_at` integer;--> statement-breakpoint
CREATE INDEX `channels_updated_at_index` ON `channels` (`updated_at`);