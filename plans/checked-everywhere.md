# plans/checked-everywhere.md: the same strict checks on the whole repo, proven to work

Status: 2026-11-19, approved in the conversation and built (see "As built" at the end).

## Why

`plans/no-casts.md` made `packages/void-fbtee/src` free of casts and `any`, but only there. The
rest was never checked (counted 2026-11-19):

- the example app: 30 casts (`src/` 17, `pages/` 7, `routes/` 3, `queues/` 2, `crons/` 1);
- the tests: 77 casts (`e2e/` 47, `packages/void-fbtee/test/` 30);
- 89 `!` (non-null assertions) in the package: each one an unchecked "this is never empty";
- 8 hidden modules typed by hand (`packages/void-fbtee/src/virtual.d.ts`).

It got through because no check looked for it. TypeScript allows casts, `!` and `any` even when
`strict`. A project's lint rules are the list in its own `vite.config.ts`, and nobody had asked for
these. Neither Void nor Vite+ supplies such a list. Read in Void's repo at its latest commit
(`voidzero-dev/void` `cb84536`, 2026-11-19):

- `void init` writes `strict: true` and `skipLibCheck: true`, and no lint rules
  (`packages/void/src/cli/init.ts`);
- the skill Void ships to apps, and Void's own `AGENTS.md` files, say nothing about casts or `any`;
- Void's own repo lints with about 110 rules (its root `vite.config.ts`, `lint.rules`), including
  `no-explicit-any` and `no-floating-promises`, but nothing against casts, and its package source has
  49 `as unknown as`;
- Vite+ runs the linter; its guide only recommends `typeAware` and `typeCheck`.

## The rules

All in the root `vite.config.ts`, for the whole repo: the package and its tests, the example app,
`e2e/`.

1. **Void's own list, whole:** `lint.rules` and `lint.plugins` from `voidzero-dev/void` `cb84536`'s
   root `vite.config.ts`, copied with that commit named above it, so where each rule came from is
   plain, and an update is a copy from a newer commit. Rules for Void's own folders (its overrides)
   aren't taken.
2. **Ours on top**, each marked as ours:
   - `typescript/consistent-type-assertions` set to `never`: no casts (`as const` allowed);
   - `typescript/no-unsafe-assignment`, `-member-access`, `-call`, `-return`, `-argument`: no
     value used as `any` (from `JSON.parse`, `require()`, a loosely typed library);
   - `typescript/no-non-null-assertion`: no `!`.
3. **TypeScript:** `noUncheckedIndexedAccess`, so `list[0]` is "maybe nothing" and has to be checked:
   without it, banning `!` would only hide the same claim. `skipLibCheck` off where the libraries'
   own types allow it, so a missing library type (as `D1Result` was) is an error, not a silent
   `any`; where they don't, the reason is written beside it.

The package's current override (`plans/no-casts.md`) goes: the same rules now cover everything.

## Proven to work, not trusted

- **A file of deliberate violations**, `test/lint-rules/violations.ts`: one cast, one `any` used,
  one `!`, one unchecked `list[0]`, one promise nobody waits for, and so on, one per rule above.
  Kept out of the normal lint run. A unit test lints it (the same `vp lint`, pointed at it) and
  expects each rule's name in what it reports. A rule that's switched off, misspelled, or silently
  doing nothing fails the test.
- **The same test lints one clean line in each folder** (`apps/example`, `e2e`,
  `packages/void-fbtee/test`) with a violation, so a folder the rules don't reach fails too: the gap
  that let the example app's casts through.
- **Exceptions are counted:** each needs a disable comment with its reason
  (`-- why`), and the test lists them all and compares the list. Today that's the two in
  `plans/no-casts.md` (Void's `routeUrl` and `useForm`, typed only by an app's routes). A new one
  shows in the test's failure, not only in a diff.
- `vp check` runs all of it, the same on the Mac, here and in CI.

## Order of the work

1. The rules switched on everywhere, and the violations test, first: `vp check` then lists
   everything to fix, rather than anyone hunting by hand.
2. Fixed until it passes: the example app (what people copy from), then the package's `!`, then the
   tests.
3. The 8 hidden modules: each made a file the build writes with its real type, or checked where it's
   read, so nothing reaching run time is typed by hand.
4. README: one line saying which rules are Void's (and from which commit) and which are ours.

## Checks

- `vp check`; `test:unit` (the violations test with it), `test:dev`, `test:preview`, `test:fresh`.

## For Void (filed only with the user's OK)

- Should `void init` give a new app lint rules (at least its own repo's list)? Today a new app gets
  none from Void.

## As built (2026-11-19)

- **Rules:** `lint/void-rules.ts` holds Void's list (commit `cb84536`); the root `vite.config.ts`
  spreads it and adds ours. The package-only override is gone. `vp lint` and `vp check` are clean
  on the whole repo.
- **Every folder reached:** the root, `apps/example` and the package had files no tsconfig
  covered (`vite.config.ts`, `void.config.ts`, `pwa-assets.config.ts`, `apps/example/scripts/`,
  `lint/`), so TypeScript's own errors weren't reported there. Each tsconfig now takes its
  folder's top-level `*.ts`, and a root `tsconfig.json` covers `vite.config.ts` and `lint/`.
  `scripts/tsconfig.json` lacked `noUncheckedIndexedAccess` (why `scripts/` had `rows[0]!`).
- **Proof:** `lint/rules.test.ts` (in `test:unit`, project `lint`) writes a file breaking every
  rule into ten folders and runs `vp lint` on them; each folder must report each rule, including
  TypeScript's unchecked index and `no-floating-promises`. Turning one rule or one tsconfig
  setting off was tried: the test failed and named each folder. The same test lists every disable
  comment in the repo (8 today) against its known list, and each must give its reason (`-- why`).
- **Fixed, not silenced:** JSON from outside (fbtee's compiler, catalogs, package.json files, D1's
  and R2's local APIs, Void's hooks, Globalping, Tailscale) is read as `unknown` and checked with
  the package's guards (`src/guards.ts`), or `readCatalog` / `readPhrases`. `readPhrases`
  (`src/dev/catalogs.ts`) now also checks `jsfbt.m`, which `pluralSlots` read unchecked, and
  `runtimeTables` checks fbtee's compiled tables (they were `Record<string, unknown>`). The e2e
  stages' shared values (`prod`, `live`, `devToken`, `devSkip`) are typed the way Vitest
  documents (`e2e/provided.ts`, its `ProvidedContext`), which needs `vitest` itself as a root
  devDependency (the catalog's 5.1.0, the one Vite+ re-exports). `scripts/check-tools.mjs`
  became `.ts`, so it's type-checked.
- **The 8 hidden modules** (`packages/void-fbtee/src/virtual.d.ts`): the data ones (config,
  texts, each catalog) are declared by `JsonModules` (`src/virtual-types.ts`), and the plugin can
  only write them through `jsonModule()`, which takes that type. The rest by the real types of
  what they hold: `@void/md/pages`' own, Hono's `matchedRoutes` (`hono` added to the catalog at
  the version Void resolves, 4.13.19, types only), Zod's `config` and `$ZodErrorMap` (the module
  now holds data; `src/zod-language.ts` does the setup, used by the middleware and the test), and
  `devTranslate`'s own type. `pages` stays declared as `LangPage`: the plugin reads it from the
  same PagePathMap that type is made from.
- **`skipLibCheck`:** off in `scripts/` and `e2e/` (no library errors there). On in the root,
  the app and the package: Cloudflare's Worker types clash with TypeScript's DOM types, and
  Vitest's browser, unplugin's, drizzle-orm's and typescript-eslint's types with TypeScript 7. The
  reason is written beside it in the root's and the package's tsconfig; the app's stays plain JSON,
  since `void-fbtee init` (and Void's own init) read it as JSON: with a comment in it, init said
  to add fbtee's types by hand (caught by `vp run check:tools`).
- **Found along the way:** `pnpm peers check` reports typescript-eslint (from fbtee's lint plugin)
  wanting TypeScript below 6.1; it works with 7.0.2 here. For fbtee's plugin to follow, with the
  user's OK (`plans/fbtee-issues.md`).
