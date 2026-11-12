# plans/clear-lantern-meadow.md

Every page's metadata for link previews, search and home screens, complete and in each page's
language, done the way Void lays head tags out. Written 2026-11-12, after `fb26cfc`, which added
only icons, the manifest, `robots.txt`, the canonical link and `og:locale`. That was a part, not
the whole; this is the whole, to approve and do as one piece of work.

## What a page needs, and what's there

| Tag                                                             | Where it comes from                                      | Today                                               |
| --------------------------------------------------------------- | -------------------------------------------------------- | --------------------------------------------------- |
| `<title>`, `description`                                        | the page's `head()` (code pages), frontmatter (markdown) | there, translated                                   |
| canonical                                                       | void-fbtee middleware                                    | there                                               |
| `hreflang` alternates, `x-default`                              | void-fbtee middleware                                    | there                                               |
| `og:locale`                                                     | void-fbtee middleware                                    | there                                               |
| `og:locale:alternate` (one per other language)                  | —                                                        | impossible in Void 1.8.0: one meta tag per property |
| `og:title`, `og:description`                                    | the page's own title and description                     | missing                                             |
| `og:url` (same as canonical), `og:type`, `og:site_name`         | per page / per site                                      | missing                                             |
| `og:image`, `og:image:width`, `og:image:height`, `og:image:alt` | a picture, its alt text translated                       | missing (no picture)                                |
| `twitter:card`, title, description, image                       | as Open Graph                                            | missing                                             |
| `apple-mobile-web-app-title`                                    | site name                                                | missing                                             |
| manifest `name`, `short_name`, `description`, `lang`, `dir`     | per language                                             | English only                                        |
| icons, `theme-color`, `robots.txt`                              | `void.config.ts`, `public/`                              | there                                               |

## What Void and Vite+ give (full sweep, 2026-11-12)

Every page of Void 1.8.0's docs (106 files under `docs/`) searched for sitemap, robots, llms,
JSON-LD, noindex, favicon, manifest, `og:`, twitter, canonical, hreflang, i18n, locale, `public/`,
`_headers`, `titleTemplate`, `headDefaults`, `script`; the matches read; `void gen`'s generators
and Void's packages' source searched too; and Vite+'s docs (`node_modules/vite-plus/docs`).

**Void gives (and this work uses):**

- **One head system, three layers** (`docs/guide/pages-routing/head.md`): `head` in
  `void.config.ts` (site-wide: the icon links, `theme-color`, `color-scheme`), `headDefaults` in
  middleware (void-fbtee: `lang`/`dir`, hreflang, canonical, `og:locale`), and the page's
  `head()` or, for markdown, its frontmatter. Page wins; `link` and `script` are concatenated.
- **Meta tags de-duplicate by `name`/`property`**, documented in the head guide's precedence
  table: by design, so `og:locale:alternate` (one tag per other language) can't be expressed. A
  feature request to Void at most, not a bug report.
- **`script` entries take `innerHTML` and any attribute**: structured data goes in as
  `{ type: "application/ld+json", innerHTML: JSON.stringify(…) }`, the Void way. Scripts are
  rendered on the server only (not re-applied on client-side navigation), which is what search
  engines read.
- **Titles, meta tags and links update on client-side navigation**, so the Open Graph tags follow
  the page.
- **Markdown pages:** frontmatter `title` and `description` only (`head.md`, "Markdown pages";
  `packages/void/src/router/compile.ts` 1123–1135).
- **`public/`:** files served as they are, cached until the next deploy
  (`docs/guide/edge/static-assets.md`); with middleware, application code runs first
  ("Navigation and middleware"), which is why void-fbtee hands unknown one-segment paths to
  Void's not-found handler. `.webmanifest` is served as `application/manifest+json`
  (`packages/edge/src/static.ts`).
- **Not-found and error pages** (`_not-found`, `_error`, `docs/guide/pages-routing/errors.md`)
  answer with their real status (404, 500), so search engines don't index them: no `noindex`
  needed.

**Void doesn't give:** icon or manifest generation, Open Graph or Twitter tag helpers, preview
pictures (only the community request #442 below), structured data helpers, a sitemap. `void gen`
makes models, migrations, routes, middleware, SSR, crons and queues only.

**Vite+ gives nothing here:** it's the build and tool layer; `public/` is Vite's, served by Void.

## Answered (2026-11-12)

1. **Markdown pages can get their Open Graph tags from their own frontmatter**, with no
   `.server.ts` per page per language: `@void/md/pages` (each page's path, title, frontmatter)
   resolves on the server as well as in the browser (`packages/md/src/plugin.ts`, the
   `@void/md/pages` virtual module; the docs layout already reads it while the page renders). What
   reads it for the head (app middleware, or void-fbtee's when the app has @void/md) is item 1
   below.
2. **No established library builds Open Graph tags as a plain `HeadDescriptor`:** unhead's
   `useSeoMeta` builds the set but needs unhead's own head manager, which Void doesn't use. So a
   small function in void-fbtee (it knows the language, canonical URL and `og:locale`) is the
   honest option, not a reinvented library.
3. **Preview pictures:** `satori` (0.63.2, updated 2026-10-20) and `@vercel/og` (1.0.3,
   2026-09-22) are current; `workers-og` (0.0.27, 2025-06-12) isn't. But Satori's right-to-left
   support has been broken (vercel/satori#745: Arabic "rendered left-aligned with incorrect word
   ordering", still open when found) and Thai/Arabic shaping came in another change (#735);
   whether 0.63.2 has either is unknown. A Thai and an Arabic picture must be rendered and looked
   at before choosing it; if they're wrong, static pictures per language, made once.

## Decided (by Claude, 2026-11-12, reasons with each)

1. **Who writes which tags**, each at the one layer that knows it:
   - **`void.config.ts` `head`, once for the site** (they never change): `og:site_name`,
     `og:type` (`website`), `og:image` with `og:image:width`/`height`/`alt` (the picture has only
     the name on it, so its alt text, "void-fbtee", is a name and isn't translated),
     `twitter:card` (`summary_large_image`), `apple-mobile-web-app-title`, `color-scheme`.
   - **void-fbtee middleware, per language** (it knows the language and the address): canonical,
     hreflang, `og:locale` (there today), and `og:url`, the same address as the canonical.
   - **Each code page's `head()`**: `og:title` and `og:description` from its own translated
     strings, through one small void-fbtee function that returns its title, description and
     those two tags together, so a page adds no extra lines (Void's own example puts `og:title`
     in the page's `head()`).
   - **Markdown pages**: `og:title` and `og:description` from their frontmatter, added by
     void-fbtee's middleware from `@void/md/pages` when the app has `@void/md` (optional, as
     `void-fbtee/lint` treats Vite+), since a markdown page has no `head()` of its own.
   - **No `twitter:title`/`description`/`image`**: X reads the `og:` tags when its own are missing
     (X's "About Cards", via specification.website's Open Graph page, checked 2026-11-12).
2. **`og:image`: decided (2026-11-12, with the user): one picture for the whole site**, as most
   sites do (one site-wide picture is the norm; per-page pictures are for things shared on their
   own, such as posts and products). No sentence on it, only the name "void-fbtee" (a name, not
   translated) and the globe from `public/favicon.svg` on the site's background, so the same
   picture fits every language: the preview's title and description already come in the page's
   language from its own tags. 1200×630, made once and kept in `public/` (made the same way as
   the icons if a standard tool can, else from an SVG). Only `og:image:alt` is translated. Per-page
   pictures (an event's name on its page) maybe later, if Void takes up `void/og`: requested in
   voidzero-dev/void#442 (opened 2026-10-15 by someone outside the Void team, still open; it
   notes recent Satori versions don't run on Workers out of the box) with an open pull request,
   #688, not merged (both checked 2026-11-12). Only after a Thai and an Arabic picture are
   rendered and look right (item 3 above).
3. **One manifest, not one per language**: its only visible words are the app's name, a name
   that isn't translated; one manifest is what multilingual sites normally have.
4. **`og:locale:alternate` left out**: Void's de-duplication is documented, by design; at most a
   feature request to Void later, with the user's OK.

## Also in this work (left out of the first draft)

- **Structured data** (JSON-LD, schema.org) through head `script` entries: `WebSite` with
  `inLanguage` on every page, `Event` for each event page (name, start with its time zone,
  place), so search can show events.
- **The not-found and error pages translated** (`plans/brisk-copper-wren.md` item 3, done
  together; no `noindex`, their 404/500 status keeps them out of search).
- **Offline (service worker)**: a separate trial of vite-plugin-pwa with Void, reported before
  anything is added; not done blind.
- **Checked from outside:** each language's page through a link-preview validator and Google's
  Rich Results test, not only our own tests.

## Proof

A server test reads every page in every language and checks the whole table above against that
language's own strings; one tag removed shows it failing. Then `vp check`, `vp test run`,
`void deploy`, and the live pages checked with a link-preview check.
