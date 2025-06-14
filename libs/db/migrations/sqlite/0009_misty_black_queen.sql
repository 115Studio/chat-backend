CREATE TABLE `synced_messages` (
	`user_id` text NOT NULL,
	`channel_id` text NOT NULL,
	`stages` text DEFAULT '[]' NOT NULL,
	PRIMARY KEY(`user_id`, `channel_id`)
);
--> statement-breakpoint
CREATE INDEX `synced_messages_user_id_index` ON `synced_messages` (`user_id`);--> statement-breakpoint
CREATE INDEX `synced_messages_channel_id_index` ON `synced_messages` (`channel_id`);