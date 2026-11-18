-- Drops event_texts once its rows are copied into events_translations (below): Void's deploy
-- refuses a migration that drops a table unless the file says so with this line.
-- void:allow-destructive
CREATE TABLE `events_translations` (
	`id` text PRIMARY KEY NOT NULL,
	`source_id` text NOT NULL,
	`locale` text NOT NULL,
	`fields` text NOT NULL,
	`translated_by` text DEFAULT 'unknown' NOT NULL,
	`translated_at` text,
	`gateway_log_id` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`source_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `events_translations_source_locale` ON `events_translations` (`source_id`,`locale`);--> statement-breakpoint
-- The events' translations move from event_texts (a column per field) into the package's table
-- (void-fbtee/db/schema translationsOf: the fields as JSON, plans/translated-content.md), each row
-- kept as it is: its id, event, language, text, who made it and when (the migration before this
-- one marked them). Then the old table goes.
INSERT INTO `events_translations` (`id`, `source_id`, `locale`, `fields`, `translated_by`, `translated_at`, `gateway_log_id`, `created_at`, `updated_at`)
SELECT `id`, `event_id`, `locale`, json_object('title', `title`, 'description', `description`), `translated_by`, `translated_at`, `gateway_log_id`, `created_at`, `updated_at` FROM `event_texts`;
--> statement-breakpoint
DROP TABLE `event_texts`;