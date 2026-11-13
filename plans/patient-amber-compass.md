# plans/patient-amber-compass.md: conformance, tested the way each layer tests it

Status: done 2026-11-12 (all ten items). Written and approved 2026-11-12.

## Context

void-fbtee sits in three layers, each with its own rules: Vite (the plugin), Vite+ (the toolchain
around it) and Void (the app). `plans/steady-folding-heron.md` items 10-13 checked the package
against each layer's docs. That's conformance stated, not tested. It has to be tested the way
the package actually reaches developers: as a published package, installed by their own package
manager, into a new app on their own toolchain.

What "tested for real" means, from the projects themselves (read 2026-11-12):

- **Void** tests its own packages before publishing this way (voidzero-dev/void at ee4eaa7,
  `.github/workflows/prepublish-test.yml`, `.github/scripts/packed-consumer.mjs`,
  `packed-registry.mjs`): it packs each package into the tarball npm would publish, checks the
  tarball's manifest and files (`inspectPackage`: description, MIT license, https homepage and
  bugs, a `LICENSE` file, no `workspace:`/`catalog:` versions), serves the tarballs from a local
  read-only registry that passes everything else through to npm, and makes fresh apps with npm
  and pnpm, on plain Vite and on Vite+, with a clean environment (no tokens), strict peer
  dependencies and strict engines. Then install, init, build, serve, browser checks.
- **Vite** runs an ecosystem CI: the CI of major projects built on Vite, run against Vite's own
  changes, to see what a release breaks (vite.dev/guide/philosophy; vitejs/vite-ecosystem-ci).
  Smaller packages run the other direction: their own tests against the newest release of what
  they're built on. Today's Vite+ 1.6.0 breaking `test:fresh` without warning is that case.
- **Vite+** keeps the Vite ecosystem as it is: plugins stay Vite plugins, and projects keep their
  own package manager (voidzero.dev/posts/announcing-vite-plus-beta). So a plugin has to work for
  npm, pnpm, Yarn and Bun users, not only pnpm.
- **A Vite+ package's shape** is Vite+'s own library template, `vp create vite:library`, kept by
  tsdown's author (sxzz/tsdown-templates, `vite-plus/`, last changed 2026-10-31).

Today's `e2e/fresh/check.ts` falls short: it installs from a git commit, not the published
tarball; only with pnpm; checks nothing in the tarball; and only against the versions this repo
pins.

## What's realistic

Done as Void does it, plus what's cheap and caught real problems on 2026-11-12, and nothing more:

- Void tests npm and pnpm, on plain Vite and on Vite+. So do we. Yarn, Bun and macOS are left
  out, as Void leaves them out; one is added when someone hits a problem there.
- No local registry: Void needs one because its packages depend on each other by version; we
  publish one package, so installing the packed tarball file tests the same thing.
- From fbtee (nkzw-tech/fbtee at 16efaf5, 2026-11-11, `packages/vite-plugin-fbtee/test/e2e.mjs`):
  the plugin is also tested in memory through Vite's own `build()`, which takes seconds.
- Not Node's module resolution (`nodenext`) for the package: the template is a plain library;
  ours is a Vite plugin with JSX and virtual modules, built by Vite.

## A. The package, shaped as a Vite+ package

Against Vite+'s library template:

1. [x] **`LICENSE` and a short README in the package's own folder**, in the tarball (Void requires
       a LICENSE in every package; fbtee ships both in each). The README: what it is, install,
       `void-fbtee init`, links to the docs.
2. [x] **`exports` written by tsdown from the entries** (`pack.exports: true`, as the template),
       with `./package.json` exported, replacing the hand-written ones; publint and attw check
       the result on every build.
       Done: tsdown writes them as plain paths (TypeScript finds each `.d.mts` beside its
       `.mjs`); the command is left out (`exclude: ["cli"]`: it's run, not imported).
3. [x] **The template's `package.json` pieces:** `publishConfig.access: "public"`, a
       `prepublishOnly` build, a `check` script.
4. [x] **Stricter TypeScript checks from the template:** `verbatimModuleSyntax`,
       `isolatedModules`, `noUnusedLocals`. Whatever they find gets fixed.
       Done: for the package's own code (proved: an unused local and a type imported as a value
       each fail). The test fixture is an app, with its own `tsconfig.json`: an `fbt` import is
       needed for `<fbt>` but unused to TypeScript, so apps can't use `noUnusedLocals`.

## B. The tests

5. [x] **The plugin in memory, through Vite's own `build()`** (as fbtee tests its plugin): its
       hook filters, the server-only swaps per environment, the virtual modules. In
       `packages/void-fbtee/test/`, run by `vp test`.
6. [x] **The fresh check installs the real tarball:** packed as npm would publish it, checked as
       Void checks its own (description, MIT license, https homepage and bugs, a `LICENSE`, no
       `workspace:`/`catalog:` versions, only `dist`, `skills`, `README.md`, `LICENSE`), then
       installed from the file. The git install stays as one case, since that's how apps install
       it today.
7. [x] **npm and pnpm, each on plain Vite and on Vite+:** four apps, as `void init` makes them,
       with a clean environment, strict peer dependencies and strict engines (as Void's).
       The npm app also gets a lockfile made as on a Mac (npm's `--os=darwin --cpu=arm64`), then
       `npm ci` and a build on Linux: a Mac developer with Linux CI, where npm can skip the right
       build of fbtee's native compiler (npm/cli#4828, open since 2022; related fixes still open
       in October 2026). pnpm records every system's build (this repo's `pnpm-lock.yaml` lists
       all 8, checked 2026-11-12). If npm fails there, the plugin says plainly why and how to fix
       it (reinstall without the old lockfile), and the package README says so for npm users.
8. [x] **In each app, the Void parts too:** a link to a page that doesn't exist fails the type
       check; `/xx-XX/...` is not found; `/` redirects with 301. Beside what's there now (init,
       check, build and types, Vite+'s `vp check` and lint rule, Thai and Arabic in dev).
9. [x] **The fresh check weekly too**, on a schedule in `.github/workflows/fresh.yml`: new apps
       get the newest Vite+ and Void, so a release that breaks void-fbtee shows up within a week,
       as Vite+ 1.6.0 did on 2026-11-12.

## C. Docs with the package; the example only exercises it

As fbtee (`website/` for docs, `example/` for the demo) and Void (`docs/`, `playground/`) do.

10. [x] **The package's docs live once, with the package:** its README (developers) and
        `skills/void-fbtee/SKILL.md` (coding agents, already shipped in it). The example's
        `setup`, `strings` and `markdown-pages` pages are the package's reference docs, repeated
        from SKILL.md and the README in three languages each; they go. The example keeps the
        pages that exercise the plugin: the tour (translated markdown, about the demo), Intl and
        Temporal (the platform's own formatting). The home page's links, the docs sidebar and
        the tests that list pages follow. The example keeps the package as a workspace
        dependency, as Void's own playgrounds do; the new apps of B are where it's used as a
        stranger uses it.

## What B and C found (2026-11-12)

The check's first runs found three real problems. First, under `CI=true` (as GitHub Actions sets
it), the type build copied Hono's types into `dist`, because Void's `defineMiddleware` returns
Hono's type. The middleware's default export is now typed `ReturnType<typeof defineMiddleware>`,
and `deps.onlyBundle: []` makes any bundled package a build error; shown to fail when the fix is
undone. Second, fbtee's lint plugin (added on Vite+) uses typescript-eslint, which wants
TypeScript below 6.1, while new Void apps have TypeScript 7 (typescript-eslint#12518). The check
allows exactly those four packages under strict peers, and the package README tells developers.
Third, `npm install --os=darwin` runs workerd's install script against the Mac build here; the
Mac-side installs skip scripts, as only the lockfile is the Mac's. The Mac-made lockfile then
passes `npm ci` and the build on Linux, so npm/cli#4828 doesn't reach fbtee's compiler today: no
plugin message or README note needed. The docs pages' `<Fmt>` list moved into the tour, so a
markdown page still runs that island in every language.

Shown to fail when broken: the `Lang` probe (no error once the type isn't registered), the 301
check (`/` answers 200 without the redirect) and the 404 check (`/xx-XX` answers 500 without the
middleware). The tarball checks weren't broken on purpose; they caught the problems above.

## Not in this plan

- Publishing to npm: your decision; this makes the package ready for it.
- Void 1.8.0 and what needs it: `plans/brisk-copper-wren.md`.

## Verification

Locally, in the background: `vp check`, `vp test run`, `vp run test:fresh` (five apps). Each new
check is first shown to fail when what it guards is broken (as the lint rule's test was). After
the push: CI's runs pass.
