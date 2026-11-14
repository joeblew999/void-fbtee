# plans/primitives.md: void-fbtee's base primitives, before anything is built on them

Status: proposed 2026-11-14, waiting for the user's OK. Comes before `plans/use-cases.md` and
`plans/video-conferencing.md`: both are built from these.

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

1. **Machine translation of content.** The example's `queues/translate.ts` and
   `src/events/translations.ts` translate a post into the app's other languages with Workers AI,
   store each one and refresh its pages. Only `pickText` and `textLocales` are in the package. Every
   app with content people write, and `void-moq`'s captions, would redo the rest. So it moves in:
   `translate(text, from, to[])` with the model and prompt chosen, measured as the example did (the
   chrF test in `queues/translate.ts`), plus the queue pattern around it.
2. **A moment for a person, not just the reader in front of the page.** Emails, reminders, tickets
   and the use cases all need "this instant, for that person": their clock, their day ("tomorrow"),
   their calendar (Thai years), in their language. Today it's per-file code (`src/events/emails.ts`,
   `src/events/event-clock.ts`, `src/events/relative-days.ts`). That's `viewFor` from
   `plans/use-cases.md`, and it belongs in void-fbtee because it's time and language: `momentFor(instant,
   { locale, timeZone })`.
3. **A person's language and zone, kept.** Every app stores them in its own way (bookings here). The
   package only gives the shape: a `Reader` type (`{ locale: AppLocale; timeZone: string }`) that
   `inLocale`, `momentFor` and `translate` all take. It doesn't store anything: storing is the app's.

## Not void-fbtee's

These stay out of the package, because they aren't about language:

- events, bookings and seats;
- who may do what (the delete key, a booking's ticket, stream tokens);
- the emails' look and the ticket's layout.

## What `void-moq` then leans on

`void-moq` uses these from void-fbtee:

- `Reader` and `useLocale`: the watcher's language and direction;
- `translate`: the captions;
- `momentFor`: "live now" and "starts in 10 minutes" on each watcher's clock.

That makes void-fbtee a real dependency of `void-moq`, not an optional one. It corrects
`plans/video-conferencing.md`, which said optional: without these primitives the captions would be
copied code again.

## Order

1. This plan: the three missing primitives in the package, with tests, the skill and the example
   using them (its translate queue, emails and reminders on the package's versions, and its own copies
   removed).
2. `plans/use-cases.md`, on `momentFor` and `Reader`.
3. `plans/video-conferencing.md`, `void-moq` on all of it.

## How we'll know it's right

1. **Nothing a person receives changes.** Before touching the code, the example's current output is
   saved as the reference, in all three languages:
   - every email, as HTML and as text;
   - the reminder;
   - the ticket's page;
   - every date line the events pages show.

   After the change the same inputs must give the same bytes. Workers AI's translations aren't
   repeatable, so for `translate` it's the measure below instead.

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
