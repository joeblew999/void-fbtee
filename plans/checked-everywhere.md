# plans/checked-everywhere.md: the same strict checks on the whole repo, proven to work

Status: 2026-11-19, written; waits for the user's approval in the conversation.

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
