# plans/steady-folding-heron.md: the example and the package, the Void way

Status: done 2026-11-12. Items 5 and 7 were first ticked when they checked nothing; reopened and
done properly (see each). The upgrade
and what needs Void 1.8.0 moved to `plans/brisk-copper-wren.md`. Written and approved 2026-11-12.

## Context

An audit of the example app and the package against Void's own docs (void 1.8.0, `docs/`) and its
26 playground apps (voidzero-dev/void at ee4eaa7, read 2026-11-12) found the places where we differ
from how Void does things. The code is mostly right, and pages mode is used as Void designs it
(loaders and actions beside each page, validators from the schema). These are the gaps. Each item
says what changes, where, and what backs it. Ticked off in this file in the same commit as the code. Order: structure,
then types, then the feature, then docs.

## First: on Void 1.7.0, in this order

Structure first, so later changes land in the right files; then types; then the one feature; then
docs. One commit per item; pushed together when you say.

### A. Structure: files where Void puts them, nothing on screen changes

1. [x] **Shared code in `src/`.** Today it's in three places: `components/`, `lib/` and `src/`.
       Move `components/` and `lib/` under `src/` (and update `components.json`'s aliases).
       Done: `@/` now points at `./src` (shadcn's setup for a `src/` app: `tsconfig.json` "paths",
       `vite.config.ts` alias), so the 46 `@/` imports and `components.json` didn't change; the
       relative imports in pages and markdown did, and the copies were re-stamped.
       Backed by: Void `docs/reference/structure.md` ("`src/`: Shared application code such as
       components, utilities, and types").

2. [x] **Remove the starter's `routes/api/hello.ts`.** Only `e2e/server.test.ts:58` uses it, to
       check the middleware skips `/api/`. That test uses `POST /api/live` instead.
       Checked 2026-11-12: `routes/api/live.ts` is ours; `POST` runs `live.control(c)` (subscribe and
       unsubscribe) and answers at once; `GET` runs `live.connect(c)`, a stream that never ends. The
       test asserts the answer comes from that route, not a redirect to a language page; the exact
       status is read off the running server before the line is written.
       Done: the answer read from Void's code (the server couldn't run here then, with no
       Cloudflare sign-in): an empty POST gets 400 with Void's own JSON (`accepted: false`) from
       `readControlRequest` (`packages/void/src/runtime/live.ts:410-414`, ee4eaa7). The test
       checks both, and the full run proves it on the real server.

3. [x] **Middleware numbered: `middleware/99.i18n.ts`.** Void orders middleware by the number in
       the file name; an unnumbered file gets order Infinity, so ours already runs last, but only by
       a rule you'd have to look up. Ours must run after the app's own middleware, because it merges
       into the `shared` and head data they set (`packages/void-fbtee/src/middleware.ts:77-92`), so it
       becomes `99.i18n.ts`, leaving 01-98 for the app. Package change: `init` creates
       `99.i18n.ts` (`init.ts:152`), its tests, `check.ts:103`, `react.tsx:64`, `middleware.ts:2`,
       SKILL.md, and the setup page in all three languages. An app that keeps `i18n.ts` still works
       (the check finds the re-export by content).
       Backed by: Void `docs/reference/structure.md` "middleware/" ("Numeric prefixes control
       execution order"); `packages/void/src/router/scan.ts` `parseMiddlewareDefinitions` (ee4eaa7).

4. [x] **No references into the closed plan issues.** About eleven comments point to "plan #1" or a
       decision number (`packages/void-fbtee/src/vite.ts:6,7,12,20`, `init.ts:222`, `react.tsx:81`,
       `apps/example/pages/[lang]/index.tsx:15`, `e2e/server.test.ts:69,71,92`, `e2e/helpers.ts:127`;
       lines as of 2026-11-12, before item 1 moves files). Each gets its reason written in place.
       Done: 18 references (plan #1 and plan #3, and vite.ts's numbered decisions); where the
       reason was only in the issue, it's now in the sentence.

### B. Types: the casts go, nothing on screen changes

5. [x] **Typed links: every link checked by the type checker.** `void.config.ts` has `routing.typedRoutes: true`, yet about
       15 links were cast `as never` (`SiteHeader.tsx`, `SiteFooter.tsx`, `DocsLayout.tsx`,
       `HomeSections.tsx`, `pages/[lang]/index.tsx`, `docs/index.island.tsx`) and cache paths
       `as RouteUrl[]` (`events/index.server.ts:47`, `events/[id].server.ts:46`, `queues/translate.ts:64`).
       Checked 2026-11-12: links written in place need no cast. Links from helpers did, because
       the helpers were typed as plain strings, and so did the cache paths, because the package's
       `localizedPaths()` returned `string[]`.
       Done: `localizedPaths()` is typed as route paths; the helpers (`DocsLayout.tsx` `href`, the
       home page's cards) keep their route shape with `as const`; no casts are left.
       Found doing it: typed routes can't catch a wrong link in this app. With pages under
       `[lang]`, Void's route types include `` `/${string}` ``, which matches any path (a planted
       link to `/${locale}/no-such-page` type-checked). And `test:browsers` follows every link but
       never checked the page loaded: a broken link gets Void's not-found page, which hydrates
       fine. So `e2e/server.test.ts` gets "every link on the main pages leads to a page": each
       link on each language's home, docs and events pages is fetched and must answer 200.
       Reopened: removing the casts checked nothing. Links written as text strings are what lose
       the checking. Void's way is `routeUrl("/[lang]/events", { params: { lang } })` (`void/routes`):
       a route that doesn't exist, or a missing `lang`, fails the type check (tried 2026-11-12, both
       rejected). So every link in the example is built with `routeUrl()`. Markdown docs pages are
       routes per language (`/en-US/docs/tour`), not under `[lang]`, so their links need their own
       typed way, worked out from Void's types. The "every link leads to a page" test stays, as a
       check at run time beside the types, not instead of them.
       Done, by structure rather than a helper: the language is a type. Void's own docs show both
       shapes this app has: `[lang]` as a route parameter for pages built from code
       (`docs/guide/server-routing.md`), and a folder per language for written pages
       (`docs/guide/edge/rewrites.md`). What was wrong was the language typed as `string`. The app
       declares its languages once, in `src/locales.ts`, and registers their type with the package
       (a global interface, `VoidFbteeRegister`, as Void does for its generated bindings in
       `packages/void/src/runtime/handler.ts:43-50`: the fresh install showed that augmenting
       `void-fbtee/locales` can't reach an interface the build moved into a shared chunk); `vite.config.ts` gives the same list to `voidFbtee()`. Then
       `useLocale().lang` is `"en-US" | "ar-EG" | "th-TH"`, and every link is a direct `routeUrl()`
       call: `routeUrl("/[lang]/events", { params: { lang } })`, ``routeUrl(`/${lang}/docs/tour`)``.
       Proved on the real code: a missing app page, a missing docs page, and a link without its
       language each fail the type check; a docs page missing in one language fails too. The one
       link built at run time is the language switcher (this page in another language); the
       comment on it says why it's safe. `init` now writes `src/locales.ts` and imports it in
       `vite.config.ts`. The link test now crawls every page reachable in each language.
       Backed by: playgrounds write typed links with no casts (`react-pages/pages/users/index.tsx:27`).

6. [x] **The page's language read without casts.** `c.get("shared" as never)` in
       `events/index.server.ts:14`, `events/[id].server.ts:22,34`, `docs/intl.server.ts:9`, and
       the package's own five in `packages/void-fbtee/src/middleware.ts:77-92`.
       Done, differently from first written: the package doesn't type `shared`, because `shared` is
       the app's to type and two declarations of one property with different types don't merge.
       It adds its own typed variable instead, `i18n` in `CloudContextVariables`, so loaders and
       actions read `const { locale } = c.get("i18n")`; `shared.i18n` stays for pages. The
       package's casts went too: Void already types `headDefaults` and allows any other name
       (`packages/void/src/runtime/handler.ts:36-41`). SKILL.md says how server code
       reads the language.
       Backed by: Void `docs/guide/type-safety.md` "Context Variables",
       `docs/guide/pages-routing/layouts.md` "Shared Data".

7. [x] **Route parameters validated.** `c.req.param("id")!` and `c.req.param("lang")!` in
       `events/[id].server.ts:21,33` and `events/index.server.ts:50` become `withValidator({ params })`.
       Done: zod, as the schema uses; Void validates `c.req.param()`, what the code read before
       (`packages/void/src/runtime/validator.ts:212-219`, ee4eaa7).
       Reopened: `z.string()` only checks they're strings, which they always are. `lang` must be
       one of the app's languages and `id` an event's id format.
       Done, after finding the real bug: `/xx-XX/events` answered 200, an English copy under a
       made-up language. Void has no constraint on a route parameter, and a failed validation on a
       page becomes form errors (422, `packages/void/src/pages/protocol.ts:954-985`), so a URL that
       isn't a page is the middleware's to refuse: any page under no language of the app's gets
       `c.notFound()` (Void's `docs/guide/pages-routing/errors.md`). Behind it, `lang` is
       `z.enum(locales)`, typed as the app's languages. An event id is checked by the database:
       the page already answered 404, and booking an unknown event answered 409 "sold out"; it's
       now 404. Tests for both.
       Backed by: playground `spa/routes/api/users/[id].ts`.

### C. Feature

8. [x] **A translated `<title>` and description on every page.** Checked on the live site
       2026-11-12: only the tour has one (from its frontmatter); no other page has either.
       Done, with no package helper: `head()` (`defineHead`) runs inside void-fbtee's per-request
       state, so `String(fbs(...))` is translated like any other string. Titles reuse the page
       headings' own strings, and the Intl and Temporal descriptions reuse the page intros, so
       they were already translated; three new descriptions, translated into Thai and Arabic. An
       event's page shows the event's own title and description in the page's language. The
       three docs pages without frontmatter got `title` and `description` in all three
       languages. `titleTemplate: "%s · void-fbtee"` in `void.config.ts`. A new everyday test
       (`e2e/server.test.ts`) checks every page in every language; SKILL.md says how.
       Backed by: Void `docs/guide/pages-routing/head.md` (head(), markdown frontmatter,
       titleTemplate); playground `react-pages/pages/users/[id].server.ts`.

### D. Docs

9. [x] **README: how we test, and why it differs from Void's guide.** Void's testing guide covers
       unit tests in Node with `vi.mock()` for bindings; ours run the real build on the local
       Cloudflare runtime and against the deployed site, with nothing faked. Formatting can only be
       tested on the Worker's own `Intl`, not Node's.
       Done: a paragraph under "What's here", which also says `vp test run` needs a Cloudflare
       login, because Workers AI runs on Cloudflare even locally.
       Backed by: Void `docs/guide/testing.md` (new in 1.8.0; the docs can be read before upgrading).

`packages/void-fbtee/skills/void-fbtee/SKILL.md` is updated with each package change (items 3, 5, 6, 8).

### E. Where the package does what Void already does

10. [x] **Each piece of the package checked against Void's own code** (2026-11-12, at ee4eaa7),
        done when found rather than put off. Changed: - The not-found rule for an unknown language refused every path under no language, so an
        app's own route outside `/api` (`/webhook`) would have got 404. Now only when the route
        that will answer is a page whose first segment is a parameter, found as Void finds it:
        Hono's `matchedRoutes` after the middleware (`packages/void/src/runtime/routing-pages.ts:75-86`),
        from Void's own Hono, resolved beside Void as Void does (`void/dist/index.mjs:4632`).
        Proved with a throwaway route. - `"/"` to the source language moved from middleware code to Void's config redirect
        (`routing.redirects`, 301, `docs/guide/edge/redirects.md`), which runs before any app
        code. `init` adds it, `check` requires it.
        Kept, with why: - The `<meta>` for islands: Void hydrates an island with only its props and frontmatter, no
        shared data (`packages/react/src/plugin-islands.ts:27-44`). - `Link`: Void doesn't re-apply `<html lang dir>` on client navigation (`head.md:133`), so
        a link into another language must reload (`reloadDocument`); Void's `Link` works without
        a router (`runtime/link.tsx`). - `useNow`, `useTimeZone`, `<Formatted>`, `useHydrated`: Void has nothing for these
        (`@void/react` exports `Form`, `Link`, `useRouter`, `useParams`, `useShared`, `useForm`,
        `useNavigation`, `useIslandForm`).
        Already Void's way: `<html lang dir>` and hreflang through `headDefaults`, `c.get("i18n")`
        through `CloudContextVariables`, titles through `head()`, catalogs as virtual modules.

11. [x] **void-fbtee is a Void add-on, packaged as Void's own are.** Void has no plugin API for
        others (`docs/reference/api/plugin.md`: only `voidPlugin()`); its add-ons `@void/md` and
        `@void/react` are Void-only packages with a Vite plugin at `./plugin`, as a named export
        (`voidMarkdown`, `voidReact`), runtime parts beside it, and `vite` (`^8.0.0`) and `void`
        as peers. void-fbtee is the same kind of thing (its middleware, React side, types and
        setup are all Void's), so: `import { voidFbtee } from "void-fbtee/plugin"` (was the default
        export of `void-fbtee/vite`, removed), `src/plugin.ts`, `vite` peer `^8.0.0`, and no `hono`
        peer (Hono comes from Void's own copy). `init`, `check`, the docs in three languages, the
        home page's sample and the fresh-install check follow. A breaking change: the next release
        says so.

## Not in this plan

- The upgrade to Void 1.8.0 and Vite+ 1.6, then the two items that need it: `plans/brisk-copper-wren.md`.
- An API layer or an MCP route for the example: undecided.
- Reports to ICU (Thai time-zone pattern) and Cloudflare (shortened city names).
- The v0.3.0 release notes: text to paste on GitHub.

## Verification

Done 2026-11-12, locally, all in the background: `vp check`; `vp test run` (45 tests, 10 files,
the three new ones included); `vp run test:fresh` (both toolchains; `init` creates
`middleware/99.i18n.ts`). After the push: CI's `vp run test:deployed` against the deployed site,
which includes `test:browsers`.
