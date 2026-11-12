# plans/steady-folding-heron.md: the example and the package, the Void way

Status: waiting for approval. Written 2026-11-12.

## Context

An audit of the example app and the package against Void's own docs (void 1.8.0, `docs/`) and its
26 playground apps (voidzero-dev/void at ee4eaa7, read 2026-11-12) found the places where we differ
from how Void does things. The code is mostly right, and pages mode is used as Void designs it
(loaders and actions beside each page, validators from the schema). These are the gaps. Each item
says what changes, where, and what backs it. Ticked off in this file in the same commit as the code. Order: what works on Void 1.7.0
first, the upgrade last, then only what needs Void 1.8.0.

## First: on Void 1.7.0, as one change

1. [ ] **A translated `<title>` and description on every page.** None has one today, in any
       language (checked on the live site). A `head` export per page (`defineHead`), with a small
       helper in `void-fbtee` so the text is translated like everything else.
       Backed by: Void `docs/guide/pages-routing/head.md`; playground `react-pages/pages/users/[id].server.ts`.

2. [ ] **Typed links without casts.** `void.config.ts` has `routing.typedRoutes: true`, yet about
       15 links are cast `as never` (`components/SiteHeader.tsx`, `SiteFooter.tsx`, `DocsLayout.tsx`,
       `HomeSections.tsx`, `pages/[lang]/index.tsx`, `docs/index.island.tsx`) and cache paths
       `as RouteUrl[]` (`events/index.server.ts:47`, `events/[id].server.ts:46`, `queues/translate.ts:64`).
       First find out why our `[lang]` URLs don't type-check, then fix it, in the package if that's
       where it belongs.
       Backed by: playgrounds write typed links with no casts (`react-pages/pages/users/index.tsx:27`).

3. [ ] **The page's language read without casts.** `c.get("shared" as never)` in
       `events/index.server.ts:14`, `events/[id].server.ts:22,34`, `docs/intl.server.ts:9`. The
       package augments `CloudContextVariables` so `c.get(...)` is typed.
       Backed by: Void `docs/guide/type-safety.md` "Context Variables",
       `docs/guide/pages-routing/layouts.md` "Shared Data".

4. [ ] **Route parameters validated.** `c.req.param("id")!` and `c.req.param("lang")!` in
       `events/[id].server.ts:21,33` and `events/index.server.ts:50` become `withValidator({ params })`.
       Backed by: playground `spa/routes/api/users/[id].ts`.

5. [ ] **Shared code in `src/`.** Today it's in three places: `components/`, `lib/` and `src/`.
       Move `components/` and `lib/` under `src/` (and update `components.json`'s aliases).
       Backed by: Void `docs/reference/structure.md` ("`src/`: Shared application code such as
       components, utilities, and types").

6. [ ] **Middleware name: say why it's unnumbered.** Void's convention is numbered files
       (`01.logger.ts`); ours is `middleware/i18n.ts` on purpose (it runs last). One line in that
       file says so. No rename.
       Backed by: Void `docs/reference/structure.md` "middleware/".

7. [ ] **Remove the starter's `routes/api/hello.ts`.** Only `e2e/server.test.ts:56` uses it, to
       check the middleware skips `/api/`. That test uses `POST /api/live` instead, which answers
       at once (not `GET`: that opens a live stream that never ends). Check what it answers first.

8. [ ] **README: how we test, and why it differs from Void's guide.** Void's testing guide covers
       unit tests in Node with `vi.mock()` for bindings; ours run the real build on the local
       Cloudflare runtime and against the deployed site, with nothing faked. Formatting can only be
       tested on the Worker's own `Intl`, not Node's.
       Backed by: Void `docs/guide/testing.md` (new in 1.8.0).

9. [ ] **No references into the closed plan issue.** About eleven comments point to "plan #1" or a
       decision number (`packages/void-fbtee/src/vite.ts:6,7,12,20`, `init.ts:222`, `react.tsx:81`,
       `apps/example/pages/[lang]/index.tsx:15`, `e2e/server.test.ts:69,71,92`, `e2e/helpers.ts:127`).
       Each gets its reason written in place.

## Then: the upgrade, last

- [ ] **Void 1.8.0 and Vite+ 1.6**, by the README's "Upgrading" steps, from 2026-11-13 ~01:00 UTC
      (pnpm installs nothing under a day old). `vp upgrade && vp run upgrade:vite-plus`; the three
      Void packages to 1.8.0 in `pnpm-workspace.yaml`'s catalog; `vp install`; `vp run check:tools`;
      then `vp check`, `vp test run`, `vp run test:fresh`, `vp run test:browsers`.
      Backed by: README "Upgrading"; Vite+ `docs/guide/upgrade-project.md` (`vp migrate`).

## After the upgrade: what needs Void 1.8.0

2. [ ] **Translated not-found and error pages**, inside our layout (header, language switcher):
       `_not-found` and `_error` components, new in Void 1.8.0. Unknown events and URLs get Void's
       default page today.
       Needs 1.8.0: `_not-found` and `_error` are new in it.
       Backed by: Void 1.8.0 release notes; `docs/guide/pages-routing/errors.md`.

3. [ ] **Three small unit tests of pure code**, run by `vp test` in seconds, beside the code in
       `src/` (after item 6): `parseNumber`; `startsAt` with the event schema, including a time that
       doesn't exist on a clock-change day; `showInvisible` and `listDifference`. Real code, nothing
       mocked. Not `relativeDays` or `fmt`: they format, so they need the Worker.
       Needs 1.8.0: it fixed app tests failing because Void started a Worker under Vitest.
       Backed by: Void `docs/guide/testing.md`; Void 1.8.0 release notes.

`packages/void-fbtee/skills/void-fbtee/SKILL.md` is updated with any package change (items 1, 3, 4).

## Not in this plan

- An API layer or an MCP route for the example: undecided.
- Reports to ICU (Thai time-zone pattern) and Cloudflare (shortened city names).
- The v0.3.0 release notes: text to paste on GitHub.

## Verification

`vp check`, `vp test run`, `vp run test:fresh`, `vp run test:browsers` locally, all in the
background; the live site after the push: every page has a translated title, an unknown event
shows our translated not-found page, and CI's run against the deployed site passes.
