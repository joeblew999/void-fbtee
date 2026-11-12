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
vp run test:browsers     # every page in every language in Chromium, WebKit and WebKit as today's
                         # iPhones have it (no built-in Temporal): no errors, fits a phone; and
                         # the Intl and Temporal pages' engine checks. It grows with each
                         # language, so it's not in vp test run, whose tests use a fixed few
                         # languages (each for what it exercises); CI runs it
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
vp upgrade && vp migrate   # upgrade Vite+, then vp check, vp test run
```

## What's here

- `packages/void-fbtee`: the package.
- `apps/example`: a Void app using it, in three languages. Production:
  https://void-fbtee-example.gedw99.workers.dev
  ([its Worker on Cloudflare](https://dash.cloudflare.com/7384af54e33b8a54ff240371ea368440/workers/services/view/void-fbtee-example/production)).
- `e2e/`: the browser tests, and the fresh-install check. `e2e/browsers/`: the Chromium and
  WebKit run (`vp run test:browsers`).

How we test, and why it isn't Void's testing guide: Void's guide
([docs/guide/testing.md](https://github.com/voidzero-dev/void/blob/main/docs/guide/testing.md))
covers unit tests in Node, with bindings such as D1 and KV replaced by `vi.mock()`. Ours run the
real thing with nothing faked: the example's own build on Cloudflare's local runtime
(`vp test run`), or the deployed site (`vp run test:deployed`). Formatting can only be tested on
the Worker's own `Intl`, not Node's, which differs. `vp test run` needs a Cloudflare login (or
`CLOUDFLARE_API_TOKEN`), because the example's Workers AI runs on Cloudflare even locally. The
package's own tests (`packages/void-fbtee/test/`) are plain tests of its commands, in Node.

The tasks are in `vite.config.ts` and `apps/example/vite.config.ts`.

- `vp run test:production` tests the URL the last `vp run deploy` reported.
- `vp run --last-details` shows how the last task run went.
- Each commit is checked first (`vp check --fix`, a hook `vp install` sets up). CI runs
  `vp check`, the package's tests, then `vp run test:deployed`.

## Upgrading

- **Vite+:** `vp upgrade && vp migrate`, a day after a release (pnpm won't install
  anything newer). `vp migrate` itself, not through a `vp run` task: a task runs the project's own
  `vp`, the version being replaced (Vite+'s `docs/guide/upgrade-project.md`).
- **Void:** change `void`, `@void/md` and `@void/react` in `pnpm-workspace.yaml`'s catalog, then
  `vp install` and `vp run check:tools`, which shows what the new Void wants.
- **Node:** change `.node-version`.

Then `vp check`, `vp test run` and `vp run test:fresh`.

## Releasing

Raise `version` in `packages/void-fbtee/package.json`, and the tag in the install line of
`packages/void-fbtee/README.md`, and push to main. When CI passes, it tags
`v<version>` and makes the GitHub release.

## License

MIT
