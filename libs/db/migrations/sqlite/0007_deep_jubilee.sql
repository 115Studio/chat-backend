ALTER TABLE `personality` RENAME COLUMN "default" TO "is_default";--> statement-breakpoint
CREATE INDEX `personality_is_default_index` ON `personality` (`is_default`);