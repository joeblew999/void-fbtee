# plans/patient-amber-compass.md: conformance, tested the way each layer tests it

Status: waiting for approval. Written 2026-11-12.

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

## A. The package, shaped as a Vite+ package

Against Vite+'s library template:

1. [ ] **A `LICENSE` file in the package** (in the tarball). There's none; Void requires one in
       every package.
2. [ ] **A README in the package's own folder**, short: what it is, install, `void-fbtee init`,
       links to the docs. It's what npm shows, and what's in `node_modules/void-fbtee`.
3. [ ] **`exports` written by tsdown from the entries** (`pack.exports: true`, as the template
       does), with `./package.json` exported. One source for the entries; publint and attw check
       the result on every build. This replaces the hand-written `exports` (my earlier choice,
       which the template doesn't follow).
4. [ ] **The template's `package.json` pieces:** `publishConfig.access: "public"`, a
       `prepublishOnly` build, a `check` script.
5. [ ] **The template's `tsconfig` strictness:** `verbatimModuleSyntax`, `isolatedModules`,
       `noUnusedLocals`, and Node's own resolution (`module`/`moduleResolution: "nodenext"`,
       with `.ts` extensions on relative imports, which the template allows). Whatever the
       stricter checks find gets fixed.

## B. The conformance test, Void's way

`e2e/fresh/` becomes this; `vp run test:fresh` runs it locally exactly as CI does.

6. [ ] **The real tarball, inspected:** packed as npm would publish it, then checked as Void
       checks its own (`inspectPackage`), plus: every `exports` entry resolves inside the
       tarball, `files` holds `dist`, `skills`, `README.md` and `LICENSE` and nothing else.
7. [ ] **Installed from a local registry,** as from npm: the tarball served read-only beside
       npm, so each app installs `void-fbtee` by version. The git install (how apps install it
       today) stays as one case.
8. [ ] **Every package manager on every toolchain:** npm, pnpm, Yarn and Bun, each on plain Vite
       and on Vite+, as `void init` makes them. Clean environment, strict peer dependencies,
       strict engines. Only combinations `void init` itself supports; any it doesn't is written
       down with why.
9. [ ] **In each app, what a developer gets:** `void-fbtee init`; `void-fbtee check`; build and
       types; on Vite+ the whole `vp check` and the lint rule; the dev server in Thai and Arabic.
       And the Void parts, in a new app rather than only in our example: a link to a page that
       doesn't exist fails the type check; `/xx-XX/...` is not found; `/` redirects with 301.
10. [ ] **Against the newest Vite+ and Void too** (the ecosystem-CI direction): the same suite
        with the newest installable releases rather than the repo's pins, on a weekly schedule
        and by hand, so a new release that breaks void-fbtee shows up before an app finds it.

## C. Then the example and the docs

11. [ ] **Whatever A and B change in how the package is used** goes into the example, the
        README's "Add it to a Void app", the skill and the setup pages (all three languages).
        The example keeps the package as a workspace dependency, as Void's own playgrounds do;
        the new apps of B are where it's used as a stranger uses it.
12. [ ] **CI:** `.github/workflows/fresh.yml` runs B's matrix on its usual changes; a scheduled
        workflow runs item 10.

## Not in this plan

- Publishing to npm: your decision; this makes the package ready for it.
- Void 1.8.0 and what needs it: `plans/brisk-copper-wren.md`.

## Verification

Locally, in the background: `vp check`, `vp test run`, `vp run test:fresh` (the full matrix).
Each check is first shown to fail when what it guards is broken (as the lint rule's test was).
After the push: CI's runs pass, and the scheduled newest-versions run passes once.
