# plans/one-copy-each.md: one copy of each thing, and the two bugs the copies caused

Status: changes 1 and 2 done 2026-11-14 (not pushed).

## Why

A read-only review of the whole repo (2026-11-14) found the same code written several times,
and two places where copies had already drifted into bugs:

1. **`void-fbtee check` misses a translated page with no title or description.** The package finds a
   markdown page's frontmatter with three different regexes (`packages/void-fbtee/src/check.ts:68`,
   `check.ts:81`, `translate.ts:81`). The one `missingHead` uses only matches at the very start of the
   file, and every page in the example starts with its `<script>` block, so the check reads no
   frontmatter and reports nothing. The unit test only has pages that start with frontmatter.
2. **The sitemap test lists `/docs/pdfs` twice** (`e2e/preview/server.test.ts`, the third of three
   copies of the page list).

## What stays repeated, and why

Void reads some exports from each file without running it, so they can't come from a shared module:
a page's `prerender`, `getPrerenderPaths`, `revalidate` and `head` (Void's
`guide/pages-routing/overview.md`, `guide/edge/revalidation.md`), a queue's options
(`guide/queues.md`, "Consumer options"), and a cron's schedule. Each markdown folder keeps its
one-line layout re-export (Void applies layouts by folder). fbtee's strings stay literal at each use
(its collector reads them as written). Things that only look alike stay too: `init`'s starter files
for other apps, the email's date format against the site's, the two flap keyframes.

## Change 1: the bugs and the biggest copies

1. **Frontmatter, once (package).** `check.ts` gets `frontmatter(text)`: it skips a leading
   `<script>…</script>`, accepts CRLF, and returns where the block is and its YAML. `missingHead`,
   `splitPage` and `stamp` use it; the `translatedFrom` line regex is exported once. A unit test with
   a page that starts with `<script>` and lacks a title: check reports it (it doesn't today).
2. **End-to-end tests use the helpers they have.** `postEvent` gets `description` and `locale`
   options; a `deleteInPage(page)` helper joins `deleteEvent` and `book` in `e2e/helpers.ts`.
   `e2e/preview/events.test.ts`, `e2e/preview/cache.test.ts` and `e2e/deployed/live.test.ts` use them
   instead of their own copies (about 70 lines). In `e2e/preview/server.test.ts`: one page list (which
   fixes the duplicate entry), one `postBooking()`, and `SITE` imported from the app's `src/site.ts`.
3. **Docs pages share their frame.** `src/docs/DocsPage.tsx` holds the heading, intro and
   on-this-page list the 8 code docs pages copy; the Emails page also uses `Section` instead of
   writing each section title twice. Titles and intros stay literal `<fbt>`, passed in.
4. **Intl and Temporal share their results table.** `src/docs/RowsSection.tsx` (the table with its
   code row, `data-row`, `data-side` and `data-differs` kept exactly, which the browser tests read)
   and `useBrowserOnce()` for the "work it out once in the browser" hook both pages copy.
5. **The PDF and picture routes share their handler.** `src/pdf.ts` gets `printedResponse()` (print,
   or 503 with retry-after when Browser Run can't, or 404) and one private `quick()` for
   `printPdf` and `printImage`; each route becomes a few lines.

## Change 2: the smaller copies

6. **Package internals:** `sourceOf()` and `translatedOf()` in `locales.ts` for the 11 locale
   lookups; `runIn()` in `server.ts` for the 3 places that run code in a language;
   `src/app-files.ts` for what `init` and `check` both read (middleware, config file names, Vite+,
   the skill's folder); `readMeta()` for the `<meta name="void-fbtee">` read.
7. **App:** `SeatsLeft` moved to `Flap.tsx` and used on the event page; an `ErrorShell` for the
   not-found and error pages; a `Field` for the 8 form fields; `textsFor()`, `titleFor()` and
   `eventPaths()` in `src/events/translations.ts`; `isZone`, a hash helper, the key cookie and the
   private link each written once; `SITE_NAME`; "Docs" and "Events" through fbtee's common strings
   (3 fewer catalog entries a language); one origin fallback (`??` vs `||` differs today).
8. **Scaffolding:** `scripts/production-url.ts` for the two scripts that test the last deploy; the
   dev and preview test setups share how they start a server; one `copyFixture()` for the unit
   tests; one function for the e2e projects in `vite.config.ts`; a composite action
   `.github/actions/setup` for the checkout and Vite+ setup CI repeats 4 times.

## How it's checked

Each change: `vp check`, `vp run test:unit`, `vp run test:dev`, `vp run test:preview` (the browser
suites read the docs pages' `data-*` attributes and the routes' answers), and `vp run i18n:check`
(change 2 removes catalog entries). Nothing a visitor sees changes. Committed locally; pushed when
the user says, then CI deploys and runs the live check.
