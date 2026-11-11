CREATE TABLE `event_texts` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`locale` text NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `event_texts_event_locale` ON `event_texts` (`event_id`,`locale`);