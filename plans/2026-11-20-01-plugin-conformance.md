# 2026-11-20-01-plugin-conformance.md

Make void-fbtee a proper Vite plugin and a proper Void add-on, ready to publish (not published).

Status: draft, waiting for Gerard's OK. Written 2026-11-20, against commit `854cbdb`.

## What was checked

void-fbtee's plugin (`packages/void-fbtee/src/dev/plugin.ts`) and package (`packages/void-fbtee/package.json`)
were checked against these, each read or run on 2026-11-20:

- Vite Plugin API — https://vite.dev/guide/api-plugin
- Vite Environment API for plugins — https://vite.dev/guide/api-environment-plugins
- Vite plugins page — https://vite.dev/plugins/
- Vite performance guide — https://vite.dev/guide/performance
- Vite Plugin Registry guide (discovery, compatibility, extended metadata, badges) — https://registry.vite.dev/guide/
- Rolldown plugin conventions — https://rolldown.rs/apis/plugin-api
- Rollup plugin conventions — https://github.com/rollup/rollup (docs/05-plugin-development.md)
- Awesome Vite contributing rules — https://github.com/vitejs/awesome-vite (`.github/contributing.md`, commit `ec6b41d`)
- Void's own add-ons `@void/md` and `@void/react` — https://github.com/voidzero-dev/void (`packages/md`, `packages/react`, commit `895b1d0`)
- Vite's source for path and restart behaviour — https://github.com/vitejs/vite (`packages/vite/src/node`, commit `c732677`)
- Vite+ 1.6.0's monorepo template (`templates/monorepo` in the `vite-plus` package)
- `vp pack` (publint, Are the Types Wrong?, unused) and `npm pack --dry-run`, run on the package

## What was found, and how it was shown

| #   | Finding                                                                                                                                                                                                                                                                                                                                                                                 | How it was shown                                                                                                                                                           |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | After Vite closes the dev server (every restart), void-fbtee's timers still fire: it rewrote both catalogs 156 ms after close and moved on to translating (outside CI that starts a Claude agent). No `closeServer` hook.                                                                                                                                                               | Ran a real dev server on the plugin's test fixture, saved a new string, closed the server.                                                                                 |
| 2   | The translations-folder checks in `watchChange` compare `join(root, translationsDir)` (backslashes on Windows) with Vite's forward-slash paths, so on Windows a catalog added or removed is never noticed.                                                                                                                                                                              | Vite source: `config.ts:1663` and `server/index.ts:1016` normalise; Node's `path.win32.join` gives `C:\Users\dev\app\i18n`, and `startsWith` is false. Not run on Windows. |
| 3   | Plain Rolldown 1.2.18 and Rollup 4.68.7 build an app with void-fbtee without error, but skip its build check (untranslated strings, missing setup), which Vite correctly stops on. The check depends on `configResolved`, a Vite-only hook.                                                                                                                                             | Built the same entry three ways: Vite failed with "8 to fix", Rolldown and Rollup built.                                                                                   |
| 4   | A Markdown page saved in place (emptied, then written) is read empty in `watchChange`, and no second event follows, so a page the agent marked done is never stamped.                                                                                                                                                                                                                   | 30 saves each way with a dev server: one write and atomic rename read the full file 30/30; truncate-then-write read it empty 30/30, with one event per save.               |
| 5   | The registry can't tell what void-fbtee works with: no `compatiblePackages`, so Rollup and Rolldown show "unknown".                                                                                                                                                                                                                                                                     | Registry guide; `package.json`.                                                                                                                                            |
| 6   | Nothing can publish it: CI has `ci.yml` and `fresh.yml`, no release.                                                                                                                                                                                                                                                                                                                    | `.github/workflows/`.                                                                                                                                                      |
| 7   | The layout doesn't match Void's add-ons, though the README says it's built the way they are: plugin in `src/dev/plugin.ts` (Void: `src/plugin.ts`); build-time code in `src/dev/` and runtime loose in `src/` (Void: runtime in `src/runtime/`); tests only in `test/unit/`, fixture inside it, loose `test/*.json` (Void: `test/unit/`, `test/integration/`, `test/fixtures/<name>/`). | `packages/md`, `packages/react` in voidzero-dev/void.                                                                                                                      |

Checked and fine: factory function, `name`, `virtual:` and `\0` ids, hook filters, `enforce`, `this.environment` (no `ssr`),
`configEnvironment`, no `config.build`, `vite-plugin` keyword, `vite` peer, README says why it's Vite-only,
source maps (`map: null` on an append that moves nothing), no custom HMR events, kebab-case files, `voidFbtee` /
`void-fbtee` naming like Void's, `apps/` + `packages/` like Vite+'s template, `e2e/` at the root,
publint and Are the Types Wrong? clean, tarball holds only `dist/` and `skills/`, the npm name is free.
Measured: loading the plugin ~123 ms (the same as Vite alone, which it imports); on the example app (125 source files)
`configureServer` 60–73 ms, `configResolved` 59 ms and `buildStart` 220 ms in a build — none long by the performance guide.

What had to be worked around to run the checks (none of it the plugin):

- the sandbox had Node 22; the repo pins 24.22.2 (`.node-version`), fetched for the run;
- `vp pack` typed in the shell used the global Vite+ and missed the repo's `unplugin-unused`; the package's own
  scripts use the repo's `vp` and work;
- the example app's dev server needs a Cloudflare login (Void runs its AI and browser bindings remotely), so the
  startup timing loaded only void-fbtee's plugins on the example app;
- plain Rollup and Rolldown were installed only to show the plugin doesn't work under them.

Kept as it is, on purpose:

- Name stays `void-fbtee`, not `vite-plugin-…`: it's a Void add-on (plugin plus middleware, routes, React, server),
  named as Void's own are; the registry finds plugins by keyword, which it has.
- `devServer.ws.send({ type: "full-reload" })` stays: still valid; `environment.hot` is only the newer route.
- 10 synchronous file calls in `plugin.ts` stay: the hooks are quick (above).

## The change (one change, on main)

1. **`closeServer` hook** in the plugin: clears `prepareTimer` and `translateTimer`, stops a running translation agent,
   forgets the dev server. Vite+ core 1.6.0 has the hook (`closeServer?: ObjectHook<CloseServerHook>`).
2. **`normalizePath`** (from `vite`) on the translations folder before the `startsWith` checks in `watchChange`.
   Vite's documented fix; it will not be run on Windows.
3. **Stop outside Vite**: in `buildStart`, when `configResolved` never ran, fail with
   "void-fbtee is a Vite plugin for Void apps; it can't run under plain Rollup or Rolldown".
4. **Saved pages read with `read()`**: move the "marked done" read from `watchChange` to `hotUpdate`, whose `read()`
   waits for the write to finish. Kept only if the save script shows truncate-then-write read in full 30/30.
5. **Registry metadata** in `package.json`: `$schema`, and `compatiblePackages` — `vite` compatible `^8.0.0`
   (note: Void apps only), `rollup` and `rolldown` incompatible (reason: Vite-only hooks).
6. **Publishing to npm, on the release path that's already there.** As built: CI's `release` job already tags
   `v<version>` and makes the GitHub release when `version` is new, so a `publish` job follows it in
   `.github/workflows/ci.yml` rather than a new workflow: `pnpm publish --provenance` with npm's trusted publishing
   (OIDC, `id-token: write`, no token stored), only when npm hasn't got that version, and only once the repository
   variable `NPM_PUBLISH` is `true` (off now). pnpm, not npm: pnpm applies `publishConfig`, and does trusted
   publishing itself (pnpm 11 and later; the repo's is 12.18.0). Settled 2026-11-20: npm can only trust a workflow for
   a package that exists (npm's trusted-publishers docs and `npm trust`'s "Package must exist"), so the first version
   goes up by hand from the Mac; the README's "Releasing" has the four commands. `void-fbtee` was free on npm
   (registry 404). `pnpm publish --dry-run` packs it, publint and Are the Types Wrong? clean.
7. **Dropped while building:** apps would see nothing of it (the exports stay the same), and it moves every file
   for no change in what the package does. Was: **Layout like Void's add-ons**: `src/dev/plugin.ts` → `src/plugin.ts`, build-time helpers beside it, runtime code
   into `src/runtime/`; tests into `test/unit/`, `test/integration/` (the ones that run real Vite builds or servers)
   and `test/fixtures/<name>/`. `package.json` exports stay exactly the same (`void-fbtee/plugin`, `/server`,
   `/react` …), so apps don't change. README's layout notes updated.
8. **An option for translating as you work**, covering both translators: `voidFbtee({ translate: false })` for
   neither, or `{ translate: { gemini: false } }` / `{ translate: { claude: false } }` for one. Today the plugin
   decides only from `process.env.CI` and whether Vitest is loaded (`agentAllowed` in `plugin.ts`); the proofs had to
   set `CI=1` to stop it starting a Claude agent. The default is today's behaviour. README documents it.
9. **A clear error when `fbtee` is missing**: an app without the `fbtee` peer crashed the dev server with
   `Cannot find module 'fbtee/Strings.json'` (seen running the fixture outside the package). Say instead that
   void-fbtee needs `fbtee` installed in the app, and stop.

10. **Vite DevTools panel** (Vite DevTools Kit, https://devtools.vite.dev/kit/, checked 2026-11-20; DevTools 0.8.x,
    pre-1.0): a `devtools.setup(ctx)` hook on the plugin, called only when the app turns DevTools on
    (`@vitejs/devtools` installed, `devtools: true`). `@vitejs/devtools-kit` becomes an optional peer, loaded only
    inside `setup`, so apps without DevTools install nothing extra. It registers:
    - a **void-fbtee dock** (an iframe page void-fbtee ships in `dist/`, hosted with `ctx.views.hostStatic`): each
      language's translated / untranslated / waiting-review counts and catalog size; the same problems list a build
      fails on (`check`), live; translated pages and whether their original moved on; the agent's state (running,
      idle, or off and why: option, CI, `claude` not signed in);
    - **RPC**: a `void-fbtee:status` query, and a broadcast whenever a save, prepare or translation changes it;
    - **commands** in the palette: prepare now, translate now, check;
    - the agent's `claude -p` output as a **DevTools terminal**, instead of only the dev server's console;
    - a **message** when something would stop the build.
      Shown working by running it in the example app (`devtools: true`), and opened for Gerard to see.
    - **As built** (`src/dev/devtools.ts`): the dock is a json-render panel (`ctx.createJsonRenderer`, DevTools'
      own components), not an iframe page in `dist/`, so the package ships no extra page. The kit is a dev dependency
      for its types only (its functions are plain objects at run time); `@vitejs/devtools` is the optional peer. The
      example turns it on for the dev server only (`devtools: { apply: "serve" }`): `true` also runs it in builds,
      whose output Void deploys. The docs' component props have drifted from the installed schemas
      (`@devframes/json-render` 1.3.6); the installed ones are used. Shown in headless Chromium: the panel's counts,
      the Check button running on the server, the log terminal; the example's build has no DevTools in it.
11. **Rolldown's three built-in plugins** (https://rolldown.rs/builtin-plugins/, checked 2026-11-20) — shown already
    working with void-fbtee; recorded in the README, nothing to change in the plugin. On the fresh `void init` app
    (Rolldown 1.2.18), the build passed with all three on:
    - `replacePlugin` reached a page void-fbtee transforms (the value was in the Worker and browser bundles);
    - `esmExternalRequirePlugin`: nothing to convert — void-fbtee's runtime code (everything a Worker or browser
      loads) has no `require`; only the build-time plugin and CLI do;
    - `bundleAnalyzerPlugin` lists void-fbtee's modules, one catalog per language
      (`virtual:void-fbtee/catalog/th-TH` …), which is what the DevTools panel's catalog sizes need in a build.
12. **What a developer needs, stated once** in the README (a "Requirements" section, plain words): Node 24.22+;
    Void, Vite or Vite+, React, fbtee and temporal-polyfill at the peer ranges in `package.json`; Cloudflare's
    `temporal` flag (`void-fbtee init` writes it). Translating as you work (`vp dev`) has two translators, either or
    both: Gemini (`google/gemini-4-hydrogen`, `src/models.ts`) through Void's AI, which needs a Cloudflare login and
    an app that uses `void/ai`; and Claude Code signed in on the machine, which translates what's left and reviews
    what Gemini wrote. With neither, strings can only be translated by hand, and `vp build` stops until they are.
    The proof of what a new developer needs is `e2e/fresh` (item 18).
13. **The build's stop names the ways forward**: when strings are untranslated, the error says which files, and the
    three ways to fill them (Gemini through Void's AI, Claude Code, by hand). The build stays strict.
14. **`void-fbtee init` says up front what will translate** on this machine: Claude Code signed in or not, a
    Cloudflare login or not, the app using `void/ai` or not — so a developer learns it at setup, not at a failed build.
15. **`void-fbtee init` runs the install itself** with the app's own package manager; today a developer has to
    install again after it (`e2e/fresh/check.ts`, lines 262–267).
16. **React only, said plainly**: `init` stops with a clear message in a Void app on Vue, Svelte or Solid (fbtee is
    React-based); the README and the registry note say React only.
17. **The `fbtee` pin: `fbtee` peer `6.0.0` → `^6.0.0`, and everything fbtee moved to 6.0.1.** Researched 2026-11-20:
    - **The pin already breaks a new developer.** fbtee 6.0.1 came out 2026-11-19 (npm), all five fbtee packages the
      same day. In an app that already has fbtee 6.0.1, `npm install` of void-fbtee 0.7.0 stops:
      `ERESOLVE … peer fbtee@"6.0.0" from void-fbtee@0.7.0`. pnpm 12.18.0 installs, with `✕ unmet peer fbtee`.
      And `init` writes the exact tested version (`"fbtee": "6.0.0"`, `testedVersions()` in `src/dev/init.ts`) and
      only for packages the app doesn't already have.
    - **Why it was exact: no reason found.** No commit, README or plan gives one (`git log -S`; `plans/fbtee-issues.md`
      only records that it was checked against 6.0.0). Nothing in void-fbtee checks fbtee's version.
    - **void-fbtee uses only fbtee's public API**: `fbt`, `fbs`, `setupLocaleContext`, `runWithFbtee`
      (`fbtee/server`), types, `fbtee/Strings.json` and `fbtee/ReactTypes` — all in fbtee's `exports` at 6.0.0 and 6.0.1.
      What 6.0.1 removed (`Context` in `createLocaleContext.tsx`) isn't used. 6.0.0 → 6.0.1 (nkzw-tech/fbtee
      `v6.0.0..v6.0.1`): typing tidy-ups in the runtime, dependency updates, and the compiler's `--version` now
      printing the package version (commits `16efaf5`, `4c37fb4`).
    - **Shown working**: with every fbtee package at 6.0.1 — unit tests (198 + 17), `vp pack` (publint, Are the Types
      Wrong?), the example's build with its translation check, and the fresh app (51 checks, the same one known gap
      as on 6.0.0). With the app's fbtee at 6.0.0 and void-fbtee's compiler at 6.0.1 (the range's floor) — unit tests
      and the example's build.
    - **What changes**: the `fbtee` peer becomes `^6.0.0`: any 6.x, not 7. fbtee had four majors in four months
      (3.0.0 2026-07-17, 4.0.0 08-29, 5.0.0 09-16, 6.0.0 11-11, npm), so a new major waits for a void-fbtee release
      tested on it. void-fbtee's own `@nkzw/fbtee-compiler` and `@nkzw/vite-plugin-fbtee` stay exact pins, now 6.0.1:
      fbtee releases its packages together and pins its own compiler exactly (`@nkzw/vite-plugin-fbtee` 6.0.1 depends
      on `@nkzw/fbtee-compiler` 6.0.1). The repo's `@nkzw/eslint-plugin-fbtee` and the example's `fbtee` go to 6.0.1.
      `init` writes `^` plus the tested version (`"fbtee": "^6.0.1"`), so apps get fbtee's patches.
      README's Requirements says fbtee 6.x and the versions it's tested with.
    - **Kept current**: as built, every fresh app does: a new app has no lockfile and init writes `^6.0.1`, so each
      install takes the newest 6.x (a failing run prints which: `fbtee installed: …`). The weekly run shows a new fbtee
      release breaking void-fbtee before a developer does, with no separate run for it.
18. **`e2e/fresh` becomes a Vitest project** like `dev`, `preview`, `browsers` and `deployed`: `e2e/fresh/*.test.ts`,
    run with `vp test run --project fresh`, replacing the 1002-line `e2e/fresh/check.ts` runner and its own
    `check()`; `fresh.yml` runs that. It gains a run with no translator at all (no Claude Code, no Cloudflare): `init`
    reports it, `vp dev` serves, `vp build` stops with item 13's message. Today it copies the example's finished
    translations in before building (lines 268–275), so it never sees a new developer's first build.
    - **As built**: `e2e/fresh/fresh.ts` holds the steps; one test file per app, named so a file name is no other's
      prefix (`vite-plus-pnpm`, `vite-plus-npm`, `vite-pnpm`, `vite-npm`, `thai-source`, `no-translator`), and
      `tarball.test.ts` for the packed package; `setup.ts` packs once. Each step is a test, skipped once an earlier one
      fails. One app: `vp run test:fresh e2e/fresh/vite-npm.test.ts`; `fresh.yml` runs each with the tarball's checks.
      The install after init is gone (init installs). Claude Code reads its sign-in from an empty folder in the apps'
      clean environment, so no machine's sign-in reaches them.
19. **Tried and reversed:** with dev exports, a git install (the README's install today) got `exports` pointing at
    `src/`, and the plugin failed to load in the app; it also needed `.ts` on 111 imports. Taken out whole; the
    package stays built (`vp pack`, its `prepare` script), for development and for publishing. What was planned:
    **One package for development and for publishing, the tsdown way** (tsdown 0.23.7 docs, rolldown/tsdown `docs/`,
    commit `90c6bff`, read 2026-11-20; `vp pack` is tsdown, configured in `vite.config.ts`'s `pack` block as Vite+'s
    `docs/guide/pack.md` says). tsdown's dev exports (`docs/options/package-exports.md`, "Dev Exports"):
    `pack.exports.devExports: true`, so `package.json`'s `exports` point at `src/` while working, and the built ones are
    written to `publishConfig.exports`, which `pnpm pack` / `pnpm publish` put in their place. Shown in the clone:
    with `dist/` deleted, the example app loads `void-fbtee/plugin` from `src/dev/plugin.ts`, builds, and the unit
    tests pass (198 + 17), and `dist/` stays empty; `pnpm pack`'s tarball points `exports` at `dist/`, has no `src/`,
    publint and Are the Types Wrong? clean.
    - **What it needs: source Node can run.** The first try failed: Node 24 strips the types itself, but 111 relative
      imports in 21 files had no extension (`./commands`), which Node's loader requires. They become `./commands.ts`;
      the six left are code `void-fbtee gen` writes into apps, not imports. `tsconfig.json` gains
      `allowImportingTsExtensions`, `noEmit` and `erasableSyntaxOnly` (so nothing Node can't strip gets in; the one
      `namespace` is inside `declare global`, types only).
    - **What goes, in the same change** (the old way's pieces): the root `dev` task's build-first-then-watch
      (`vite.config.ts`, `run.tasks.dev`, written after the 2026-11-17 stale-`dist/` bug in
      `plans/translation-rework.md`) becomes the example's `vp dev`; the package's `dev` script
      (`vp pack --watch --no-clean`); the `build:prepare` hook that stops a build while the dev server runs, with its
      `DEV_PORT` / `devServerRunning` (`packages/void-fbtee/vite.config.ts`); the example's `deploy` tasks'
      `dependsOn` package build (`apps/example/vite.config.ts`). The CLI (`bin`) stays built: a fresh clone's
      `vp install` builds it (the package's `prepare` script).
    - **Publishing must be pnpm's**: npm ignores `publishConfig.exports` (tsdown's docs say so), so item 6's release
      workflow runs `pnpm publish`. `e2e/fresh` already packs with `pnpm pack`.
20. **tsdown's own agent skill**, installed the way tsdown documents (`skills add rolldown/tsdown`,
    `docs/guide/skills.md`), as a `vp` task beside the repo's other tools and updated with them, so an agent working in
    this repo works from tsdown's current docs rather than memory.
    - **As built**: the `skills` tool (1.9.0) is a root devDependency; `skills-lock.json` records the commit; the root
      `prepare` script restores it into `.claude/skills/` on `vp install`; `vp run skills:update` moves it on. Only the
      `tsdown` skill: `tsdown-migrate` is for coming from tsup. skills.sh's "Gen" scanner rates the tsdown skill
      "Critical Risk"; read 2026-11-20, it's Markdown docs, no scripts, ordinary `npx tsdown` examples, so kept.
    - Found with it: pnpm 12 links the agent skills a dependency ships once allowed, and `@vitejs/devtools-kit`
      ships Vite DevTools' own (writing DevTools panels), which was waiting for approval. Allowed in
      `pnpm-workspace.yaml`'s `permissions`; it moves with the package.

Checked against tsdown and kept, on purpose:

- Already as tsdown says: config in the `pack` block; `exports` written from the entries; ES modules only with no
  legacy `main`/`module` fields; `dts`; publint; Are the Types Wrong? (`esm-only`); unused dependencies;
  `deps.onlyBundle: []` (nothing from `node_modules` bundled); target taken from `engines.node`.
- **One build, platform `node`, not split.** tsdown says `neutral` for code that runs anywhere, and void-fbtee's
  runtime runs in Workers and browsers. Built both ways in the clone: the code is the same (only chunk names and how
  shared code is split into files differ). The neutral build flagged the two places runtime code uses a Node API,
  `node:async_hooks` (`AsyncLocalStorage`) in `src/server.ts` and `src/content-pending.ts`, which Workers get from
  `nodejs_als` (Void turns it on: it's in the example's built Worker config). The split's cost: tsdown's unused check
  runs per config and reported packages as unused that aren't. So one build, and README's Requirements says the
  runtime needs `AsyncLocalStorage` (`nodejs_als`, which Void sets).
- **`isolatedDeclarations` stays off**, though tsdown recommends it for fast `.d.ts`: it needs a written return type
  on every export, and types here come from the source, not written by hand. Building takes about 1.2 s as it is.
  (It would also avoid tsdown's "TypeScript 7.0 … experimental" warning, which stays.)
- **Checks stay on every build, not CI only** (tsdown's `'ci-only'`): a build is about 1.2 s.

Not added, on purpose:

- No `vp create` template or `void add`-style command: neither Void nor Vite+ has a way for an add-on to set itself
  up in an existing app (Void's CLI: `void init`, `void gen …`; Vite+'s `vp create` makes new projects only,
  `docs/guide/create.md`). Void's own add-ons are installed and configured by hand from their docs. A package's own
  `init` command is the usual way, so `void-fbtee init` stays, doing the whole job (14–16).

Found along the way, not void-fbtee's:

- With `bundleAnalyzerPlugin` on, its report lands in the browser output, which Void deploys with the site's files
  (`.cloudflare/output/v0/workers/default/assets/bundle-analysis.json`, 20 KB). The README note in 11 says to name it
  outside the deployed folder, or keep it to local builds.
- **The git install goes** (Gerard, 2026-11-20: "That's old shit. We should do it the proper way"): apps install
  from npm (`vp add void-fbtee`, package README), the fresh apps install the packed tarball as npm would serve it,
  and the git app, its `allowBuilds` line and the "tag in the install line" release step are removed. The tarball
  is packed from the checkout as it is, so the fresh run no longer needs the package committed first. npm has
  nothing until the first publish (item 6).
- void-fbtee's, fixed: `init` skipped its install when run by `npx` / `npm exec` (npm sets
  `npm_lifecycle_event` to `npx`, which init took for an install's own script), and its install would fail under CI
  (a frozen lockfile, after init changed package.json). Now only an install's scripts skip it, and it installs
  with `--no-frozen-lockfile` (pnpm, vp).
- Already tracked: a server route from Void's docs answers in English, not the language asked for
  (`plans/quiet-harbor-atlas.md`, step 10; the fresh check marks it "known gap").

## Tests

Two new tests, each for a bug that shows nothing when it breaks:

- dev server closed → nothing written or started afterwards (finding 1);
- Markdown page saved in place → stamped (finding 4).

As built: `packages/void-fbtee/test/unit/dev-server.test.ts`, on a real Vite dev server. Both fail with the plugin as
it was at `854cbdb` and pass now (15 runs in a row).

None for the rest: the outside-Vite stop is its own error message, the path fix can't be tested without Windows,
metadata is checked by publint on every `vp pack`, and the layout move is proved by the existing tests passing.
No Windows test or job (no time). No new CI steps.

## Done when

`vp check`, `vp test` and the e2e suite pass locally on main; `vp run test:fresh` passes for all six apps
(pnpm and npm on Vite+ and plain Vite, the Thai-source app, the no-translator app) — on 2026-11-20, before any change,
`pnpm-vite-plus` passed 51 checks with no logins or tokens, with the one known gap above; `vp pack` shows publint and Are the Types Wrong? clean;
the save script shows 30/30 full reads for all three save styles; committed locally. Pushed only when Gerard says.
