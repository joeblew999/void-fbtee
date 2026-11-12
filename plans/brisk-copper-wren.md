# plans/brisk-copper-wren.md: Void 1.8.0, then what needs it

Status: approved 2026-11-12 (moved from `plans/steady-folding-heron.md`, where it was the last
part). Starts from 2026-11-13 ~01:00 UTC, once pnpm will install Void 1.8.0.

## Context

`plans/steady-folding-heron.md` brought the example and the package in line with how Void does
things, on Void 1.7.0. Two of its items need Void 1.8.0, so they come after the upgrade, which
goes first. Void 1.8.0 was released 2026-11-12 00:58 UTC, and lists no breaking changes. pnpm
installs nothing under a day old, so it can be installed from about 01:00 UTC on 2026-11-13.

## First: the upgrade

1. [x] **Vite+ 1.6.0**, done 2026-11-12, once it was installable (published 2026-11-11 04:16
       UTC): it broke `test:fresh`'s Vite+ app, whose new app got 1.6.0 while this repo pinned
       1.5.1. By Vite+'s documented way (`docs/guide/upgrade-project.md`): `vp upgrade && vp
       migrate`, which also pins `vitest` to the 5.1.0 it bundles. The README's old step,
       `vp run upgrade:vite-plus`, couldn't upgrade (a task runs the project's own, older `vp`),
       so that task is gone and the README says `vp migrate`. Then `vp run check:tools`,
       `vp check`, `vp test run` (47) and `vp run test:fresh` (both apps) passed.

2. [ ] **Void 1.8.0**, from 2026-11-13 ~01:00 UTC (published 2026-11-12 00:58 UTC; pnpm installs
       nothing under a day old): the three Void packages to 1.8.0 in `pnpm-workspace.yaml`'s
       catalog, `vp install`, `vp run check:tools`, then `vp check`, `vp test run`,
       `vp run test:fresh`.
       Backed by: README "Upgrading"; Void 1.8.0 release notes
       (https://github.com/voidzero-dev/void/releases/tag/v1.8.0).

## Then: what needs Void 1.8.0

3. [ ] **Translated not-found and error pages**, inside our layout (header, language switcher):
       `_not-found` and `_error` components. Unknown events and URLs get Void's default page today.
       Needs 1.8.0: `_not-found` and `_error` are new in it.
       Backed by: Void 1.8.0 release notes; `docs/guide/pages-routing/errors.md`.

4. [ ] **Three small unit tests of pure code**, run by `vp test` in seconds, beside the code in
       `apps/example/src/`: `parseNumber`; `startsAt` with the event schema, including a time that
       doesn't exist on a clock-change day; `showInvisible` and `listDifference`. Real code,
       nothing mocked. Not `relativeDays` or `fmt`: they format, so they need the Worker.
       Needs 1.8.0: it fixed app tests failing because Void started a Worker under Vitest.
       Backed by: Void `docs/guide/testing.md`; Void 1.8.0 release notes.

`packages/void-fbtee/skills/void-fbtee/SKILL.md` is updated with any package change.

## Not in this plan

- An API layer or an MCP route for the example: undecided.
- Reports to ICU (Thai time-zone pattern) and Cloudflare (shortened city names).
- The v0.3.0 release notes: text to paste on GitHub.

## Verification

`vp check`, `vp test run`, `vp run test:fresh` locally, all in the background. After the push:
an unknown event and an unknown URL show our translated not-found page in each language, and CI's
`vp run test:deployed` (which includes `test:browsers`) passes.
