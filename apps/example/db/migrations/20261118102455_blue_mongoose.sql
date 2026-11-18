-- What's owed to each booker, kept in the database (plans/reliable-work.md): when their
-- confirmation went, what they were last told, and an event's cancellation until every booker has
-- been told of it.
ALTER TABLE `events` ADD `cancelled_at` text;--> statement-breakpoint
ALTER TABLE `bookings` ADD `confirmed_at` text;--> statement-breakpoint
ALTER TABLE `bookings` ADD `told_title` text;--> statement-breakpoint
ALTER TABLE `bookings` ADD `told_starts_at` text;--> statement-breakpoint
ALTER TABLE `bookings` ADD `told_ends_at` text;--> statement-breakpoint
ALTER TABLE `bookings` ADD `told_venue` text;--> statement-breakpoint
-- Bookings already stored were sent their confirmation by the ticket queue when they were made, and
-- told of any change since by the change queue: so they're owed nothing now. Without this, the
-- sweep (crons/owed.ts) would send every one of them its confirmation again.
UPDATE `bookings` SET `confirmed_at` = `created_at` WHERE `confirmed_at` IS NULL;--> statement-breakpoint
UPDATE `bookings` SET
  `told_title` = (SELECT `title` FROM `events` WHERE `events`.`id` = `bookings`.`event_id`),
  `told_starts_at` = (SELECT `starts_at` FROM `events` WHERE `events`.`id` = `bookings`.`event_id`),
  `told_ends_at` = (SELECT `ends_at` FROM `events` WHERE `events`.`id` = `bookings`.`event_id`),
  `told_venue` = (SELECT `venue` FROM `events` WHERE `events`.`id` = `bookings`.`event_id`)
WHERE `told_starts_at` IS NULL;
