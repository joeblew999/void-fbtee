# plans/layout.md: the package laid out as a Void app is, and the SQL in one place

Status: 2026-11-19, approved by the user in the conversation; built, committed locally. The
Globalping figures after it wait for a deploy.

## Why

- The package exports under Void's app folders (`void-fbtee/queues/translate`,
  `void-fbtee/crons/translations`, `void-fbtee/db/schema`), but its source was 35 flat files with
  other names (`queue-translate.ts`, `cron-translations.ts`, `db-schema.ts`): the code behind an
  app's `queues/translate.ts` wasn't where its name said. Void's own layout:
  `reference/structure.md` (Void 1.8.0).
- Worker code and Node-only code (the Vite plugin, the CLI) sat side by side; Node-only code reached
  the Worker once (`node:crypto`, 2026-11-18).
- 13 files ran SQL; the event page's server file alone had 15 queries. Each opened its own database
  session, and each session's first read goes to D1's main copy in North America: a page built
  fresh in Bangkok took 1.4–1.5 s to its first byte, against 0.43–0.57 s in Virginia (Globalping
  measurement 2XKamMUzyZN3yhQtQ00021Whz, 2026-11-18).

## The changes

### The package's `src/`, as an app's folders

| App file                | Was                        | Now                         |
| ----------------------- | -------------------------- | --------------------------- |
| `queues/translate.ts`   | `src/queue-translate.ts`   | `src/queues/translate.ts`   |
| `crons/translations.ts` | `src/cron-translations.ts` | `src/crons/translations.ts` |
| `middleware/99.i18n.ts` | `src/middleware.ts`        | `src/middleware/i18n.ts`    |
| `db/schema`             | `src/db-schema.ts`         | `src/db/schema.ts`          |
| the database session    | `src/db.ts`                | `src/db/index.ts`           |
| (its queries)           | in `src/content.ts`        | `src/db/translations.ts`    |

- `src/dev/`: what only the Vite plugin and the CLI load, in Node, never the Worker: `app-files`,
  `catalogs`, `check`, `cli`, `commands`, `content-files`, `init`, `plugin`, `site`, `translate`
  (worked out from the import graph, 2026-11-19). The rest of `src/` is Worker code or shared by
  both (`fingerprint`, `gemini`, `judge`, `locales`, `models`, `plurals`).
- The export names don't change, so apps change nothing.

### SQL in one place, one session per handler

- App: `src/events/store.ts`, every query on events and bookings, each function taking the session
  it's given. Pages, queues, crons and routes call it and hold no SQL.
- Package: `src/db/translations.ts`, its seven queries, each taking a session; `content.ts`'s
  functions take an optional session and pass it on.
- Each page loader, action, queue message and cron opens one session (`primaryDb()`) and passes it
  down: one trip to the main copy each, not one per function.

## Checks

- `vp check`, `test:unit`, `test:dev`, `test:preview`.
- After the deploy: Globalping, the first visit to a fresh page from Thailand and Virginia, against
  the figures above.
