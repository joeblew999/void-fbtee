# plans/their-own-language.md: every visitor lands in their own language

Status: proposed 2026-11-14 and reviewed by a separate agent the same day. Then cut down to the bug
itself, `"/"`, on the user's word: the first version redirected every address without a language,
which needed Void internals (Hono's `matchedRoutes` in Void's registration order, in no Void doc)
and a long list of exceptions. The notice offering a visitor their own language is now its own
plan, `plans/language-notice.md`. Waiting for the user's OK. Its place in the order:
`plans/README.md`.

## The bug

The system's premise is that each person gets their own locale. Everything addressed to a person
already does: emails, reminders and tickets are in the language they booked in. The web pages don't.

`"/"` always goes to `/en-US`. In `apps/example/void.config.ts` that's
`redirects: { "/": { to: "/en-US", status: 301 } }`, with a comment saying the language is "never
chosen by the visitor's". So a Thai or Arabic visitor who types the address or follows a bare link
lands in English. They only find their own language through the switcher in the header
(`src/shell/SiteHeader.tsx`), which is really a debug tool. If they never find it, they never book
in their language, and everything after depends on that.

It's held in place at three levels, which is why it survived:

- **The app:** Void's fixed redirect in `apps/example/void.config.ts`.
- **The package:** `void-fbtee check` requires that fixed redirect
  (`packages/void-fbtee/src/check.ts`, "setup: `"/"` doesn't redirect to …"), and `void-fbtee init`
  writes it (`packages/void-fbtee/src/init.ts`, step 6). So every app made with void-fbtee has the
  same bug.
- **The tests:** `e2e/preview/server.test.ts`, `"/"` always redirects to the source language,
  whatever the browser asks for.

## The rule

A visitor's language comes from two places only:

1. **Their own locale:** the browser's `Accept-Language`. Safari sends only its top language there
   (Chrome has an intent to do the same, not shipped: blink-dev "Intent to Ship: Reduce
   Accept-Language", read 2026-11-14), so the server may see less than `navigator.languages` in the
   page. For `"/"` that's enough: the best language the browser says, or the fallback.
2. **The address:** `/th-TH/…` is Thai, for everyone.

Nothing is remembered: no cookie, no browser storage, no preference. A remembered choice would be a
second source of truth that can disagree with the person's locale, and a cookie stops Void caching
the page.

## What it does

**`"/"` follows the person; every other address stays exactly as it is.**

- **`"/"`:** a `GET` or `HEAD` for `"/"` gets a 302 to `/<best>`, keeping the query string as it
  came (`/?utm_source=x` → `/th-TH?utm_source=x`, taken raw from `new URL(c.req.url).search`).
  `<best>` is `negotiate(acceptLanguage, locales, fallbackLocale)` (below). This is in void-fbtee's
  middleware (`packages/void-fbtee/src/middleware.ts`): the path `"/"` and the app's languages are
  all it needs, so it knows nothing of the app's other pages and reads nothing of Void's internals.
  Other methods to `"/"` are left to Void, as today.
- **Never shared:** Void marks a 302 `Cache-Control: no-store`, replacing the middleware's own
  `Vary` and `Cache-Control` (seen on Void 1.8.0, below). The plan relies on that, and the live test
  checks it on Cloudflare itself.
- **Everything else is unchanged:** `/th-TH/…` is cached once per language and never redirects,
  whatever the browser (Google: "avoid automatically redirecting users from one language version of
  a site to a different language version", developers.google.com/search/docs/specialty/
  international/managing-multi-regional-sites, read 2026-11-14). An address without a language
  other than `"/"` (`/events`) is the not-found page, as today.
- **Search engines:** the home page's hreflang `x-default`, in its head and in the sitemap, becomes
  `"/"`, the auto-redirecting home page. Google: "Consider adding a fallback page for unmatched
  languages, especially on language/country selectors or auto-redirecting home pages. Use the
  x-default value" (developers.google.com/search/docs/specialty/international/localized-versions,
  read 2026-11-14). Every other page's `x-default` is its page in the fallback language, so it
  agrees with where unmatched people go; for the example that's the source page, as today. Google
  endorses language redirects for home pages only, which is all this does.
- **An app with its own `"/"` page** sets `voidFbtee({ redirectHome: false })`, and `"/"` is its own.
  `void-fbtee check` reports `pages/index.*` or `routes/index.*` next to the redirect being on, and
  says so. (A file check, not routing: Void's own rule is that `index` files are `"/"`,
  `guide/pages-routing/overview.md`.)
- **Void's own docs show a different way:** a rewrite by `Accept-Language`, serving another language
  at `"/"` itself (`reference/api/rewrites.md`). We don't: two languages behind one URL breaks "one
  address per language".
- **The header's language links stay** as plain links to this page in each language, each named in
  its own language, for someone who wants another language on purpose.

## Languages the site doesn't have, and inherited ones

The browser sends a list, best first (`Accept-Language: fr, th;q=0.5`). `negotiate()` goes down it
and takes the first one the site can serve. Each one is matched by **fbtee's own rule**, so the
whole system has one way of choosing a language. From fbtee 6.0.0's README, "Locale Matching and
Fallback", read 2026-11-14:

- "It prefers exact locales, then language/script parents".
- "If none are available during language selection, it chooses a region with the same language and
  script, preferring the region inferred by `Intl.Locale` and using a stable order for ties".
- "Traditional Chinese falls back through `zh-Hant`; it does not automatically use a Simplified
  Chinese catalog".

1. **Languages the site doesn't have are skipped, not guessed.** `fr, th;q=0.5` gives Thai, their
   second choice. If nothing on the list can be served, or there's no list (Google's crawler), the
   answer is the fallback.
   - **The fallback is void-fbtee's own option,** `voidFbtee({ fallbackLocale })`, defaulting to
     `sourceLocale` as fbtee's does ("`fallbackLocale` controls the selected language when none of
     `clientLocales` is supported. It defaults to `sourceLocale`", fbtee 6.0.0 README). Passing it
     to fbtee would do nothing: fbtee only reads it when choosing from `clientLocales`
     (`fbtee/lib/index-core-44-4LnRZ.mjs:1250`), and void-fbtee always gives that the page's own
     language (`clientLocales: [locale]`, `runtime.ts:48`). So only `negotiate()` and the
     `x-default`s use it.
   - It gets the check `sourceLocale` gets (`locales.ts:95`, "is not in locales"), so a value the
     app doesn't have fails at startup instead of sending everyone unmatched to a 404.
   - An app written in Thai that wants English for visitors it can't match sets
     `fallbackLocale: "en-US"`. The example leaves it unset (English is its source).
2. **Inherited languages: the same language and script, in the region `Intl.Locale` expects.** Run
   with fbtee 6.0.0 on 2026-11-14 for the example's languages (`en-US`, `th-TH`, `ar-EG`):
   - `th` → `th-TH`;
   - `ar-SA` and `ar-MA` → `ar-EG`;
   - `en-GB` and `en-AU` → `en-US`;
   - `fr` → `en-US` (the source).
3. **A different script is a different language.** `zh-Hant` never gets `zh-Hans`, and `sr-Latn`
   never gets `sr-Cyrl`. Such a reader goes on down their list.

**Why fbtee's rule and not a richer one of ours.** CLDR's parent locales would pick differently only
on a site that has two variants of one language: `en-AU` → `en-GB` (fbtee: `en-US`), `es-MX` →
`es-419` (fbtee: `es-ES`), `pt-AO` → `pt-PT` (fbtee: `pt-BR`). With one variant per language, as
the example has today, both give the same answer. The example will grow towards every language
(the user, 2026-11-14), and then sites will have such variants, so CLDR's answer is the one wanted.
But a second rule would mean two answers to "which language" in one system: the server choosing
one way, fbtee in the page another. So we use fbtee's, and ask fbtee for CLDR's parents (issue 1
below, its first point); when fbtee changes, `negotiate()`'s equality test moves with it.

**How void-fbtee calls it.** fbtee's chooser, `negotiateLocale`, isn't exported. The only way to it,
`setupLocaleContext`, also calls `setupFbtee` and changes fbtee's global setup. That's unsafe in the
middleware, where requests in different languages run at once, and on a page whose fbtee is already
set up. So:

- `negotiate()` in void-fbtee (`src/negotiate.ts`, used by the middleware) carries
  fbtee 6.0.0's matching: `negotiateLocale`, `getLocaleHierarchy`, `areEquivalentLocales`, and what
  they use, `getLocaleIdentity` and the legacy alias tables (`index-core-44-4LnRZ.mjs:195–297`).
  MIT, with that source, version and licence noted at the top. It's the same code, not a new rule.
- **Except fbtee's cache.** `getLocaleHierarchy` keeps every tag it has seen in a module-level `Map`
  (`index-core-44-4LnRZ.mjs:1059`, `const hierarchies`). In the Worker those tags come from
  strangers' headers, so it would grow for as long as the Worker lives. The copy has no cache, and
  reads at most the first 20 entries of a header.
- A unit test runs every case through both: fbtee's public
  `setupLocaleContext({ clientLocales, fallbackLocale, … }).getLocale()` (in a test, where its
  global setup does no harm) and `negotiate()`. Whole lists, not just single tags (`fr,th`,
  `en-GB,th`, `ar-MA,en`), with and without `fallbackLocale`. The answers must be equal, so an
  fbtee upgrade that changes the rule fails the test instead of drifting. Reading the header
  (`q` values, `*`, malformed tags, the 20-entry cap) is void-fbtee's own and has its own tests.
- The issue below asks fbtee to export `negotiateLocale`. When it does, `negotiate()` calls fbtee's
  and its copy is deleted. The signature is kept the same as fbtee's, so nothing else changes then.

## Edges

- **`Accept-Language` that isn't clean:** `*` is skipped; `q=0` means "not this one" and is
  skipped; a tag `Intl.getCanonicalLocales` rejects is skipped; the rest is tried in `q` order, the
  header's own order breaking ties; only the first 20 entries are read.
- **No header** (Google's crawler, `curl`, a link preview): the fallback language.
- **An app with one language:** `"/"` goes to it.
- **An app written in another language** (the Thai fresh app): the fallback defaults to Thai.
- **Browsers that already have the old 301.** Until now the live site answered `"/"` with a
  permanent redirect to `/en-US`, with no `Cache-Control` (checked on
  https://void-fbtee-example.gedw99.workers.dev, 2026-11-14). A browser may keep it, and the site
  can't take it back: such a visitor still lands on English until their browser forgets it. Every
  link the site and its emails give carries its language, so it's only `"/"`. The notice
  (`plans/language-notice.md`) would offer them their own language; without it, they have the
  header's links. From now on `init` never writes a permanent redirect.

## What changes

- **Package (`packages/void-fbtee/`):**
  - `src/negotiate.ts` (new): `negotiate()`, fbtee 6.0.0's matching without its cache, and the
    header reading;
  - `src/middleware.ts`: the redirect for `"/"`; the home page's `x-default` (`:102–111`); its
    opening comment (`:7–9`, `:15`);
  - `src/server.ts:176`: the sitemap's `x-default`;
  - `src/locales.ts`: `fallbackLocale` and its check (next to `:95`), and `redirectHome`;
  - `src/plugin.ts`: takes both;
  - `src/init.ts:448–471`: writes no redirect; removes only the exact one it wrote,
    `"/": { to: "/<sourceLocale>", status: 301 }`, and leaves any other an app wrote;
  - `src/check.ts:180–188`: reports a `"/"` redirect that points at one of the app's languages, as
    the bug, with what to do; and an app `"/"` page with `redirectHome` on;
  - `skills/void-fbtee/SKILL.md` (`:318–319`, and where `"/"` is described);
  - `README.md`: the rule, `fallbackLocale`, `redirectHome`;
  - `package.json`: 0.5.0 to 0.6.0, since it changes what apps get at `"/"`. CI releases it with
    notes generated from the commit messages (`.github/workflows/ci.yml`, release job), so the
    commit message itself says an app should drop its own fixed redirect; `void-fbtee check` says
    so too.
- **Example (`apps/example/`):**
  - `void.config.ts`: the fixed redirect and its comment go;
  - `pages/[lang]/index.server.ts:31–33`: its comment about `"/"`;
  - `src/shell/SiteHeader.tsx`: its comment no longer calls the links the way in.
- **Tests:**
  - `e2e/preview/server.test.ts:1–2`, `:50–56`: `"/"` follows the browser;
  - `e2e/deployed/live.test.ts`: what only Cloudflare can show (below);
  - `e2e/fresh/check.ts:234`, `:339–342`, `:556`, `:643–646`: `"/"` follows `Accept-Language` in
    every fresh app; `/xx-XX` stays a 404, as today.
- **Other plans:** `plans/primitives.md:78` and `plans/quiet-harbor-atlas.md:241–242` say what this
  plan does (already updated 2026-11-14); `plans/void-1.9.md` item 6 lists only what this plan
  relies on.

## What was checked (2026-11-14), before writing the code

On Void 1.8.0, the version the repo runs, on the dev server and on the built Worker (`vp preview`,
workerd), with a temporary probe and a rough redirect in the middleware, both reverted:

- **The middleware sees `"/"` once Void's fixed redirect is gone:** yes, in both.
- **A redirect from the middleware** gave `"/"` asked for in Thai, Arabic (`ar-SA`) and with no
  language, twice over, `/th-TH`, `/ar-EG` and `/en-US` every time: nothing shared.
- **Void replaced the redirect's own `Vary` and `Cache-Control`** with `Vary: X-VoidPages…` and
  `no-store`.

Nothing else is left to find out first.

## How we'll know it's right

Real requests and real browsers, not stand-ins. Locally the preview tests; on Cloudflare the live
test after each deploy, since CI runs only the unit tests and that (`.github/workflows/ci.yml:35`,
`:65`).

- **Preview (`e2e/preview/server.test.ts`):** `"/"` as each of these gives the right language:
  `th`; `th-TH,th;q=0.9,en;q=0.8`; `ar-SA,ar;q=0.9`; `en-GB`; `fr`; `fr,th;q=0.5` (Thai: that's
  what a `fetch` with that header gets, so it tests `negotiate()`, not what Safari sends); no
  header (English). Also:
  - a `HEAD` is redirected like a `GET`;
  - the query string survives, encoding and all (`/?q=%20x`);
  - `*`, `q=0`, a malformed tag and 30 entries are handled as in "Edges";
  - `/th-TH` and `/events` don't redirect, whatever the browser asks for;
  - the home page's `x-default`, in its head and in the sitemap, is `"/"`; every other page's is its
    fallback-language page;
  - the redirect sets no cookie, and the existing cache tests stay green.
- **Browsers, real Chromium and WebKit (`e2e/browsers/`):** a Thai browser (`locale: "th-TH"`)
  opening `"/"` lands on Thai; an Arabic one on Arabic, right to left.
- **Unit (`packages/void-fbtee/test/unit/`):**
  - `negotiate()` equals fbtee's `setupLocaleContext(...).getLocale()` for single tags and whole
    lists (`fr,th`, `en-GB,th`, `ar-MA,en`), with and without `fallbackLocale`, for the example's
    languages and for a site with many: `th`, `ar-SA`, `ar-MA`, `en-GB`, `en-AU`, `es-MX`, `pt-AO`,
    `zh-HK`, `zh-Hant`, `sr-Latn`, `fr`, none;
  - reading the header, the 20-entry cap, and that `negotiate()` keeps nothing between calls;
  - a `fallbackLocale` the app doesn't have fails at startup;
  - `init` writes no redirect and removes only its own; `check` reports a `"/"` redirect to one of
    the app's languages, and an app `"/"` page with `redirectHome` on.
- **Fresh apps (`e2e/fresh/check.ts`, in CI):** `"/"` follows `Accept-Language` in every app. The
  app written in Thai: English → `/en-US`, Arabic → `/ar-EG`, French and no header → `/th-TH` (the
  fallback defaults to the source), and its home page's `x-default` is `"/"`; with
  `fallbackLocale: "en-US"`, French → `/en-US`.
- **Live, after deploying (`e2e/deployed/live.test.ts`, in CI):** `"/"` as Thai, then as Arabic:
  each its own answer, both `no-store`; Thai lands on `/th-TH`.

Then `vp check`, `test:unit`, `test:dev`, `test:preview` and `i18n:check`. Committed locally, and
pushed when the user says.

## The issues for nkzw-tech/fbtee (drafts, not filed)

Two, one per subject, filed only with the user's OK.

### 1. Locale matching: regional variants, and using it on a server

Title: Locale matching for sites with several variants of a language, and on the server

> void-fbtee (https://github.com/joeblew999/void-fbtee) uses fbtee in Void apps that will have
> many languages, and wants one rule for "which language" across the app: fbtee's.
>
> **Regional variants.** With one variant per language, fbtee's matching gives the expected answer.
> With several, it picks the region `Intl.Locale` infers rather than the nearer variant CLDR's
> parent locales give (cldr-core 49.0.0, `parentLocales`):
>
> | Visitor | Site has          | fbtee 6.0.0 | CLDR parent               |
> | ------- | ----------------- | ----------- | ------------------------- |
> | `en-AU` | `en-US`, `en-GB`  | `en-US`     | `en-GB` (shared `en-001`) |
> | `es-MX` | `es-ES`, `es-419` | `es-ES`     | `es-419`                  |
> | `pt-AO` | `pt-BR`, `pt-PT`  | `pt-BR`     | `pt-PT`                   |
>
> It's your documented rule ("preferring the region inferred by `Intl.Locale`", README "Locale
> Matching and Fallback"). Would CLDR's parents be welcome, as the rule or an option? The same
> answer matters in the browser (`clientLocales: navigator.languages`).
>
> **On the server.** We choose the language for a request from `Accept-Language` in middleware.
> `negotiateLocale` isn't exported, and `setupLocaleContext` also calls `setupFbtee`, which isn't
> safe per request. Could `negotiateLocale` (and the locale-chain helpers it uses) be exported?
> Until then void-fbtee carries a copy, with a test comparing it to
> `setupLocaleContext(...).getLocale()`.
>
> Exported as it is, it would need one change for servers: `getLocaleHierarchy` keeps every tag it
> has seen in a module-level `Map` (`const hierarchies`, `lib/index-core-44-4LnRZ.mjs`), never
> cleared. In a browser that's a handful of tags. On a server fed every visitor's `Accept-Language`,
> anyone can send new tags until the process runs out of memory. "Each request has its own hooks and
> caches" (README, "Server Rendering") doesn't cover it, since the map is shared by the process. Our
> copy has no cache (it's cheap to work out each time); a size cap would do too.

### 2. Two things seen in Arabic

Title: Arabic: the exactly-one form's digit, and the list's middle separator

> Seen in https://github.com/joeblew999/void-fbtee, with fbtee 6.0.0:
>
> - With `sourceLocale: "ar-EG"` and no catalog for it, the inline exactly-one form of
>   `fbt.plural("ليلة", count, { many: "ليالٍ", showCount: "yes" })` renders a Latin `1`
>   ("حجزت 1 ليلة"), where other counts come out in Arabic-Indic digits ("حجزت ٢ ليالٍ"). Should the
>   exactly-one form format its `1` like the other counts?
> - `list()` joins every item but the last with one string, `{previous items}, {following items}`,
>   for "and", "or" and plain lists alike. CLDR's Arabic "and" list is `A وB وC` (what
>   `Intl.ListFormat("ar-EG")` prints), but translating that string as `و` makes the "or" list
>   `A وB أو C`. Would a separate middle string per conjunction be welcome?
