# plans/many-languages.md: what grows when an app has every language

Status: proposed 2026-11-14, not in the order yet (`plans/README.md`, "Not in the order"). The
example has three languages and will grow towards all of them (the user, 2026-11-14). Nothing here
has been measured yet: this plan is to measure first, then fix what doesn't hold.

## Already fixed

- `<InLanguage>` in the browser loaded every language's catalog before showing one line
  (`packages/void-fbtee/src/react.tsx`, `allTranslations(catalogs)`, built in fbtee-fully). It now
  loads its own language's, its fallbacks' and the source's (`translationsFor()` in
  `src/runtime.ts`), with a unit test (2026-11-14).

## To measure, with a generated app of ~100 languages

- **The Worker's size:** every catalog is bundled into it. Cloudflare's limit on a Worker's size
  is to be read from Cloudflare's docs with the date, then compared with the built size.
- **Every request loading every catalog on the server:** `allTranslations(catalogs)` in
  `src/server.ts` and `src/middleware.ts`, merged per request. Its time and memory.
- **Each page's hreflang list** (one link per language in the head) and **the sitemap** (every page
  times every language, against Google's per-file limits, read from Google's docs with the date).
- **The header's language links:** one per language on every page.
- **Translating:** `void-fbtee translate` and the catalogs' size in the repo, per string added.

## How we'll know

Each item gets a number from the generated app, written here with the date, and a fix where it
doesn't hold. Then `vp check`, the tests, and the fresh apps.
