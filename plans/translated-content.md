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
(`middleware/99.i18n.ts` is `export { default } from "void-fbtee/middleware"`). No generated
files: each app file is a few lines a developer can read, `void-fbtee init` writes it, and
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

Still to settle when building: whether `vp dev` also runs `void db generate` when the table is
missing, or the build tells the developer to.
