-- Every event has an end, as it has a start (plans/translation-simple.md, "Every event has a start
-- and an end"). The columns are added with an empty default, which D1 needs to add a NOT NULL
-- column to rows already stored; every row is then given its end here, and every event the app
-- makes sets its own (the forms require it).
ALTER TABLE `events` ADD `ends_at` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `events` ADD `ends_at_utc` text DEFAULT '' NOT NULL;--> statement-breakpoint
-- The sample events' ends, chosen for each (20261111064630_sample_events.sql has their starts).
UPDATE `events` SET `ends_at` = '2027-03-06T21:30:00+07:00[Asia/Bangkok]', `ends_at_utc` = '2027-03-06T14:30:00Z' WHERE `id` = '1854bc63-4a98-466d-963e-4447259889e4' AND `ends_at` = '';--> statement-breakpoint
UPDATE `events` SET `ends_at` = '2027-03-07T07:30:00+11:00[Australia/Sydney]', `ends_at_utc` = '2027-03-06T20:30:00Z' WHERE `id` = 'fb55d243-b2f0-4a4e-b3de-c666662fdaf9' AND `ends_at` = '';--> statement-breakpoint
UPDATE `events` SET `ends_at` = '2027-03-08T21:00:00+02:00[Africa/Cairo]', `ends_at_utc` = '2027-03-08T19:00:00Z' WHERE `id` = 'd57a8bf2-5909-4475-a407-12a879df5f01' AND `ends_at` = '';--> statement-breakpoint
UPDATE `events` SET `ends_at` = '2027-03-09T22:30:00+07:00[Asia/Bangkok]', `ends_at_utc` = '2027-03-09T15:30:00Z' WHERE `id` = '533dfc9c-35cd-46e5-9129-28edf6706600' AND `ends_at` = '';--> statement-breakpoint
-- Any other event already stored (posted before ends were asked for): no end was ever recorded, so
-- two hours after its start, on its own clock, keeping its offset and zone ("…+07:00[Asia/Bangkok]").
UPDATE `events` SET
  `ends_at` = replace(datetime(replace(substr(`starts_at`, 1, 19), 'T', ' '), '+2 hours'), ' ', 'T') || substr(`starts_at`, 20),
  `ends_at_utc` = strftime('%Y-%m-%dT%H:%M:%SZ', `starts_at_utc`, '+2 hours')
WHERE `ends_at` = '';
