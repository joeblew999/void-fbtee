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

## The design

The developer writes one thing, in the `voidFbtee()` options they already have:
`content: { events: ["title", "description"] }`. From it:

- `vp dev` writes the app's thin files, marked "made by void-fbtee, don't edit": the table's
  re-export, the queue (its options, `void/ai`, the package's consumer) and one job, each a few
  lines. The logic stays in the package.
- `vp build` fails, saying what to do, when one is missing or changed, or when the table has no
  migration (the silent drizzle-kit failure above).
- The translations table references the content table with `ON DELETE CASCADE`, so deleting a post
  deletes its translations, with no code to remember.
- The job runs hourly and keeps every row in the app's languages, both ways (what
  `reconcileTranslations` does in the example today). An optional call queues a new post at once.
- One helper gives a row's text in the reader's language (`pickText` today).
- The example's own copies are deleted; it gets post translation from the package like any app,
  and `test:fresh` proves a new `void init` app does too.

Still to settle when building: one job for all the package's work, to spend one Cron Trigger; and
whether `vp dev` also runs `void db generate` when the table changes, or the build tells the
developer to.
