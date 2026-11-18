# plans/translated-content.md: translating what people post, from the package, not the app

## Why

Translating what people post lives in the example app today (`src/events/translations.ts`,
`queues/translate.ts`, part of `crons/reminders.ts`, `db/schema/event_texts.ts`). A new Void app
would have to copy it, and know what to copy. The developer should only say what to translate;
the package does the rest, and the build fails if anything is missing, as it does for the app's
own text.

## How a package can plug into a Void app (proven 2026-11-17, Void 1.8.0)

Void has no plugin API for queues, jobs or tables (`voidPlugin()` takes only `persistTo` and
`auxiliaryWorkers`, `reference/api/plugin.md`). It finds them by reading the app's own folders
(`reference/resource-inference.md`; the scanner is `dist/application-analysis-*.mjs`):

| What                      | How Void finds it                                                                   | What must be in the app                                                                                                                                          |
| ------------------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A queue                   | each file in `queues/` is one, named after the file                                 | the file; `maxRetries`/`retryDelay` written in it as literal numbers (Void refuses re-exported options); the consumer itself can be re-exported from the package |
| A job                     | each file in `crons/`                                                               | the file, with `export const cron = "<literal>"`; the handler can be re-exported                                                                                 |
| Bindings (AI, D1, queues) | `void/ai`, `void/db`, `void/queues` imported in the app's own folders, not packages | the app's queue file imports `void/ai`                                                                                                                           |
| A table                   | the Drizzle schema in `db/schema.ts`, which may re-export                           | one re-export of a table the package makes                                                                                                                       |
| Its migration             | `void db generate` (drizzle-kit); `void deploy` refuses a schema without one        | Void's own step, as for any table                                                                                                                                |

Proven in `apps/example` with a throwaway module (removed after): a job and a queue consumer
defined in the package, a table made by a package function, each reached by a few-line app file.
The job ran through `/__void/scheduled`, sent to the queue, the package's consumer wrote a row into
the package's table; `vp build` wrote the job's schedule, the queue with `maxRetries: 2` read from
the app's file, and the queue, D1 and AI bindings into the Worker's config.

Found on the way:

- **The table must be in its own module that imports only `void/schema-d1`.** drizzle-kit loads the
  schema with `require()`; a module that also imports `void` (for `defineQueue`) pulls in Void's
  main entry, which it can't load (`ERR_PACKAGE_PATH_NOT_EXPORTED`, `@void/deploy-core`).
- **`void db generate` then says "Migration generation complete" and writes nothing.** A schema it
  can't load fails silently, so the package's check must see that the table has a migration.
- **Each job is a Cloudflare Cron Trigger**: the free plan allows 5 per account.

## The design (decided 2026-11-17)

The app uses the package's exports at Void's own places, as it already does for the middleware
(`middleware/99.i18n.ts` is `export { default } from "void-fbtee/middleware"`). Each app file
is a few lines a developer can read; `vp dev` writes the ones missing (never over the app's own),
since it reads voidFbtee()'s options on every start and `init` runs before an app has content; and
`vp build` fails, saying what to do, when one is missing. The package's exports mirror Void's
folders, so it's plain which file each is for.

| The app's file (Void's layout)     | What's in it                                                                                                                                                                                                                                                                                                                       |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `vite.config.ts`                   | `voidFbtee({ content: { events: ["title", "description"] } })`: which tables people write in, and which fields to translate. The one declaration.                                                                                                                                                                                  |
| `db/schema/events_translations.ts` | `export const events_translations = translationsOf(events)` from `void-fbtee/db/schema` (a module that imports only `void/schema-d1`). One table shape for every app: the source row's id (`ON DELETE CASCADE`), the language, the fields as JSON, who made it, when, the gateway log.                                             |
| `queues/translate.ts`              | `import "void/ai"`, `maxRetries`/`retryDelay` as literals, `export default translationQueue({ onTranslated })` from `void-fbtee/queues/translate`. `onTranslated` is the app's: which pages to refresh, which live topic to tell.                                                                                                  |
| `crons/translations.ts`            | its schedule, `export { default } from "void-fbtee/crons/translations"`: the hourly backstop, both ways (deletes a removed language's rows, queues what's missing or `unknown`).                                                                                                                                                   |
| `middleware/99.i18n.ts`            | unchanged. The package's middleware also: when a page read a row through the package's helper and the reader's language was missing, marks the response not to be cached (`x-revalidate: 0`) and queues the translation (`waitUntil`). A new post is translated the first time it's read in another language; no page code for it. |

Reading: `translationsOf`'s helper in `void-fbtee/server` gives rows' text in the request's language
(`pickText`), and records what's missing for the middleware. A post's own code may call
`translateSoon("events", id)` to queue it at once; leaving it out costs only a delay.

Conventions for a content table: a text `id` primary key and a `locale` column (the language it
was written in). `vp build` checks them, and that the translations table has a migration (the
silent drizzle-kit failure above), from drizzle's own snapshot in `db/migrations/meta/`.

The example's `event_texts` moves into `events_translations` by a migration that copies its rows
(fields as JSON, provenance kept) before dropping it. The example's own copies of the logic are
deleted, and `test:fresh` proves a new `void init` app gets all of it from the package.

## Built (2026-11-17)

- `vp dev` doesn't run `void db generate`: it asks questions (a new table, or a renamed one?), and
  without a terminal it writes nothing and still says "Migration generation complete" (it did so
  twice here). `vp build` checks drizzle's own snapshot for the table instead, and says to run it
  in a terminal.
- Proven in dev on the example: a page read in a language the event lacked showed the original,
  wasn't cached (`x-revalidate: 0`), queued it, and the next read was Thai and cached; the hourly
  job deleted a French row and replaced an `unknown` Thai one (one queue job); deleting an event
  deleted its translations through the foreign key. `test:dev` 8/8, `test:preview` 44/44 (its
  cache checks included), the live rows' move checked on a copy (10 rows, 8 `claude`, 2
  `unknown`, the old table gone).
- `test:fresh`'s Thai-source app adds a table and the one line, and checks `vp dev` writes the
  files, `vp build` fails until the migration, and passes after `void db generate`.

## Fixed after an independent review (2026-11-17)

- **Paying once a row, not once a view.** Asking for a translation records a "queued" row per
  language (`translated_by = "queued"`) and asks again only when it's over an hour old (one atomic
  upsert); page reads, posting and the job all ask through it. Proven in dev: three reads of a
  waiting page, one translation.
- `textOf`: the original wins over a fallback's translation (no page left uncached for ever), and it
  notes only when the reader's own language is missing; `titleFor` (emails, actions) notes nothing.
- `translationsFor` takes any number of ids, 90 a query (D1's 100-parameter limit).
- An app without content no longer bundles the content runtime (130 kB): the middleware asks
  through `virtual:void-fbtee/content-ask`, a stub without content.
- fbtee's built-in strings are English: an en-US line the same as its source is right
  (`judge.ts sameLanguage`, `sourceLanguageOf`), in the check, dev and `reopenFailing`.
- A production bundle ran the app's schema before `db-schema.ts`'s consts were set (`void/db`
  imports the app's schema, which imports it): `translationsTableName` is a function declaration
  and `translationsOf` uses literals (comment in the file). `test:preview` caught it.

## Found (follow-ups)

- **Void 1.8.0 can't build a new app today** (not void-fbtee's): its range for
  `@cloudflare/vite-plugin` takes `2.0.0-rc.0`, whose output Void can't read; and since Vite+
  1.7.0 (2026-11-17) the Vite+ range `void init` writes can't take the core Vite+ needs. README
  "Reported to Void" has both, not yet filed (filing needs the user's OK); `test:fresh` pins its
  apps meanwhile (`pinUpstream`).

- Gemini left an English word in a Thai post ("ว่ายน้ำชมพระอาทิตย์ขึ้นที่ Harbour", for "Harbour
  sunrise swim"). What people post isn't run through the checks the app's own text is
  (judge.ts): it should be, before it's stored, with one retry told what was wrong.
  Fixed (2026-11-18): `postProblems` in judge.ts (an empty field, the line checks, and for a
  language not in Latin letters a capitalised Latin word kept from the original, unless it's a
  name); `translate()` in ai.ts asks once more with the problems listed, keeps the better answer
  and warns if any are left.
