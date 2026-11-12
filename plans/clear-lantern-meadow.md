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

## To decide (by Claude, reasons with each)

1. **Code pages** (home, events, docs index, Intl, Temporal): each `head()` returns
   `og:title`/`og:description`/`og:type` and `twitter:*` from its own translated strings, as in
   Void's example. To keep that one line per page instead of a copy of eight tags, void-fbtee may
   export a small function that turns `{ title, description, image }` into the full set for the
   page's language (it knows the language, the canonical URL and `og:locale`). Check first whether
   an established library does this for a plain `HeadDescriptor` (e.g. unhead's `useSeoMeta`
   builds the same set but needs unhead's own head manager, which Void doesn't use).
2. **Markdown pages:** a companion `.server.ts` per page that reads the page's frontmatter, or a
   feature request to Void to map frontmatter to Open Graph. Decide after reading how a `head()`
   in a markdown page's `.server.ts` can get its frontmatter.
3. **`og:image`:** one static picture per language now (1200×630, in `public/`), made the same
   way as the icons if a standard tool can; per-page pictures when Void's #442 lands.
4. **Manifest per language:** one file per language, linked from each language's pages, with the
   name and description translated through the same catalogs.
5. **`og:locale:alternate`:** report the de-duplication to Void (with the user's OK), the way
   #802 was.

## Proof

A server test reads every page in every language and checks the whole table above against that
language's own strings; one tag removed shows it failing. Then `vp check`, `vp test run`,
`void deploy`, and the live pages checked with a link-preview check.
