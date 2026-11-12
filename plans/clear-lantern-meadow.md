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

## What Void allows (checked in Void 1.8.0's source and docs, 2026-11-12)

- **Precedence:** page `head()` > middleware `headDefaults` > `void.config.ts` `head`
  (`packages/void/src/pages/head.ts`, `resolveHead`). The middleware runs before the page's head,
  so it can't see the page's title: tags built from the title belong to the page.
- **Void's own example puts `og:title` in the page's `head()`** beside the description
  (`docs/guide/pages-routing/head.md`, "Page titles and metadata").
- **Meta tags are de-duplicated by `property`/`name`** (`resolveHead`, lines 43–56): a repeated
  property such as `og:locale:alternate` keeps only the last. A Void limitation, worth reporting.
- **Markdown pages without a `.server.ts`:** Void makes their head from frontmatter `title` and
  `description` only (`packages/void/src/router/compile.ts` 1123–1135). A markdown page gets other
  tags only through a companion `.server.ts` with `head()` (supported: markdown.md, "File
  Structure"), or through a change in Void.
- **No Open Graph image tool in Void yet:** Satori-based image generation is an open Void request
  (voidzero-dev/void#442).

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

## To decide (by Claude, reasons with each)

1. **Who writes the tags:** code pages from their own `head()` (Void's example), through one
   void-fbtee function so each page adds one line; markdown pages from their frontmatter, read
   from `@void/md/pages` by the middleware (void-fbtee's, with @void/md optional, as `void-fbtee/lint`
   treats Vite+).
2. **`og:image`:** per item 3 above.
3. **Manifest per language:** one per language, linked from that language's pages, name and
   description through the same catalogs.
4. **`og:locale:alternate`:** report Void's de-duplication (with the user's OK), as #802 was.

## Also in this work (left out of the first draft)

- **Structured data** (JSON-LD, schema.org): `WebSite` with `inLanguage` on every page, `Event`
  for each event page (name, start with its time zone, place), so search can show events.
- **`noindex`** on the not-found and error pages, and those pages translated
  (`plans/brisk-copper-wren.md` item 3, done together).
- **`color-scheme`** (`dark`), and `apple-mobile-web-app-title`.
- **Offline (service worker)**: a separate trial of vite-plugin-pwa with Void, reported before
  anything is added; not done blind.
- **Checked from outside:** each language's page through a link-preview validator and Google's
  Rich Results test, not only our own tests.

## Proof

A server test reads every page in every language and checks the whole table above against that
language's own strings; one tag removed shows it failing. Then `vp check`, `vp test run`,
`void deploy`, and the live pages checked with a link-preview check.
