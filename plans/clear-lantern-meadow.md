# plans/clear-lantern-meadow.md

Every page's metadata for link previews, search and home screens, complete and in each page's
language, made by existing libraries wherever one does the job, and delivered by void-fbtee as a
Void add-on, Vite plugin and Vite+ package. Rewritten 2026-11-12 after an independent review (17
findings) and a library search; it replaces the earlier drafts. To approve, then do as one piece
of work.

## 0. First: Void 1.8.0

The repo pins Void 1.7.0 (`pnpm-workspace.yaml` catalog: `void`, `@void/md`, `@void/react`). This
work needs 1.8.0 (released 2026-11-12): the `_not-found`/`_error` pages
(`docs/guide/pages-routing/errors.md`) don't exist in 1.7.0, and every Void line cited here is
1.8.0's. So: the catalog to 1.8.0, `vp install`, `vp run check:tools`, the tests; the package's
peer range `void ^1.7.0` checked against what it then uses (`plans/brisk-copper-wren.md` item 2).

## 1. What Void and Vite+ give (full sweep of Void 1.8.0's docs and source, 2026-11-12)

- **One head system, three layers** (`docs/guide/pages-routing/head.md`): `head` in
  `void.config.ts` (fixed for the site), `headDefaults` in middleware (per request), the page's
  `head()` or a markdown page's frontmatter. Page wins; `link` and `script` lists are joined from
  all layers (`packages/void/src/pages/head.ts`, `resolveHead`).
- **Meta tags de-duplicate by `name`/`property`**, by design (head guide's precedence table). So
  `og:locale:alternate` (one per other language) can't go through the head API; HTMLRewriter
  after `next()` could add it, which isn't worth it. Left out.
- **`script` entries** take `innerHTML` and any attribute, rendered on the server only; Void writes
  `innerHTML` as given, unescaped (`head.ts` 160–166).
- **Titles, meta tags and links update on client-side navigation**; scripts don't.
- **Markdown pages:** `<title>` and `description` from frontmatter `title`/`description` only
  (`packages/void/src/router/compile.ts` 1123–1135; `packages/void/src/pages/scan.ts` 706–719).
- **`@void/md/pages`** exists only inside the void-md plugin (its `resolveId`/`load`,
  `packages/md/src/plugin.ts` 288, 365); `@void/md`'s `package.json` exports `./pages` as types
  only. Its `title` falls back to the first heading (`markdown.md` 251); `frontmatter.title`
  doesn't.
- **`public/`** served and cached until the next deploy (`docs/guide/edge/static-assets.md`); with
  middleware, app code runs first ("Navigation and middleware"), hence void-fbtee's hand-off of
  unknown one-segment paths to Void's not-found handler. `.webmanifest` served as
  `application/manifest+json` (`packages/edge/src/static.ts`).
- **`routing.alwaysUseHttps`** (`docs/reference/config.md` 372) redirects `http` to `https`.
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

| Tags                                                                                                                                                                             | Where                                                                      | How                                                        |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `<title>`, `description`                                                                                                                                                         | page `head()` / frontmatter                                                | there, translated                                          |
| `og:title`, `og:description`                                                                                                                                                     | page `head()`; markdown: middleware from `frontmatter.title`/`description` | `unpackMeta`                                               |
| canonical, hreflang, `x-default`, `og:url`, `og:locale`                                                                                                                          | void-fbtee middleware                                                      | `og:url` via `unpackMeta`; one fixed site address, `https` |
| `og:site_name`, `og:type`, `og:image` (+ `:width`, `:height`, `:type`, `:alt`), `twitter:card`, `twitter:image:alt`, `theme-color`, `color-scheme`, `apple-mobile-web-app-title` | `void.config.ts` `head`, once                                              | `unpackMeta`; `og:image` an absolute URL                   |
| `WebSite` JSON-LD                                                                                                                                                                | each language's home page `head()`                                         | `schema-dts` types, escaped                                |
| `Event` JSON-LD                                                                                                                                                                  | each event page's `head()`                                                 | `schema-dts` types, escaped                                |
| icons, manifest, `robots.txt`                                                                                                                                                    | `public/` and `void.config.ts`                                             | as below                                                   |
| sitemap                                                                                                                                                                          | the app's route `routes/sitemap.xml.ts`, with void-fbtee's language part   | decision 4                                                 |

`twitter:title`/`description`/`image` aren't added: X reads the `og:` ones. `twitter:image:alt`
is (X doesn't fall back to `og:image:alt`).

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
   by absolute URL with `og:image:type`. `og:image:alt` and `twitter:image:alt` are "void-fbtee",
   a name: not translated. Per-page pictures maybe later with `@cf-wasm/og`, after Thai and Arabic
   are rendered and look right.
3. **One manifest, translated in place**: Chrome and Edge 148 read `*_localized` fields
   (`name_localized`, `description_localized`, …) in one manifest (Chrome blog 2026-04-24, MDN
   `*_localized`). Add `id`, `lang`, `dir` and `description_localized` for each language from the
   catalogs; the name stays a name. `start_url` `/` redirects to the source language, so an
   installed app opens in English: said in the README.
4. **Sitemap: made when it's requested, by a server route; checked 2026-11-12:**
   - **Why not at build:** visitors post events after every deploy; a build-time sitemap would
     miss them from the first new post.
   - **The route:** `routes/sitemap.xml.ts` answers `/sitemap.xml` (Void strips only `.ts` and a
     `.dev`/`.prod` suffix, `packages/void/src/router/parse-filename.ts`), and void-fbtee's
     middleware lets it through (the answering route isn't a `[lang]` page).
   - **What it lists:** the app's code pages, written in the route with `routeUrl()` so each is
     type-checked (Void has no public runtime list of routes; `virtual:void-routes` is internal);
     markdown pages from `@void/md/pages` (it resolves on the server); events from the database,
     each with its `updatedAt` as `<lastmod>`. Every entry in every language, each listing all
     the languages including itself, plus `x-default`. No `<lastmod>` where there's no honest
     date (markdown, code pages); no `changefreq`/`priority` (Google ignores them).
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
10. **Dev note**: void-md refreshes its pages list through `server.moduleGraph` (`plugin.ts` 252);
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
