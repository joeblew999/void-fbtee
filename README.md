# void-fbtee

**Production:** https://void-fbtee-example.gedw99.workers.dev

i18n for [Void](https://void.cloud) apps: strings translated with
[fbtee](https://github.com/nkzw-tech/fbtee), dates and times with Temporal, numbers and lists with
the browser's own `Intl`.

How to add it to a Void app and use it: [packages/void-fbtee/README.md](packages/void-fbtee/README.md).
This README is for working on the repo.

## Commands

All from the repo root.

Once per machine:

```sh
curl -fsSL https://vite.plus | bash   # Vite+'s vp; open a new terminal after it
vp env on                             # the Node in .node-version for everything, package scripts
                                      # included, ahead of any other Node on the machine (Void
                                      # needs Node 24.22+; without this, vp install fails where an
                                      # older Node comes first, as in a Claude cloud session)
vp install                            # dependencies; Void generates its types and links its
                                      # skills for coding agents
vp run install:browser                # Chromium and WebKit (Safari's engine) for the tests
vp run login                          # Cloudflare sign-in (Void's void connect), for vp run dev
                                      # and deploys from this machine
```

On GitHub, Cloudflare's Workers Builds does the deploying: a push to `main` runs `vp run deploy` on
Cloudflare (production), and a push to any other branch runs `vp run build:preview` and
`npx cf previews deploy` (a Worker Preview at `<branch>-void-fbtee-example.gedw99.workers.dev`, deleted
with its branch). CI then runs a quick check of what was deployed (`vp run test:deployed`). GitHub holds no Cloudflare
credential. Build logs: the Worker's Builds in Cloudflare's dashboard, linked from each commit's
"Workers Builds" check.

Every day:

```sh
vp run login             # once: Void's Cloudflare sign-in, which dev and the preview need for
                         # Workers AI (Void has no local stand-in for it)
vp run dev               # develop: the package rebuilds on save; the example runs with Void's
                         # local D1, KV, queues, live updates, email inbox and Workers AI.
                         # It prints its email inbox's address when it starts
vp check                 # format, lint, types
vp run test:unit         # unit tests: the package's and the example's (seconds)
vp run test:dev          # the dev-server suite: emails, queues, the cron and AI (see Testing)
vp run test:preview      # the browser suite on the production build (see Testing)
vp run deploy            # deploy the example to production (Cloudflare), with no downtime:
                         # Void uploads the new version, checks it's ready, then moves
                         # traffic to it. It creates what's missing (D1 with read replicas,
                         # KV, the queue, the live-updates Durable Object), and applies new
                         # migrations after saving a restore point; it stops if the schema
                         # changed with no migration. It renders the cached pages (the Docs)
                         # again before traffic moves, so no one gets an old page.
                         # Log: ~/.void/logs/
vp run test:production   # the preview suite against the live site, less what posts or books
vp run deploy:preview    # this branch as a Worker Preview beside production (needs cf's login)
vp run test:deployed     # a quick check of what Cloudflare deployed for this commit: sitemap,
                         # a Thai not-found page, one event posted, translated by Workers AI
                         # and deleted (what CI runs; CLOUDFLARE_WORKERS_SUBDOMAIN=gedw99)
vp run test:browsers     # every page in every language in Chromium, WebKit and WebKit as today's
                         # iPhones have it (no built-in Temporal): no errors, fits a phone; and
                         # the Intl and Temporal pages' engine checks. It grows with each
                         # language, so it's its own run, not in CI: run it when pages change
```

In a Claude cloud session, to open the dev server in your own browser without deploying:

```sh
vp run dev                # in one terminal: the dev server, on http://localhost:5173
vp run tailscale:login    # in another: puts it on a public https://void-fbtee-<machine>.<tailnet>.ts.net
                          # address through Tailscale Funnel. Prints a Tailscale sign-in link and
                          # waits for it. Tailscale is downloaded into .tailscale/ (Linux only)
vp run tailscale:logout   # takes it off again; remove the machine at
                          # https://login.tailscale.com/admin/machines
```

On a Mac, just open http://localhost:5173.

Translations (from `apps/example`):

```sh
vp run i18n:translate    # translate what's new or changed
vp run i18n:check        # anything missing or out of date
```

Production (Void's own commands):

```sh
vp run status            # what's deployed now
vp run logs              # its logs, live
vp run rollback          # back to an earlier version (check it works with today's schema)
```

Now and then:

```sh
vp run deploy:atomic     # only when Void's deploy asks for it (a Durable Object changed)
vp run test:fresh        # after changing the package or its dependencies
vp upgrade && vp migrate   # upgrade Vite+, then vp check and the tests (Testing)
```

## What's here

- `packages/void-fbtee`: the package.
- `apps/example`: a Void app using it, in three languages. Production:
  https://void-fbtee-example.gedw99.workers.dev
  ([its Worker on Cloudflare](https://dash.cloudflare.com/7384af54e33b8a54ff240371ea368440/workers/services/view/void-fbtee-example/production)).
- `e2e/`: the end-to-end tests, by stage (see Testing): `e2e/preview/`, `e2e/dev/`,
  `e2e/browsers/`, `e2e/deployed/`, and `e2e/fresh/` (the fresh-install check; `e2e/fresh/app/`
  holds Void's own docs examples, put into each fresh app and checked in Thai, with what doesn't
  work yet listed as a known gap and the step of `plans/quiet-harbor-atlas.md` that fixes it).
  `e2e/helpers.ts` is what they share.
- `scripts/`: the scripts behind the tasks (deploying, the deployed checks, Worker Previews,
  Tailscale, the tools check).

## Testing

Each test runs on the stage Void gives what it checks, and checks through what Void provides
there (Void's docs in `apps/example/node_modules/void/docs/` and its own `TESTING.md`). Nothing is faked: the tests use the real runtime, Void's own hooks and
Cloudflare's local stand-ins.

| Stage (task)                      | Where it runs                                        | Email                                                                          | Workers AI                | Queues and the cron                                                                                              | Page cache                         |
| --------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------- | ---------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| `test:unit`                       | Node                                                 | Void's harness (`void/email/testing`) checks each email's wording and language | none                      | none                                                                                                             | none                               |
| `test:dev` (`e2e/dev/`)           | the dev server: yours if running, else it starts one | Void's dev inbox, read back with its token                                     | real, through the sign-in | Void's triggers: `POST /__void/queue` (each message's ack checked), `POST /__void/scheduled` (the reminder cron) | none in dev                        |
| `test:preview` (`e2e/preview/`)   | the production build, local                          | Cloudflare's stand-in saves it and sends nothing                               | doesn't run (see below)   | queues run                                                                                                       | Void's, read through `x-isr-cache` |
| `test:browsers` (`e2e/browsers/`) | the production build, in Chromium and WebKit         | as preview                                                                     | as preview                | as preview                                                                                                       | as preview                         |
| `test:deployed` (`e2e/deployed/`) | the live site, after each push                       | sends none                                                                     | real                      | Cloudflare's                                                                                                     | Cloudflare's                       |
| `test:fresh` (`e2e/fresh/`)       | new `void init` apps                                 | —                                                                              | —                         | the cron through `/__void/scheduled`                                                                             | —                                  |

- **Dev and the preview, one at a time:** they share the local database (Void's
  `guide/database/d1.md`), which the preview run resets and refuses to touch while dev is up.
  `test:dev` uses your dev server's database as it is and deletes everything it posts.
- **Workers AI in dev and the preview:** both send it to Cloudflare through Void's sign-in
  (`vp run login`). Void marks the AI binding remote by itself only in dev, so
  `apps/example/void.config.ts` sets `ai: { binding: "AI", remote: true }` in `cloudflare`; without
  it the preview fails with "Binding AI needs to be run remotely".
- **`Vary: Origin` on the preview:** Vite's local preview server adds it to any response without a
  Vary of its own (its CORS); the live site sends none. `e2e/preview/server.test.ts` leaves it out
  on the preview only.
- **Live tests are opt-in** (Void's rule): `test:production` skips what posts or books there,
  and `test:deployed`, the exception CI runs, posts one event, has it translated and deletes it,
  emailing no one.
- **Time limits, Void's:** unit tests keep Vitest's own; the others 120 seconds per test and per
  hook, and Playwright's own 30 seconds per wait, so a step that never happens fails and names
  itself. A failing browser test prints what its pages did (console, errors, navigations, failed
  requests).
- **Emails from dev** link to the dev server; from the live site, to the live site: each email
  links to where it was sent from.
- **Re-translating a post in dev:** run the translate queue on it with Void's trigger, using the
  token dev prints at the start (also in `apps/example/.void/dev-trigger-token`):
  `curl -X POST http://localhost:5173/__void/queue -H "Content-Type: application/json" -H "x-void-dev-trigger: $(cat apps/example/.void/dev-trigger-token)" -d '{"queue":"translate","messages":[{"id":"1","timestamp":0,"body":{"eventId":"<the event's id>"},"attempts":1}]}'`

The tasks are in `vite.config.ts` and `apps/example/vite.config.ts`.

- `vp run test:production` tests the URL the last `vp run deploy` reported.
- `vp run --last-details` shows how the last task run went.
- Each commit is checked first (`vp check --fix`, a hook `vp install` sets up). CI runs
  `vp check`, `vp run test:unit`, then `vp run test:deployed`.

### Checking the live site by hand

Two checks only a person can run: each reads one live page the way its owner's crawler does. Paste
in a page's address, e.g. an event's (from https://void-fbtee-example.gedw99.workers.dev/en-US/events)
or a language's home page (https://void-fbtee-example.gedw99.workers.dev/th-TH).

- **Google's Rich Results Test**, https://search.google.com/test/rich-results: the structured data
  (the site on each home page, the event on each event page) and whether Google could show it as a
  rich result. No sign-in.
- **Facebook's Sharing Debugger**, https://developers.facebook.com/tools/debug/: the link preview
  (picture, title, description) as Facebook builds it. Needs a Facebook sign-in. "Scrape Again"
  makes Facebook read the page afresh, after the picture or a title changes. It covers Instagram,
  Messenger and WhatsApp too: they use the same crawler and the same tags (links in Instagram
  captions never show a preview; DMs and Story links do).

Run them after a change to the head tags or the picture.

## Upgrading

- **Vite+:** `vp upgrade && vp migrate`, a day after a release (pnpm won't install
  anything newer). `vp migrate` itself, not through a `vp run` task: a task runs the project's own
  `vp`, the version being replaced (Vite+'s `docs/guide/upgrade-project.md`).
- **Void:** change `void`, `@void/md` and `@void/react` in `pnpm-workspace.yaml`'s catalog, then
  `vp install` and `vp run check:tools`, which shows what the new Void wants.
- **Node:** change `.node-version`.

Then `vp check`, `vp run test:unit`, `vp run test:dev`, `vp run test:preview` and `vp run test:fresh`.

## Reported to Void

Problems in Void that this repo works around. After upgrading Void, check whether each is fixed,
and if so remove what depends on it.

- [voidzero-dev/void#802](https://github.com/voidzero-dev/void/issues/802) (2026-11-12, Void
  1.8.0): `@void/md` in right-to-left and translated pages. Heading anchors and the copy button
  are placed with physical `left`/`right`; the copy button's label is fixed in English
  ("Copy Code"); task lists come out as text. What depends on it: the heading-anchor rule at the
  end of `apps/example/pages/style.css` (remove it when fixed), and the tour's numbered "Try it"
  list and the note in `e2e/preview/server.test.ts` (a task list, and checks for it, when they work).

## Releasing

Raise `version` in `packages/void-fbtee/package.json`, and the tag in the install line of
`packages/void-fbtee/README.md`, and push to main. When CI passes, it tags
`v<version>` and makes the GitHub release.

## License

MIT
