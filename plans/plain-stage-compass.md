# plans/plain-stage-compass.md: every test on the stage Void gives it, checking through Void

Status: written 2026-11-13 after a second, deeper round of research; the events demo's use of
every dev hook added at the user's direction; its four assumptions checked; approved 2026-11-13, in progress.

## Context

The tests and some code were built before we understood how Void splits its stages. Each stage
gives different services, and a test can only check what its stage has. The user, 2026-11-13: it's
for everything, not only the events demo; tests and code should conform to Void's model.

Sources, all checked 2026-11-13: Void 1.8.0's docs in `apps/example/node_modules/void/docs/`
(cited by file below), its code in `node_modules/void/dist/` (cited by file), miniflare's
`send_email.worker.js`, and Void's own test guide, `TESTING.md` in voidzero-dev/void (main, as read
through the GitHub connector).

## Void's model

| Stage                                            | Bindings                                                                      | Page cache (ISR)                                                                        | Email                                                                                                                                                                      | AI                                                                              | Queues                                                                     | Crons                                      |
| ------------------------------------------------ | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------ |
| **Unit tests** (Node)                            | none: a call throws (`guide/testing.md`)                                      | none                                                                                    | Void's harness, `void/email/testing`                                                                                                                                       | none                                                                            | none                                                                       | none                                       |
| **Dev server** (`vp run dev`)                    | Miniflare, local                                                              | **none**: `revalidate()` does nothing (`reference/api/resources.md`; `runtime/isr.mjs`) | Void's dev inbox: `/__void/inbox`, raw at `/<id>/raw`, `DELETE` clears; token in `.void/dev-trigger-token` (`guide/email/sending.md`; `index.mjs`, `void:email-dev-inbox`) | Workers AI, real, via the Cloudflare sign-in; no local stand-in (`guide/ai.md`) | a send runs the consumer; `POST /__void/queue` by hand (`guide/queues.md`) | `POST /__void/scheduled` (`guide/jobs.md`) |
| **Preview** (`vp preview`, the production build) | Miniflare, local; the **same local database as dev** (`guide/database/d1.md`) | yes, with a local KV                                                                    | no Void inbox (the plugin is `apply: "serve"`); Cloudflare's stand-in saves `.eml` files and sends nothing                                                                 | Workers AI, real, same sign-in (`guide/ai.md`: "development and preview")       | as dev                                                                     | none                                       |
| **Deployed**                                     | Cloudflare's                                                                  | yes                                                                                     | really sent                                                                                                                                                                | Workers AI                                                                      | Cloudflare Queues                                                          | Cron Triggers                              |

Also stage-dependent: `.dev` routes and pages exist only in dev, `.prod` ones only in builds
(`guide/server-routing.md`, `pages-routing/overview.md`); `.env` is read only locally
(`reference/config.md`); http→https redirects skip localhost (`guide/edge/redirects.md`).

How Void tests itself (`TESTING.md`): the full browser contract against the **production preview**,
plus a smaller **dev-mode** suite for what only dev has; "both runtime modes covered without
repeating the full browser matrix". Live tests that "write data, enqueue messages, invoke AI" are
opt-in, never part of the ordinary local or CI run. Servers start with `--strictPort` and count as
ready only once they print their own URL (we already do).

## What we found that doesn't conform

1. **AI behind our own flag.** `inference: { bindings: { ai: process.env.WORKERS_AI === "on" } }` in
   `apps/example/void.config.ts` turns off what Void turns on when an app imports `void/ai`
   (`reference/resource-inference.md`: the AI binding is inferred from the import). Built on it:
   `vp run dev:ai` (root `vite.config.ts`), `WORKERS_AI=on` in the deploy tasks
   (`apps/example/vite.config.ts`) and `e2e/preview.ts`, `routes/api/translations.dev.ts` (Claude
   translating by hand), and the "Not available" branch in `queues/translate.ts`.
2. **Emails link to the live site from every stage.** `siteOrigin(c)` returns `voidFbtee({ site })`,
   set to the live address (`apps/example/vite.config.ts` line 52), and the three emails build
   their links with it (`[id].server.ts` lines 88 and 111, `new.server.ts` line 61). Proven on dev
   2026-11-13: a private link email sent from dev pointed at
   `https://void-fbtee-example.gedw99.workers.dev/en-US/events/…`, where that event doesn't exist.
   Right for canonical, hreflang and the sitemap; wrong for an email, which must link to where it
   was sent from (dev, a Worker Preview, or live).
3. **The flows that email and use AI run on the preview.** `e2e/events.test.ts` posts, books,
   deletes and shows translations on the production preview, where no email can be checked through
   Void.
4. **Nothing tests that changes clear the page cache.** Posting, booking and deleting each call
   `revalidate()`. On dev that does nothing; on the preview, today's tests read pages through the
   browser after live updates, not as a fresh visitor would get them from the cache.
5. **`test:production`** (`e2e/production.ts`) runs every e2e file against the live site, booking
   with made-up addresses that now get real emails, and posting events that call Workers AI.
6. **CI's quick live check** (`e2e/deployed/live.test.ts`) posts an event, which calls Workers AI,
   on every push: by Void's rule, a live test that should be opt-in.
7. **The events demo leaves out Void's dev hooks.** It has no cron, so `/__void/scheduled` is never
   used; nothing drives a queue through `/__void/queue`; and AI is off in dev (finding 1). A demo
   that doesn't use them lets the code and tests ignore them, which is how they were ignored (the
   user, 2026-11-13).
8. **Dev and preview share one local database**, and the preview run resets it (`e2e/setup.ts`,
   `void db reset`). So the two runs can't overlap, and a preview run wipes what a developer had in
   dev. Known (the setup refuses to run while dev is up), but not written down.

## Checked before starting (2026-11-13)

- **`/__void/queue` takes our queues by name** (`translate`, `cancel`) on the dev server, and answers
  with each message's outcome (`{"ok":true,"decisions":{"1":{"action":"ack"}}}`), so a test can
  assert it; the cancellation it ran was in Void's inbox.
- **All 9 tests in `e2e/events.test.ts` pass on the dev server** (`E2E_URL=http://localhost:5173`),
  with AI on: dev mode's extra warnings break none of them.
- **The page cache works in the local preview:** on a fresh build, `/en-US/events` answered
  `x-isr-cache: MISS`, then `HIT`; a request with a cookie skipped it.
- **Without our flag, Void turns AI on in dev by itself** ("Establishing remote connection"), and a
  new post was translated into Thai in 7 seconds.
- Found on the way: a dev server from an earlier session kept running because it shows as
  `bin.js run dev:ai`, not `vp run dev`; the package build's guard caught it. `test:dev`'s own
  start and stop must match the processes as they really appear.

## The work, as one change

1. [ ] **AI the Void way.** Remove the `WORKERS_AI` flag and everything built on it (finding 1).
       Dev, preview and deploy all have Workers AI; the README's setup says to sign in first
       (`vp run login`): without it Void doesn't start dev or preview for an app that uses AI (seen
       2026-11-13).
2. [ ] **The events demo uses every dev hook** (finding 7).
   - **A cron, `crons/reminders.ts`:** once a day, everyone booked on an event starting in the next
     24 hours gets a reminder email in their own language (`inLocale`, no request), with the time on
     the event's clock: a fourth email in `src/events/emails.ts`. The window comes from the run's
     `scheduledTime`, so each event is reminded once.
   - **Queues through `/__void/queue`:** re-translating a waiting post is one call to Void's queue
     endpoint (the README shows it), in place of our `translations.dev.ts` route.
   - **Workers AI** in dev, by item 1.
3. [ ] **Emails link to where they were sent from** (finding 2). The emails take the request's own
       origin (`new URL(c.req.url).origin`), and the delete action passes it to the cancellation queue.
       A cron has no request, so a booking keeps the origin it was made on (a new `bookings.origin`
       column and its migration) and the reminder links there: a booking made on dev is reminded with a
       dev link, one made live with a live link. `siteOrigin` stays for canonical, hreflang, the sitemap
       and robots.txt. The package's `siteOrigin` comment and SKILL.md say which to use for what.
4. [ ] **A dev-server test run: `vp run test:dev`** (Void's dev-mode suite). A Vitest project in
       `e2e/dev/`, against the dev server: the developer's own if it's running, else it starts
       `vp run dev` itself. Helpers in `e2e/helpers.ts` read Void's inbox and call Void's triggers,
       each with the token from `.void/dev-trigger-token`, as the fresh install check does. Each test
       checks its email right where it's sent:
   - post with "email me my link": the link email in the poster's language, its link on the dev
     server opening the event with Delete;
   - book in Thai: the confirmation in Thai, with the title as stored for a sample event;
   - book your own event and keep the link; delete while someone watches: each booker's
     cancellation in their own language, and the open page says cancelled;
   - a new post's AI translation: the Thai page's title arrives in Thai script, live (any wording);
   - the reminder cron, run with `POST /__void/scheduled` and a `scheduledTime` that puts the
     test's event in the window: a Thai booker's reminder in Thai, an Arabic booker's in Arabic,
     each linking to the event on the dev server; a run for the next day sends none;
   - each queue's consumer on its own, through `POST /__void/queue`, asserting Void's answer for the
     message (`ack`, or `retry` when it should fail): a cancellation message is acked and gives its
     email; a translate message for a waiting post is acked and gives its translations; one for an
     event that no longer exists is acked with nothing sent.
5. [ ] **The preview run keeps the full browser contract** (`vp run test:preview`): the rest of
       `e2e/events.test.ts` (time on two clocks, past midnight, `</script>` in a title, posting with a
       missing title, a wrong delete key, translations shown with the original, live seats, the last
       seat), `e2e/server.test.ts`, `e2e/pages.test.ts`, `e2e/islands.test.ts`, and `e2e/browsers/`.
       Plus one new test for finding 4, read through Void's own cache header, `x-isr-cache`: the
       events list and an event's page answer `HIT` from the cache, then after posting, booking and
       deleting the next fresh visit (no cookie) answers `MISS` with the change in it, and `HIT` again
       after. Each test is placed by what it needs; a test that could go either way stays on the
       preview, as Void's full contract does.
6. [ ] **Live tests are opt-in, and send nothing.** `test:production` runs the preview run's tests
       against the live site minus any that post (they'd call AI) or book (they'd email); those skip
       themselves there, with the reason in the test. CI's quick live check (finding 6) stays, as an
       exception written beside it: Cloudflare deploys every push to main, so this one post, translated
       and deleted at once, is the only check that a deploy works end to end; it emails no one.
7. [ ] **The layout and running above,** as one move: the files, the projects, the time limits,
       the tasks, the islands helper, and every reference.
8. [ ] **Docs.** Earlier plans that describe what this replaces say so where they describe it
       (`plans/quiet-harbor-atlas.md` step 7b: the `WORKERS_AI` flag and the hand-translation route).
       The README: the stage table (where pages, cache, email, AI, queues and crons go at
       each stage, and how each is checked), the test commands by stage, re-translating a post through
       `/__void/queue`, signing in first, and that dev and the preview run share the local database.
       SKILL.md: a short "testing a translated app" note (emails in dev through Void's inbox, in unit
       tests through Void's harness; queues and crons through Void's triggers) and the origin rule
       from 3. `DESIGN.md` is unaffected (the reminder is an email, not a page).

## How the tests are laid out and run (Void's `TESTING.md` and `vite.config.ts`)

Void's own repo (voidzero-dev/void, main, read 2026-11-13): unit tests in `test/unit/` with Vitest's
own time limits; builds, servers and browsers in integration projects with `testTimeout` and
`hookTimeout` of 120 seconds, the reason written beside them; projects named by kind; a named task
per kind, so you run only the part you need; live tests collected with the rest but skipped unless
their credentials are set; islands waited for all together, with the expected count.

### Where every file goes

| Now                                                                                                                                | After                                         | What it is                                                                                              |
| ---------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `packages/void-fbtee/test/*.test.ts`, `fixture/`, `void-init.ts`                                                                   | `packages/void-fbtee/test/unit/`              | the package's unit tests, as Void's `packages/*/test/unit/`                                             |
| `apps/example/src/**/*.test.ts`                                                                                                    | unchanged                                     | the example's unit tests beside their code (`guide/testing.md`: "next to the code they test in `src/`") |
| `e2e/setup.ts`, `e2e/server.test.ts`, `e2e/pages.test.ts`, `e2e/islands.test.ts`, and `e2e/events.test.ts` minus what moves to dev | `e2e/preview/`                                | the full browser contract on the production build                                                       |
| (new)                                                                                                                              | `e2e/dev/setup.ts`, `e2e/dev/*.test.ts`       | the dev-server suite: inbox, queues, crons, AI                                                          |
| `e2e/browsers/`                                                                                                                    | unchanged                                     | every page in each engine, on the production build                                                      |
| `e2e/deployed/`                                                                                                                    | unchanged                                     | the quick live check                                                                                    |
| `e2e/fresh/`                                                                                                                       | unchanged                                     | the package installed as a stranger installs it (Void's "prepublish test")                              |
| `e2e/helpers.ts`, `e2e/locales.ts`, `e2e/tsconfig.json`                                                                            | unchanged, plus the inbox and trigger helpers | shared by the e2e suites                                                                                |
| `e2e/deploy.ts`, `e2e/deployed.ts`, `e2e/production.ts`, `e2e/preview.ts`, `e2e/tailscale.ts`, `e2e/check-tools.mjs`               | `scripts/` (new, at the root)                 | the tasks' scripts, which aren't tests; `e2e/` then holds only tests and what they share                |
| `e2e/browsers/vite.config.ts`, `e2e/deployed/vite.config.ts`                                                                       | removed                                       | all projects in the root `vite.config.ts`, as Void has them                                             |

### Where every test goes, test by test

The rule: a test whose subject is an email, a queue, a cron or AI goes to `e2e/dev/`, where Void
gives those; every other test stays on the production build, even if it posts or books on the way
(there, Cloudflare's stand-in takes the email and sends nothing).

From `e2e/events.test.ts`:

| Test                                                                             | Goes to                      | Why                                                                                                        |
| -------------------------------------------------------------------------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------- |
| th-TH, in New York: Sydney's clock, the reader's, and how far off                | `e2e/preview/events.test.ts` | rendering times                                                                                            |
| a page left open past midnight: "tomorrow" becomes "today"                       | `e2e/preview/events.test.ts` | rendering times                                                                                            |
| an event named `</script>…`: its structured data holds the name                  | `e2e/preview/events.test.ts` | the page's head                                                                                            |
| ar-EG: post an event (a missing title first); saved neutral                      | `e2e/preview/events.test.ts` | the form and its stored values                                                                             |
| the poster deletes with the private link; a wrong key is refused                 | `e2e/preview/events.test.ts` | the link and the 403                                                                                       |
| the poster books their own event and keeps the link; deleting tells an open page | `e2e/dev/events.test.ts`     | its subject includes the cancellations: now also checks each booker's cancellation email in their language |
| an event written in Arabic, read in English                                      | `e2e/preview/events.test.ts` | stored translations shown                                                                                  |
| book in Thai; an Arabic page open on it sees the seat go, live                   | `e2e/preview/events.test.ts` | live seats                                                                                                 |
| two people book the last seat at once                                            | `e2e/preview/events.test.ts` | the one-statement booking and the 409                                                                      |

New in `e2e/dev/events.test.ts`: post with "email me my link" (the link email, its link on the dev
server opening the event with Delete); book a sample event in Thai (the confirmation in Thai, with
the stored Thai title); a new post's AI translation arriving live in Thai script.

New in `e2e/dev/jobs.test.ts`: the reminder cron through `/__void/scheduled` (a Thai and an Arabic
reminder, each linking to the dev server; none on a run for the next day); each queue through
`/__void/queue` (cancel acked with its email; translate for a waiting post acked with its
translations; translate for an event that's gone acked with nothing sent).

New in `e2e/preview/cache.test.ts`: posting, booking and deleting clear the cache, read through
`x-isr-cache`.

`e2e/server.test.ts` (15 tests: heads, redirects, headers, sitemap, icons, links, the middleware),
`e2e/pages.test.ts` (3) and `e2e/islands.test.ts` (1) move whole to `e2e/preview/`: none has email,
a queue, a cron or AI as its subject. `e2e/browsers/` (3 files) and `e2e/deployed/live.test.ts`
stay where they are.

### How they run

- **One at a time:** `test:dev` and `test:preview` share the local database (finding 8), and the
  preview run resets it and refuses to start while dev is up; `test:dev` uses the dev server's
  database as it is and deletes everything it posts. Run one, then the other.
- **Signed in first:** with AI on in dev and the preview (item 1), both runs need Void's Cloudflare
  sign-in (`vp run login`), as on a Mac and in a Claude session; CI runs neither (it runs
  `test:unit` and `test:deployed`).

- **Projects** in the root `vite.config.ts`: `unit` (the package), `preview`, `dev`, `browsers`,
  `deployed`. The example's unit tests stay in `apps/example` (`vp run example#test`): Void finds an
  app from where it runs.
- **Time limits:** `unit` keeps Vitest's own; `preview`, `dev`, `browsers` and `deployed` get
  `testTimeout` and `hookTimeout` of 120 seconds, Void's figure for builds, servers and browsers,
  with that reason beside it. Every `0` (no limit) goes, from the root config, both suite configs
  and `packages/void-fbtee/vite.config.ts`. A test that hangs then fails within two minutes and
  names its step, where CI's run on 2026-11-13 hung for over an hour.
- **`silent: "passed-only"`**, as Void: output only for what failed.
- **`deployed` skips itself without `E2E_URL`**, so a full `vp test run` collects it and skips it,
  as Void does with its live suite; `dev` starts its own dev server when none is running.
- **Tasks**, one per kind, the same on a Mac, in a Claude session and in CI:
  `test:unit` (`unit` and the example's), `test:preview`, `test:dev`, `test:browsers`,
  `test:deployed`, `test:production`, `test:fresh`. CI runs `vp check`, `vp run test:unit` and
  `vp run test:deployed`.
- **Islands:** the `hydrated()` helper waits for every island on the page, with the expected count,
  as Void's `waitForIslandsHydrated`; it waits for the first only today (`e2e/helpers.ts` line 86).
- **References follow the moves:** CI, the README, `AGENTS.md`, `e2e/tsconfig.json`, the tasks and
  every comment that names a moved file.

## Verification

`vp check`; `vp run example#test` (the reminder email in two languages too); `vp test run --project void-fbtee`; `vp run test:dev`, once
against a running dev server and once starting its own; the preview run's changed files, each on
its own (`e2e/browsers/` untouched, so not run); after a push, CI and the quick live check, and a
real booking email in the user's Gmail with a link to the live site.

## Not in this plan

The emails' design (parked by the user, 2026-11-13). Item 7 of `plans/sure-keeper-link.md`
(reproducing Void dropping the `#`).
