# plans/primitives.md: void-fbtee's base primitives, before anything is built on them

Status: proposed 2026-11-14, waiting for the user's OK. Its place in the order: `plans/README.md`.
`plans/use-cases.md` and `plans/video-conferencing.md` are built from these.

## Why

The events app, the use cases and `void-moq` are made of the same few pieces. Some of those
pieces are already void-fbtee's. Others still live only in the example app, where nothing else can
reach them. Building the next two plans on top of example-app code would mean `void-moq` either
reaches into the app or copies it.

So this plan names void-fbtee's primitives, moves the missing ones into the package, and settles
what `void-moq` may lean on.

## What void-fbtee has today (`packages/void-fbtee/src/`, checked 2026-11-14)

| Primitive                 | What it is                                                       | Where                                                                                                      |
| ------------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| A language                | the app's languages, each one's address segment and direction    | `locales.ts`: `AppLocale`, `Lang`, `Locale`, `dirOf`, `langAttrs`, `sourceOf`, `translatedOf`              |
| The current language      | the request's, or one chosen for a job, an email or a queue      | `server.ts`: `currentLocale`, `inLocale`, `inEveryLocale`, `runIn`; `react.tsx`: `useLocale`, `useLocales` |
| Words in a language       | the app's own text, with plurals and shared words                | fbtee, through the plugin and `prepare`, `check`, `translate`                                              |
| Addresses in a language   | links, cache clearing, the sitemap, head tags                    | `routes.ts`: `routeUrl`; `server.ts`: `revalidate`, `localizedPaths`, `sitemap`; `head.ts`                 |
| A moment for a reader     | now, the reader's time zone, text written by the server and kept | `react.tsx`: `useNow`, `useTimeZone`, `Formatted`                                                          |
| Content in many languages | which stored translation of a person's text to show a reader     | `server.ts`: `textLocales`, `pickText`                                                                     |

## What's missing, and lives in the app today

The test for each one: every app whose people span languages or time zones would write it again,
and it's about language, time or place. If it passes, it moves into void-fbtee and the example's
copy is deleted. Found by reading the example's `src/`, `db/schema/`, `queues/` and `crons/`
on 2026-11-14.

**People and time**

1. **`Reader`:** a person's `{ locale, timeZone }`, and their gender only if they gave it (fbtee's
   gender, adopted in `plans/fbtee-fully.md`, step 7). `inLocale`, `momentFor`, `translate`, the email
   and the calendar entry all take it. The package doesn't store it; storing is the app's.
2. **`momentFor(instant, reader)`:** the instant on their clock, their day ("tomorrow" counted in
   _their_ day, not the event's, which is a bug today), their calendar and digits, in their
   language. It replaces `src/events/relative-days.ts`, `src/events/event-clock.ts` and the date
   code in `src/events/emails.ts`, and it's what `<EventTime>` shows.
3. **A local time where something happens, from a form:** the picker's "2027-01-20T18:00" plus a
   zone, giving the stored moment (its own zone, and UTC). Today that's `startsAt()`, `isZone` and
   `isLocalTime` in `db/schema/events.ts`, the zone list in `pages/[lang]/events/new.server.ts`, and
   the reader's zone as the default. In the package it becomes zod pieces (`localTime()`,
   `timeZone()`), `zonedStart()`, and a `<TimeZoneSelect>` that starts on the reader's zone.
4. **At a person's own local time:** "9:00 the day before, in their zone", for reminders and
   anything sent on a schedule. `dueNow(readers, rule, now)` says who is due this run, so an hourly
   job sends each one at their own hour. That fixes the one-moment-for-everyone reminder
   (`crons/reminders.ts`, `0 6 * * *`).
5. **A calendar entry:** an `.ics` with the event's own zone, and its title and description in the
   reader's language. Every calendar app then shows it on the person's own clock (this is
   `plans/use-cases.md`'s calendar file).

**Content people write**

6. **`translate(text, { from, to })`:** Workers AI with the model and prompt chosen and measured
   (now in `queues/translate.ts`). It's also used by `void-moq`'s captions.
7. **Translated content, whole:**
   - a table helper for "this row's text in another language" (`db/schema/event_texts.ts` is the
     shape: row id, locale, the text fields);
   - "which languages it still lacks" (`untranslated`);
   - "store them, clear those pages in every language, tell open pages" (`storeTranslations`);
   - "don't cache a page still waiting for its translation" (`awaitsTranslation`);
   - the queue that runs it.

   Today all of that is `src/events/translations.ts` and `queues/translate.ts`. `pickText` and
   `textLocales` are already in the package; this is the rest.

**Showing it**

8. **Text in its own language inside another:** the event's Arabic title on a Thai page or in a Thai
   email. On a page that's `<InLanguage>` from `plans/fbtee-fully.md`, step 3 (fbtee's scoped
   runtimes), not a second component here. In an email's HTML, the same marking (`<bdi lang dir>`)
   comes with item 10, `sendInLocale`.
9. **The visitor's own language:** this has its own plan, `plans/their-own-language.md`, done
   first. Its `negotiate()` and `<YourLanguage>` are primitives of the package too.
10. **An email in its reader's language:** the email's `<html lang dir>`, the body's direction, and
    writing it inside `inLocale`. Each of the four emails in `src/events/emails.ts` repeats that
    setup. The package gives `sendInLocale(reader, email)` around Void's `sendEmail`. The look stays
    the app's.

## fbtee

Using fbtee fully is its own plan, done first: `plans/fbtee-fully.md`. The primitives here are built
on what it adopts (scoped runtimes, `<fbt:enum>`, `<fbt:name>`, gender), not beside it.

## Not void-fbtee's

These stay out of the package, because they aren't about language:

- events, bookings and seats;
- who may do what (the delete key, a booking's ticket, stream tokens);
- the emails' look and the ticket's layout;
- printing a PDF (Browser Run). Printing has no language in it: the page it prints already carries
  `lang` and `dir`.

## What `void-moq` then leans on

`void-moq` uses these from void-fbtee:

- `Reader` and `useLocale`: the watcher's language and direction;
- `translate`: the captions;
- `momentFor`: "live now" and "starts in 10 minutes" on each watcher's clock.

That makes void-fbtee a real dependency of `void-moq`, not an optional one. It corrects
`plans/video-conferencing.md`, which said optional: without these primitives the captions would be
copied code again.

## Order

The plans' order is kept in one place, `plans/README.md`.

## How we'll know it's right

1. **Nothing a person receives changes.** Before touching the code, the example's current output is
   saved as the reference, in all three languages:
   - every email, as HTML and as text;
   - the reminder;
   - the ticket's page;
   - every date line the events pages show.

   After the change the same inputs must give the same bytes. Workers AI's translations aren't
   repeatable, so for `translate` it's the measure below instead.

   There are two intended differences, and the reference marks each one:
   - "tomorrow" counted in the reader's own day (a bug today);
   - each reminder sent at the reader's own hour.

2. **The hard times are checked against outside truth, not against the code itself.** Each expected
   value is written down from a source, with that source and the date it was checked. The cases:
   - London's 2027 clock changes (GOV.UK);
   - a Pacific date-line crossing;
   - the Thai Buddhist year;
   - Arabic digits and right to left;
   - a 23-hour and a 25-hour day;
   - "tomorrow" for a reader whose day has already turned over.
3. **`translate` is as good as what it replaces.** It's measured the same way the example's model was
   chosen: chrF against the stored translations of the sample events, run against real Workers AI. It
   has to score at least the 53.0 recorded in `queues/translate.ts`.
4. **No copies left behind.** The example's own versions are deleted, not wrapped. A search of
   `apps/example/` for the old functions finds nothing.
5. **They're really general:**
   - **Use cases:** all ten from `plans/use-cases.md` are written as package tests using only
     `momentFor`, `Reader` and `inLocale`, with no example code. If one can't be written that way,
     the shape is wrong and gets fixed before anything is committed.
   - **Captions:** a sentence is translated into Thai and Arabic with `translate` alone, as
     `void-moq` will do.
6. **A new app gets them:** the fresh-app test (`e2e/fresh/`) installs the package into a new Void
   app and uses `translate` and `momentFor` there, outside the example.
7. **The skill explains them in a few lines each** (`packages/void-fbtee/skills/void-fbtee/SKILL.md`).
   Needing pages to explain one means it's the wrong shape.
8. **The user judges the output:** the emails and the use-case tables in all three languages, shown
   before anything is pushed.

The usual run on top: `vp check`, `test:unit`, `test:dev`, `test:preview`, `i18n:check`.

Committed locally, and pushed when the user says.
