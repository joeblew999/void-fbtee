# void-fbtee

i18n for [Void](https://void.cloud) apps: translated strings with [fbtee](https://github.com/nkzw-tech/fbtee), dates and times with Temporal, and numbers, lists and relative time from the browser's own `Intl`. It also has a built-in AI translation step.

It works the Void way: a Vite plugin, a Void middleware and a layout provider. It runs on Vite+ and on plain Vite, with islands and markdown pages too.

## Add it to a Void app

It isn't on npm. An app installs a release straight from this GitHub repo, with pnpm. The
releases are listed at https://github.com/joeblew999/void-fbtee/releases.

In the app's `package.json` (with the release you want):

```json
"dependencies": {
  "void-fbtee": "github:joeblew999/void-fbtee#v0.1.0&path:/packages/void-fbtee"
}
```

In the app's `pnpm-workspace.yaml` (pnpm only builds a git dependency you allow):

```yaml
allowBuilds:
  "void-fbtee@git+https://github.com/joeblew999/void-fbtee.git": true
```

Then (in a Vite+ app, `vp` in place of `pnpm`):

```sh
pnpm install
pnpm exec void-fbtee init --locales ar-EG,th-TH
pnpm install
pnpm run i18n:translate
```

`init` wires everything in and only adds what's missing. `void-fbtee --help` lists the commands.

## This repo

- `packages/void-fbtee`: the package
- `apps/example`: a Void app using it, in three languages, in production at https://void-fbtee-example.gedw99.workers.dev
- `e2e/`: the browser tests and the fresh-install check

It runs on [Vite+](https://viteplus.dev). Install its `vp` once per machine
(`curl -fsSL https://vite.plus | bash`, or [Homebrew](https://viteplus.dev/guide/homebrew)); it
runs the project's own Vite+ version (`vite-plus` in `package.json`), the Node in `.node-version`
and the pnpm in `package.json`. Then:

```sh
vp install
vp run install:browser   # Chromium for the browser tests, once
vp check                 # format, lint, types
vp test run              # every test
```

CI runs those same commands, and `vp run check:tools` (below); the fresh-install check runs
when the package, the manifests or the versions change (`.github/workflows/fresh.yml`). The repo's tasks are in
`vite.config.ts` and `apps/example/vite.config.ts`; `vp run` lists them. Changes to the package
reach the example by themselves: `vp run dev` rebuilds the package on save, and the example's
build (`vp run -t example#build`) and `vp run deploy` build it first. Each commit is checked first
(`vp staged`, a Vite+ commit hook that `vp install` sets up).

To deploy the example to Cloudflare, `vp run deploy`. Once per machine, `vp run login` first: it
signs you in to Cloudflare and points the project at your account (Void's `void connect`), which
deploys and Void's remote database commands (`void db execute --remote`) use. When a change adds
or changes a Durable Object class, Void stops and asks for an atomic deploy: `vp run
deploy:atomic`. Deploying applies new database migrations; Void saves a restore point first and
prints the command to go back. Then:

- the site: https://void-fbtee-example.gedw99.workers.dev
- the Worker in the Cloudflare dashboard (deployments, logs, settings):
  https://dash.cloudflare.com/7384af54e33b8a54ff240371ea368440/workers/services/view/void-fbtee-example/production

In a Claude cloud session, `.claude/hooks/cloud-session.sh` installs `vp` and starts a
keyring for the sign-in, so Claude runs the same commands. A new session needs one sign-in: Claude runs
`vp run login` (inside `script`, as Void's sign-in wants a terminal), which prints Cloudflare's link, and you click Allow.

## Tools that set this repo up

Vite+, Void and void-fbtee each write setup into the repo, and own those parts:

- **Vite+** (`vp migrate`, `vp config`): the version pins in `pnpm-workspace.yaml`'s catalog, the
  Vite+ section of `AGENTS.md`, and the commit hook (`.vite-hooks/pre-commit`).
- **Void** (`void init`): the example's `build` script, its `tsconfig.json` entries, Void's section
  of `apps/example/AGENTS.md`, and its skills for Claude Code.
- **void-fbtee** (`void-fbtee init`): the example's `i18n:*` scripts, void-fbtee's section of
  `apps/example/AGENTS.md`, and its skill.

`vp run check:tools` runs them all again and fails if any of them changes a file, so a new release
that wants something different shows what it wants.

## Upgrading

- **Vite+:** `vp upgrade` (the global `vp`), then `vp run upgrade:vite-plus` (Vite+'s `vp migrate`:
  moves the project to that version). pnpm won't install a release less than a day old, so upgrade
  a day after it comes out.
- **Void:** change `void`, `@void/md` and `@void/react` in the catalog in `pnpm-workspace.yaml`,
  then `vp install`. Run `vp run check:tools` to see what the new Void wants, and `void init` in
  `apps/example` (it asks about the database: D1) to refresh its section of `AGENTS.md`.
- **Node:** change `.node-version`; `vp` uses it from the next command.

Then `vp check`, `vp test run` and `vp run test:fresh`.

## Releasing

Raise `version` in `packages/void-fbtee/package.json` and push to main. Once CI passes, it tags
`v<version>` and makes the GitHub release.

## License

MIT
