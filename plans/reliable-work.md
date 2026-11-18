# plans/reliable-work.md: work done in order, and nothing lost

Status: 2026-11-18, approved by the user in the conversation; built, committed locally.

## Why

Measured and read on 2026-11-18 (sources at the end):

- Gemini 4 Hydrogen always thinks first (it can't be turned off): about 5 s a request, its time
  varying 3–4× from one string to the next. Anything that waits on a translation waits on that.
- The change email polled for the translation, a minute at a time.
- Void (1.8.0 and 1.10.0) starts every request's, queue job's, cron's and page rebuild's database
  session on a replica (`first-unconstrained`); the live database has replication on, its main
  copy in Eastern North America. A job started seconds after a write can read the database from
  before it: a booking's confirmation dropped as "deleted", a delete cancelling all but the newest
  booker, a change telling some bookers and not others, a reminder missed, a page cached old.
- None of the live queues has a dead-letter queue: a message out of retries is gone. `cancel`
  retries 3 times with no gap. Deleting an event deletes its bookings at once, so nothing records
  who still needs telling.
- Void's page cache, on our own Cloudflare account, is KV plus each data centre's own cache.
  Clearing a page reaches KV (other locations see the old one for 60 s or more) and only the data
  centre that clears it; a rebuild that started before a change can write the old page back
  after the clear. The event page is cached for a year.

## The rules

1. **The database is the truth; queues are the fast path.** Everything the system owes someone
   (a confirmation, a change email, a cancellation) is written in the database when it becomes
   owed and cleared when it's done. A queue message only makes it happen sooner.
2. **One step starts the next.** No step waits on a clock for another to finish.
3. **A clock only for failure:** retrying a failed call (email, PDF printing, Gemini), and the
   sweep that takes over work nobody finished (a running job and a dead one look the same from
   outside).
4. **Reads that decide or build a cached page start on the main database** (`first-primary`).

## The changes

### The database (package and app)

- `primaryDb()` in the package (`src/db.ts`, exported as `void-fbtee/db`): Void's
  `createDb(env.DB, { session: "first-primary" })`. Every read and write in the package
  (`content.ts`) and the app (actions, loaders, queues, crons, routes) goes through it; one per
  handler, so its reads stay consistent with each other.
- A lint rule in `vp check` (both workspaces): no `db` from `void/db`.

### What's owed, in the database

- `bookings.confirmed_at`: set when the confirmation email (with its ticket) is sent.
- `bookings.told`: what the booker was last told: the event's title, start, end and place (JSON),
  set at booking. A change email goes when the event differs from it, and sets it.
- `events.cancelled_at`: deleting an event sets it; the event's pages say it's cancelled at once,
  and it can't be booked, changed or listed. Each booking stays until its cancellation email has
  gone; the event and its translations go with its last booking (at once with none).

### The chain

- **Booking:** the action stores the booking and queues `ticket`. `ticket` sends the email and
  sets `confirmed_at`.
- **Change:** the action saves the event and asks for the translation. Bookers whose language
  needs none (the event's own, or only the time or place changed) are queued on `change` at once.
  The translation queue, after storing a language, calls the app's `onTranslated`, which queues
  `change` for that language's bookers. `change` compares `told` with the event; if they differ it
  makes the email (and the next ticket download prints the new details), sends it and sets `told`;
  if not it does nothing, so twice is harmless and a change undone sends nothing.
- **Translation failing:** a new package hook, `onTranslationFailed(table, id, locale)`, called
  when the queue meets a payment problem or a message runs out of tries. The app queues `change`
  for those bookers, who get the title as written.
- **Delete:** the action sets `cancelled_at` and queues `cancel` per booking. `cancel` sends the
  email, then deletes the booking (and the event with its last).

### The sweep

- `crons/owed.ts`, every 15 minutes: bookings not confirmed, bookings whose `told` differs from
  their event, bookings of cancelled events, each untouched for 15 minutes, are queued again. It
  only finds work after a crash or lost message.
- Every queue retries with a delay (`retryDelay`), so an outage of seconds doesn't use up its
  tries.

### Pages

- The event page cached 60 s, not a year: the clear after a change stays as the fast path, and
  whatever Void's cache keeps by mistake lasts a minute.

### Dev translation

- `translateCatalog`: the next string starts as soon as any finishes, not in groups of 4 that
  wait for the slowest.

## Follow-ups (not built here)

- `plans/void-upgrade.md`: with 1.10.0, `maxConcurrency` on the translation queue.
- Reports to Void, filed only with the user's OK: queue, cron and page-rebuild sessions start on a
  replica; the page-cache clear isn't global and a rebuild in flight can undo it (Workers Cache's
  `ctx.cache.purge` is global); live updates dropping (16 in the week to 2026-11-18); our numbers
  on #856 (1,876 cached pages from 86 deploys, none expiring, 2026-11-18).
- The deploy job deletes cached pages from deploys older than the one before (kept for a
  rollback), until Void handles #856.
- Where a new database is made (`ENAM` today): Asia-Pacific if most visitors are there; set only
  when a database is created. README, deploying.

## Tests

- Dev (`e2e/dev/`): a change of time only, emailed at once in the booker's language; a change of
  title, emailed after the translation is stored, with the new title translated; two changes
  quickly, one email; a delete, every booker cancelled, the event gone after; a lost message
  (sent nowhere), found by running the sweep (`/__void/scheduled`).
- `vp check`: the lint rule (tried on a file importing `db` from `void/db`: refused).
- Not built: a deployed check that a page and a job report `served_by_primary` (D1 returns it with
  each query; nothing in the app shows it, so it needs a route on the live site that does). The
  user's call.

## Sources (checked 2026-11-18)

- Void 1.8.0 and 1.10.0 (`npm pack`): `dist/index.mjs` (`__voidQueue`, `handleScheduled` through
  `withRuntimeEnv`), `dist/runtime/db.mjs`, `void/isr` and `@void/isr` `runtime.mjs`, `docs/`.
- Void issues #755 and #783 (sessions, bookmarks: not in 1.10.0), #856 (KV build-up).
- Cloudflare docs: D1 read replication and `withSession` (updated 2026-08-10); Cache API
  (`cache.delete` is local to one data centre); How KV works (60 s or more).
- The live account through the Cloudflare connector: D1 `read_replication.mode: "auto"`,
  `running_in_region: "ENAM"`; queue settings; KV keys; seven days of Worker logs.
