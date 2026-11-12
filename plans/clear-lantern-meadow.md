# plans/clear-lantern-meadow.md

Every page's metadata for link previews, search and home screens, complete and in each page's
language, made by existing libraries wherever one does the job, and delivered by void-fbtee as a
Void add-on, Vite plugin and Vite+ package. Rewritten 2026-11-12 after an independent review (17
findings) and a library search; it replaces the earlier drafts. To approve, then do as one piece
of work.

## 0. On Void 1.7.0

The repo pins Void 1.7.0 (`pnpm-workspace.yaml` catalog: `void`, `@void/md`, `@void/react`), and
this work stays on it: the upgrade to 1.8.0 can't happen yet (the user, 2026-11-12). Nothing here
needs 1.8.0: every Void fact below was checked in the `v1.7.0` tag of voidzero-dev/void on
2026-11-12, and line numbers are 1.7.0's. 1.8.0's `_not-found`/`_error` pages aren't used.

## 1. What Void and Vite+ give (Void 1.7.0's docs and source, checked 2026-11-12)

- **One head system, three layers** (`docs/guide/pages-routing/head.md`): `head` in
  `void.config.ts` (fixed for the site), `headDefaults` in middleware (per request), the page's
  `head()` or a markdown page's frontmatter. Page wins; `link` and `script` lists are joined from
  all layers (`packages/void/src/pages/head.ts`, `resolveHead`).
- **Meta tags de-duplicate by `name`/`property`**, by design (head guide's precedence table). So
  `og:locale:alternate` (one per other language) can't go through the head API; HTMLRewriter
  after `next()` could add it, which isn't worth it. Left out.
- **`script` entries** take `innerHTML` and any attribute, rendered on the server only; Void writes
  `innerHTML` as given, unescaped (`head.ts` 162–165).
- **Titles, meta tags and links update on client-side navigation**; scripts don't.
- **Markdown pages:** `<title>` and `description` from frontmatter `title`/`description` only
  (`packages/void/src/router/compile.ts` 1054–1060; `packages/void/src/pages/scan.ts` 563–572).
- **`@void/md/pages`** exists only inside the void-md plugin (its `resolveId`/`load`,
  `packages/md/src/plugin.ts` 288, 365); `@void/md`'s `package.json` exports `./pages` as types
  only. Its `title` falls back to the first heading (`docs/guide/pages-routing/markdown.md` 251); `frontmatter.title`
  doesn't.
- **`public/`** served and cached until the next deploy (`docs/guide/edge/static-assets.md`); with
  middleware, app code runs first ("Navigation and middleware"), hence void-fbtee's hand-off of
  unknown one-segment paths to Void's not-found handler. `.webmanifest` served as
  `application/manifest+json` (`packages/edge/src/static.ts`).
- **`routing.alwaysUseHttps`** (`docs/reference/config.md` 371) redirects `http` to `https`.
- **Not-found pages answer 404** (checked live: `/nope/x`, `/xx-XX/events`), so they aren't
  indexed; no `noindex`. Caveat: a failure in a deferred loader after the page has started
  streaming (the home page uses `defer`) can't change the 200 already sent.
- **Void doesn't give:** tag helpers, structured data helpers, icons, manifest, preview pictures
  (`void/og` is a community request, voidzero-dev/void#442, opened 2026-10-15, with an unmerged
  pull request #688), sitemap, link checking. `void gen` makes models, migrations, routes,
  middleware, SSR, crons, queues only.
- **Vite+ gives nothing here**: the build and tool layer; `public/` is Vite's, served by Void.

## 2. Libraries, one per job (npm versions and dates checked 2026-11-12)

| Job                                                                                          | Library                                             | Version, updated                          | Why it fits                                                                                                                                                                                                                                                                                    |
| -------------------------------------------------------------------------------------------- | --------------------------------------------------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Open Graph, Twitter, `theme-color`, `color-scheme` meta tags                                 | `unhead` (`unhead/utils`, `unpackMeta`)             | 3.4.3, 2026-10-13, MIT                    | A pure function: `{ ogTitle, ogUrl, ogImage: {…}, twitterCard, … }` → `{ property \| name, content }[]`, Void's `meta` shape; knows which tags are `property` vs `name`; typed. Run and checked; needs none of unhead's head manager (`unhead/utils` imports only its own files, under 10 KB). |
| Structured data (JSON-LD)                                                                    | `schema-dts` (Google)                               | 2.1.0, 2026-10-02                         | Types only (devDependency): `WebSite`, `Event` objects checked against schema.org.                                                                                                                                                                                                             |
| Icons                                                                                        | `@vite-pwa/assets-generator`                        | 2.0.0, 2026-10-25                         | In use (`vp run icons`).                                                                                                                                                                                                                                                                       |
| Manifest types                                                                               | `@types/web-app-manifest`                           | 1.0.9, 2026-10-04, MIT                    | Types for what the manifest route returns.                                                                                                                                                                                                                                                     |
| `robots.txt`                                                                                 | none: the plain file in `public/`                   |                                           | `vite-plugin-robots-ts` (2.1.7, 2026-11-10) and the rest only write out text you give them.                                                                                                                                                                                                    |
| Preview picture (one, fixed)                                                                 | `sharp`                                             | already installed with the icon generator | Renders the picture's SVG to PNG once, like the icons.                                                                                                                                                                                                                                         |
| Sitemap XML                                                                                  | `fast-xml-builder`                                  | 1.3.1, 2026-08-14, MIT                    | Pure JS, runs on Workers; tried. `sitemap` (10.0.0) needs Node streams and files, which the Worker doesn't have.                                                                                                                                                                               |
| Preview pictures per page, maybe later                                                       | `@cf-wasm/og` (Satori + resvg packaged for Workers) | 0.5.0, 2026-08-01                         | Solves what #442 says is hard on Workers. Only after Thai and Arabic render right.                                                                                                                                                                                                             |
| Checking: search audits (title, description, hreflang, canonical, `robots.txt`, `lang`, alt) | `lighthouse` / `@lhci/cli`                          | 13.6.0, 2026-11-12 / 0.16.1, 2026-11-11   | Runs unattended against the preview or deployed site.                                                                                                                                                                                                                                          |
| Checking: previews as sharing apps read them                                                 | `open-graph-scraper`                                | 6.13.0, 2026-10-29                        | Reads `og:`/`twitter:` from a page.                                                                                                                                                                                                                                                            |
| Checking: icon set                                                                           | `@realfavicongenerator/check-favicon`               | 0.9.3, 2026-09-19                         | Checks a site's icons and manifest.                                                                                                                                                                                                                                                            |
| Checking: links, markdown included                                                           | `linkinator`                                        | 8.1.0, 2026-08-29                         | Crawls every link; catches markdown dead links Void doesn't.                                                                                                                                                                                                                                   |

Ruled out: `@unhead/schema-org` (a plugin for unhead's head manager), `@unhead/react`,
`react-helmet-async`, `next-seo`, `@nuxtjs/seo`, `astro-seo` (each a framework's own head system);
stale: `workers-og` (2025-06), `og-img` (2024), `vite-plugin-sitemap` (2025-05),
`vite-plugin-robots` (2024), `vite-plugin-favicons-inject` (2023), `generate-robotstxt` (2022),
`broken-link-checker` (2022). Nuxt SEO's module list (robots, sitemap, og-image, schema-org,
link-checker, site-config, ai-ready, skew-protection) was the checklist for this plan.

## 3. What each page gets, and from where

| Tags                                                                                                                                                        | Where                                                                      | How                                                        |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `<title>`, `description`                                                                                                                                    | page `head()` / frontmatter                                                | there, translated                                          |
| `og:title`, `og:description`                                                                                                                                | page `head()`; markdown: middleware from `frontmatter.title`/`description` | `unpackMeta`                                               |
| canonical, hreflang, `x-default`, `og:url`, `og:locale`                                                                                                     | void-fbtee middleware                                                      | `og:url` via `unpackMeta`; one fixed site address, `https` |
| `og:site_name`, `og:type`, `og:image` (+ `:width`, `:height`, `:type`, `:alt`), `twitter:card`, `theme-color`, `color-scheme`, `apple-mobile-web-app-title` | `void.config.ts` `head`, once                                              | `unpackMeta`; `og:image` an absolute URL                   |
| `WebSite` JSON-LD                                                                                                                                           | each language's home page `head()`                                         | `schema-dts` types, escaped                                |
| `Event` JSON-LD                                                                                                                                             | each event page's `head()`                                                 | `schema-dts` types, escaped                                |
| icons, manifest, `robots.txt`                                                                                                                               | `public/` and `void.config.ts`                                             | as below                                                   |
| sitemap                                                                                                                                                     | the app's route `routes/sitemap.xml.ts`, with void-fbtee's language part   | decision 4                                                 |

X cards: only `twitter:card` (`summary_large_image`). X reads the `og:` tags for everything
else: its cards reference lists `og:title`, `og:description`, `og:image` and `og:image:alt` as
the fallbacks for `twitter:title`, `twitter:description`, `twitter:image` and
`twitter:image:alt`, while without `twitter:card` "a summary card may be rendered" (the small one,
no big picture) (developer.x.com/cards/markup, checked 2026-11-12). `twitter:site` (the site's X
account) is left out: there isn't one.

## 4. Decisions (by Claude unless marked, reasons with each)

1. **The site's own address is fixed**, not taken from the request: today an `http://` request gets
   an `http://` canonical (checked live). `routing.alwaysUseHttps: true` in `void.config.ts`, and
   void-fbtee takes the production address as an option of `voidFbtee()` (`site`), used for
   canonical, hreflang and `og:url`. Worker Previews (`<branch>-…workers.dev`) answer with
   `X-Robots-Tag: noindex` so they never compete with the site.
2. **Preview picture: one for the whole site** (decided with the user): the name "void-fbtee" and
   the globe on the site's background, 1200×630, no other words, so it fits every language. Made
   from an SVG with its text as paths (so fonts can't differ between machines) by `sharp`, kept in
   `public/` with a version in its name (`og-1.png`; previews are cached for a long time), linked
   by absolute URL with `og:image:type`. `og:image:alt` is "void-fbtee",
   a name: not translated. Per-page pictures maybe later with `@cf-wasm/og`, after Thai and Arabic
   are rendered and look right.
3. **One manifest, translated in place, served by a route** (decided with the user): Chrome and
   Edge 148 read `*_localized` fields (`name_localized`, `description_localized`, …) in one
   manifest (Chrome blog 2026-04-24, MDN `*_localized`).
   - **A route, not a file:** `routes/manifest.webmanifest.ts` answers `/manifest.webmanifest`
     (the same naming rule as the sitemap) with `application/manifest+json`, building
     `description_localized` for each language from the catalogs as it answers, so it can't
     drift from them. `public/manifest.webmanifest` goes. Cached by Void like the sitemap; a
     deploy brings new catalogs, so nothing needs clearing.
   - **Fields:** today's (name, short name, description, start page, standalone, colours, icons)
     plus `id`, `lang`, `dir` and `description_localized`; the name stays a name.
   - **Types:** `@types/web-app-manifest` (1.0.9, 2026-10-04, MIT) for the manifest; it has
     `lang` and `dir` but no `*_localized`, so the route adds those to the type itself.
   - `start_url` `/` redirects to the source language, so an installed app opens in English:
     said in the README.
   - **Not `vite-plugin-pwa`** (2.0.0, 2026-10-03): it writes one fixed manifest at build, its
     manifest type has no `*_localized`, it always brings a service worker (`workbox-build`;
     offline is out of this plan), and it adds its links by rewriting `index.html`, which Void's
     server-rendered pages don't use.
4. **Sitemap: made when it's requested, by a server route; checked 2026-11-12:**
   - **Why not at build:** visitors post events after every deploy; a build-time sitemap would
     miss them from the first new post.
   - **The route:** `routes/sitemap.xml.ts` answers `/sitemap.xml` (Void strips only `.ts` and a
     `.dev`/`.prod` suffix, `packages/void/src/router/parse-filename.ts`), and void-fbtee's
     middleware lets it through (the answering route isn't a `[lang]` page).
   - **What it lists:** the app's code pages, written in the route with `routeUrl()` so each is
     type-checked (Void has no public runtime list of routes; `virtual:void-routes` is internal);
     markdown pages from `@void/md/pages` (it resolves on the server, and each entry carries its
     `frontmatter`: `MdPage` in `@void/md` 1.7.0's `dist/plugin-*.d.mts`); events from the
     database. Every entry in every language, each listing all the languages including itself,
     plus `x-default`. No `changefreq`/`priority` (Google ignores them).
   - **`<lastmod>`: only real content changes, never when the page was drawn.** Google uses it
     only if it is "consistently and verifiably accurate", and either trusts a site's dates or
     ignores them all (Search Central's sitemap page, as quoted by Yoast and Search Engine
     Journal, checked 2026-11-12; Google's own page refuses fetching). So, per kind of page:
     - **An event** (dynamic): the newest `updated_at` of its `events` row and its `event_texts`
       rows (`apps/example/db/schema/events.ts`, `event_texts.ts`), since translations arrive
       after the post. Not the render time: the page redraws on every visit (the "starts in"
       countdown, seats left), and that isn't a change. Nothing edits an event yet; whatever
       edits one later must set `updated_at`.
     - **The events list:** the newest of those dates across all events: it changes when an event
       is posted or changes, and only then.
     - **A markdown page** (static): its frontmatter's `updated`, the date the docs layout already
       shows (`apps/example/src/components/DocsLayout.tsx`, `Updated`); each language's copy has
       its own.
     - **A code page** (static): no `<lastmod>`: there's no honest date, and Google's advice is to
       leave it out rather than give a wrong one.
   - **Cached by Void, cleared when events change:** a long entry for `/sitemap.xml` in
     `routing.revalidate` (or `x-revalidate` on the response), and `revalidate({ paths:
     ["/sitemap.xml"] })` from `void/isr` wherever an event is created or changed
     (`docs/guide/edge/revalidation.md`, "Per-response TTL override", "On-demand revalidation").
   - **The XML: `fast-xml-builder`** (1.3.1, 2026-08-14, MIT; the writer of `fast-xml-parser`,
     5.12.0, 2026-11-03): no Node built-ins, two small pure-JS dependencies; tried: it writes
     `<urlset>` with `xhtml:link` alternates and escapes values (`a&b<c>` → `a&amp;b&lt;c&gt;`).
     Not `sitemap` (10.0.0): it imports `node:stream`, `node:fs`, `node:zlib`,
     `node:child_process`, `node:readline`, and the Worker has only the `temporal` and
     `nodejs_als` flags (`apps/example/dist/ssr/wrangler.json`).
   - **Google's rules** (Search Central, "Build and submit a sitemap"): one file up to 50,000 URLs
     or 50 MB uncompressed, else a sitemap index; values entity-escaped. Far under the limit
     here; an index when events approach it.
   - **`robots.txt`** gains `Sitemap: <site>/sitemap.xml`.
   - The hreflang in the sitemap and in the pages come from the same void-fbtee function, so
     they can't disagree.
5. **Structured data** through one escaping helper in the package (`jsonLd(obj)`: `JSON.stringify`
   with `<`, U+2028 and U+2029 escaped), never raw `innerHTML`: event names come from visitors.
   `WebSite` on each language's home page (Google reads it only on a site's root home page, here a
   redirect, so it may be ignored: harmless). `Event` with `name`, `startDate` (Temporal
   `toString({ timeZoneName: "never" })`: the offset, no `[Zone]`), `location` as a `Place` with
   an `address`, `eventStatus`, `eventAttendanceMode`, `inLanguage`.
6. **hreflang only on pages in a language**: today the middleware adds alternates to every path,
   pointing at pages that don't exist for paths outside a language (`middleware.ts` 92–99, 119).
7. **`og:locale:alternate` left out** (§1); at most a feature request to Void later, with the
   user's OK. Facebook's locale list uses `ar_AR`, not `ar_EG`; low impact, noted.

8. **Caching, done first, the Void way** (the user, 2026-11-12: caching before anything else).
   Void has two tools, both in Void 1.7.0 (`docs/guide/edge/prerendering.md`,
   `docs/guide/edge/revalidation.md`), and nothing new is built:
   - **Prerendering, for pages only a deploy changes:** `export const prerender = true` in the
     page's `.server.ts`. Void renders it once per deploy, before traffic reaches the new version,
     and keeps it until the next deploy ("Prerendered pages default to a one-year revalidate TTL.
     Deploys clear the ISR cache."). Markdown pages are prerendered automatically (today's
     `x-isr-cache: HIT` on `/en-US/docs/tour`, checked live 2026-11-12). A page with a URL param
     needs `getPrerenderPaths()`, and every page here sits under `[lang]`, so each lists its
     languages.
   - **Revalidation, for pages made from data:** `export const revalidate = <seconds>` (the cache
     time), and `revalidate({ paths })` from `void/isr` wherever the data changes. Void serves the
     cached page while it renders a fresh one, so nobody waits.
   - **Each page, checked in its code 2026-11-12:**

     | Page                                             | Changes when                                            | How                                                                                                                                                |
     | ------------------------------------------------ | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
     | Home (`pages/[lang]/index`)                      | a deploy (its `defer` is a fixed demo)                  | prerender                                                                                                                                          |
     | Docs home, Intl, Temporal (`pages/[lang]/docs`)  | a deploy (fixed dates; no current time)                 | prerender                                                                                                                                          |
     | Markdown docs                                    | a deploy                                                | prerendered already                                                                                                                                |
     | Events list (`events/index`)                     | a post, and time (only events not yet started, line 22) | `revalidate = 60`; cleared on posting (already, line 50)                                                                                           |
     | An event (`events/[id]`)                         | a booking (seats left), translations arriving           | `revalidate = 31536000` (until the deploy); cleared on booking (already, line 55) and when translations arrive (already, `queues/translate.ts` 62) |
     | `/sitemap.xml`, `/manifest.webmanifest` (routes) | a post or translations (sitemap); a deploy (manifest)   | an entry each in `routing.revalidate` (`void.config.ts`), `31536000`; the sitemap added to the posting and translation `revalidate()` calls        |

     Today none but the markdown pages are cached: no page sets a cache time.

   - **Pages set their own; routes need `void.config.ts`:** a page's cache time is its own
     export. A route has no page, and Void decides whether to cache a path before it runs any
     code: no cache time from a page or `routing.revalidate` means no caching, and an
     `x-revalidate` header can then change nothing (`packages/isr/src/runtime.ts`,
     `handleIsrInternal`: `if (isrTtl <= 0) return null`, Void 1.7.0). So `/sitemap.xml` and
     `/manifest.webmanifest` get entries in `routing.revalidate`. XML and JSON are cached like
     HTML (`handleIsr` passes `htmlOnly: false`).
   - **Where copies live:** each Cloudflare location's own cache first, then Workers KV, keyed by
     the deployment's id (`htmlEdgeKey(host, pathname, deploymentId, …)`, same file): that's how
     a deploy "clears" the cache; the new version just never sees the old copies.
   - **Times relative to now are safe in a cached copy** (checked 2026-11-12): "tomorrow", "in
     44 days" come only from `EventTime` and `Fmt`, which show them once the browser knows the
     reader's zone, through `useNow()` (`packages/void-fbtee/src/react.tsx` 99), which switches
     to the browser's clock on load. The only server-side "now" is the events list's query
     (`events/index.server.ts` 22), hence its 60 seconds.
   - **`https` first:** the canonical is built from the request's origin today
     (`middleware.ts`), so a copy cached from one `http://` visit would hand everyone an `http`
     canonical. `routing.alwaysUseHttps: true` (decision 1) goes in with the caching, in the same
     step.
   - **Not known yet, found out by trying:** whether prerendering a page with a loader works
     through void-fbtee's middleware the way markdown pages already do (they're prerendered and
     right in all three languages live, which suggests so). The first step of this work is
     putting the cache settings in, deploying, and reading `x-isr-cache` on every page.
   - **void-fbtee's part:** a `langParams()` export, each language as `{ lang }` typed as
     `PageParams<"/:lang">[]` (Void's `void/routes`), so a page's `getPrerenderPaths` is
     `export const getPrerenderPaths = langParams;`, and adding a language prerenders it
     everywhere. Beside `localizedPaths()` in `void-fbtee/middleware`.
   - **Never cached, by Void's rules:** `/api/*`; requests with a cookie or `Authorization`;
     responses with `Set-Cookie`, `Cache-Control: private`/`no-store`, or `Vary` on a request
     header. void-fbtee's middleware must never add one of those to a page, or the page silently
     stops being cached: a test checks the headers.
   - **Files in `public/`** (icons, the preview picture, `robots.txt`): Void's static files, cached
     until the next deploy (`docs/guide/edge/static-assets.md`); they stay files, since drawing
     PNGs needs `sharp`, which doesn't run on Workers.
   - **Proof:** after the deploy, the prerendered pages answer `x-isr-cache: HIT` on their first
     visit, the others on their second; a new event shows in the list and the sitemap at once; a
     booking changes the seats left at once.

## 5. The package's part (Void add-on, Vite plugin, Vite+ package)

What's per language is void-fbtee's; the site's brand (name, picture, icons) is each app's.

1. **`voidFbtee({ site })`**: the production address (decision 1). `init` asks for it, or leaves a
   todo when it can't tell.
2. **A new entry, `void-fbtee/head`**: `pageHead({ title, description })` (accepting `fbs` results,
   as pages pass today) returns the title, description, `og:title`, `og:description` through
   `unpackMeta`; and `jsonLd(obj)` (decision 5). `unhead` becomes a dependency; `schema-dts` a
   devDependency. Built by `vp pack` as a new entry (`packages/void-fbtee/vite.config.ts`), so
   tsdown writes its `exports` line, and publint, attw and `unused` check it on every build.
3. **The middleware**: canonical, hreflang and `og:url` from `site`; hreflang only when the path
   has a language; for markdown pages `og:title`/`og:description` from `frontmatter.title` and
   `frontmatter.description` (trailing slashes normalised when matching paths).
4. **Markdown pages without a peer on `@void/md`**: the plugin checks, in `configResolved`, whether
   a plugin named `void-md` is in the app's plugins (as void-md itself detects its adapters,
   `packages/md/src/plugin.ts` 215). Its `virtual:void-fbtee/md-pages` then loads
   `export { default } from "@void/md/pages"`, else `export default []`. No peer declared (a
   declared, never-imported peer fails the `unused` check). The virtual module's type in
   `src/virtual.d.ts` is the package's own (`path`, `frontmatter`), so the built types don't
   reach for `@void/md`. `@void/md` a devDependency, for the test.
5. **The sitemap's part in the package**: `void-fbtee/head` gains `alternates(path)`, a page's
   address in every language plus `x-default`, from the `site` option; the middleware uses it for
   hreflang, and the app's `routes/sitemap.xml.ts` for each entry, writing the XML with
   `fast-xml-builder` (the app's dependency, not the package's: the sitemap is the app's route).
6. **`check`** reports a translated markdown copy without the `title` or `description` its
   original has.
7. **`init`** adds the `site` option (item 1); the rest needs no setup.
8. **Docs that ship:** SKILL.md (pages use `pageHead()`; `jsonLd()` for structured data; markdown
   copies keep a translated `title` and `description`), package README (`site`, the site-wide tags
   in `void.config.ts`, the picture, the icons, the manifest's `*_localized` fields, the sitemap).
9. **Release:** version 0.3.0 → 0.4.0 (new entry, new option, new dependency), the install tag in
   the package README updated (README "Releasing").
10. **`useNow()` keeps time on open pages** (the user, 2026-11-12): today it reads the browser's
    clock once (`browserNow`, `packages/void-fbtee/src/react.tsx` 121), so a page left open
    overnight still says "tomorrow". `useNow({ updateInterval })` re-reads it every so many
    milliseconds, as next-intl's `useNow` does (next-intl docs, "Now value", checked
    2026-11-12); without the option, as today. `EventTime` and `Fmt` pass one minute. A test
    shows the text changing when the clock moves past midnight.
11. **Dev note**: void-md refreshes its pages list through `server.moduleGraph` (`plugin.ts` 252);
    if the worker keeps a stale `og:title` after a frontmatter edit until restart, say so in the
    README rather than work around it.

## 6. Proof

- **Package tests:** `pageHead()`; `jsonLd()` with `</script>` and U+2028 in a value; the
  in-memory plugin test (`test/plugin.test.ts`) for `virtual:void-fbtee/md-pages` with and
  without void-md in the plugins; the sitemap entries in every language.
- **Server tests (example):** every page in every language: the whole table in §3 against that
  language's strings; an event posted with `</script><script>` in its name doesn't break out;
  hreflang absent outside a language; `http` redirected to `https` where Void does it.
- **Fresh apps** (pnpm and npm, Vite+ and plain Vite): each language's page has canonical,
  `og:url` and `og:locale`, and `og:title` in that language from an `index.server.ts` using
  `pageHead()` (added to `e2e/fresh/app/pages/[lang]/`).
- **Outside tools, unattended, as one task (`vp run check:site`), not in every test run** (CI stays
  lean): `lighthouse` (SEO category) and `linkinator` over the site, `open-graph-scraper` on each
  language's page, `check-favicon`; run at the end of this work against the deployed site, and
  whenever the head or the pages change. Google's Rich Results Test and Facebook's sharing debugger need a person: a one-off check
  after the deploy, by hand.
- Each new check shown to fail when what it guards is broken. Then `vp check`, `vp test run`,
  `vp run test:fresh`, `void deploy` from here, and the live pages checked.

## Not in this plan

- Offline support (a service worker, `vite-plugin-pwa`): its own trial, reported before anything
  is added; how it composes with `voidFbtee()` in Void's environments is unknown.
- Per-page preview pictures (decision 2).
- `llms.txt` (an AI-readable summary of the site): worth its own small plan once the docs settle.
