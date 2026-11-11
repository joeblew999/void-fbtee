# void-fbtee

**Production:** https://void-fbtee-example.gedw99.workers.dev

i18n for [Void](https://void.cloud) apps: strings translated with
[fbtee](https://github.com/nkzw-tech/fbtee), dates and times with Temporal, numbers and lists with
the browser's own `Intl`.

The rule it follows is the one for dates in a database: data stays neutral (UTC instants with zone
names, plain numbers with currency codes), both to the browser and back, and is formatted once,
for the screen. The server formats a page's text and the browser keeps it (`<Formatted>`), because
each browser engine ships its own locale data and writes some values differently. The browser
formats only what the server can't know, such as the reader's own time zone.

## Commands

All from the repo root.

Once per machine:

```sh
curl -fsSL https://vite.plus | bash   # Vite+'s vp; it runs the Node in .node-version
vp install                            # dependencies; Void generates its types and links its
                                      # skills for coding agents
vp run install:browser                # Chromium and WebKit (Safari's engine) for the tests
vp run login                          # Cloudflare sign-in (Void's void connect), for vp run dev
                                      # and deploys from this machine
```

On GitHub, Cloudflare's Workers Builds does the deploying: a push to `main` runs `vp run deploy` on
Cloudflare (production), and a push to any other branch runs `vp run build:preview` and
`npx cf previews deploy` (a Worker Preview at `<branch>-void-fbtee-example.gedw99.workers.dev`, deleted
with its branch). CI then tests what was deployed (`vp run test:deployed`). GitHub holds no Cloudflare
credential. Build logs: the Worker's Builds in Cloudflare's dashboard, linked from each commit's
"Workers Builds" check.

Every day:

```sh
vp run dev               # develop: the package rebuilds on save; the example runs with Void's
                         # local D1, KV, queue and live updates (Workers AI is Cloudflare's)
vp check                 # format, lint, types
vp test run              # every test, on a local build; report: .vitest/index.html
vp run deploy            # deploy the example to production (Cloudflare), with no downtime:
                         # Void uploads the new version, checks it's ready, then moves
                         # traffic to it. It creates what's missing (D1 with read replicas,
                         # KV, the queue, the live-updates Durable Object), and applies new
                         # migrations after saving a restore point; it stops if the schema
                         # changed with no migration. It renders the cached pages (the Docs)
                         # again before traffic moves, so no one gets an old page.
                         # Log: ~/.void/logs/
vp run test:production   # every test, against production; report: .vitest/index.html
vp run deploy:preview    # this branch as a Worker Preview beside production (needs cf's login)
vp run test:deployed     # every test against what Cloudflare deployed for this commit, then
                         # test:browsers (what CI runs; CLOUDFLARE_WORKERS_SUBDOMAIN=gedw99)
vp run test:browsers     # every page in every language in Chromium and WebKit, and the Formats and
                         # Temporal pages' engine checks: slow, so not in vp test run; CI runs it
```

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
vp upgrade && vp run upgrade:vite-plus   # upgrade Vite+, then vp check, vp test run
```

## What's here

- `packages/void-fbtee`: the package.
- `apps/example`: a Void app using it, in three languages. Production:
  https://void-fbtee-example.gedw99.workers.dev
  ([its Worker on Cloudflare](https://dash.cloudflare.com/7384af54e33b8a54ff240371ea368440/workers/services/view/void-fbtee-example/production)).
- `e2e/`: the browser tests, and the fresh-install check. `e2e/browsers/`: the Chromium and
  WebKit run (`vp run test:browsers`).

The tasks are in `vite.config.ts` and `apps/example/vite.config.ts`.

- `vp run test:production` tests the URL the last `vp run deploy` reported.
- `vp run --last-details` shows how the last task run went.
- Each commit is checked first (`vp check --fix`, a hook `vp install` sets up). CI runs
  `vp check`, the package's tests, then `vp run test:deployed`.

## Add it to a Void app

It isn't on npm: an app installs a [release](https://github.com/joeblew999/void-fbtee/releases)
from this repo. In the app's `package.json`:

```json
"dependencies": {
  "void-fbtee": "github:joeblew999/void-fbtee#v0.1.0&path:/packages/void-fbtee"
}
```

In its `pnpm-workspace.yaml` (pnpm only builds a git dependency you allow):

```yaml
allowBuilds:
  "void-fbtee@git+https://github.com/joeblew999/void-fbtee.git": true
```

Then:

```sh
vp install
vp exec void-fbtee init --locales ar-EG,th-TH
vp install
vp run i18n:translate
```

`init` adds only what's missing. `void-fbtee --help` lists its commands.

## Upgrading

- **Vite+:** `vp upgrade && vp run upgrade:vite-plus`, a day after a release (pnpm won't install
  anything newer).
- **Void:** change `void`, `@void/md` and `@void/react` in `pnpm-workspace.yaml`'s catalog, then
  `vp install` and `vp run check:tools`, which shows what the new Void wants.
- **Node:** change `.node-version`.

Then `vp check`, `vp test run` and `vp run test:fresh`.

## Releasing

Raise `version` in `packages/void-fbtee/package.json` and push to main. When CI passes, it tags
`v<version>` and makes the GitHub release.

## License

MIT
