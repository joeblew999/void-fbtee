# plans/their-own-language.md: every visitor lands in their own language

Status: proposed 2026-11-14; its unknowns were checked the same day (below, "What was checked"). Waiting
for the user's OK. Comes before everything else in `plans/`: it's the front door, and it's broken.

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

1. **Their own locale:** the browser's `Accept-Language`, which is `navigator.languages` in the page.
2. **The address:** `/th-TH/…` is Thai, for everyone.

Nothing is remembered: no cookie, no browser storage, no preference. A remembered choice would be a
second source of truth that can disagree with the person's locale, and a cookie stops Void caching
the page.

## How it works

1. **Language pages stay as they are.** `/th-TH/…` is cached once per language and never redirects,
   whatever the browser. That's Google's rule: "avoid automatically redirecting users from one
   language version of a site to a different language version … don't redirect based on what you
   think the user's language may be" (developers.google.com/search/docs/specialty/international/
   managing-multi-regional-sites, read 2026-11-14).
2. **An address without a language follows the person.** This lives in void-fbtee's middleware, so
   it can't know any app's paths: it knows only the app's languages and what Void itself tells it. It
   redirects when all of these hold:
   - the first segment isn't one of the app's languages;
   - it isn't one of the app's own routes (`/api/…`, `/__void/…`, its `routes/` files). Void reports
     the route that will answer (`answeringRoute()` in `packages/void-fbtee/src/middleware.ts`): an
     app's own route has a fixed first segment (`/robots.txt`, `/tickets/:id`). Anything else is
     either no route at all (`"/"`, `/docs/intl`, `/events/new`) or one under `pages/[lang]/` that
     takes the first segment as the language (`/events` read as `/:lang`);
   - Void's not-found handler answers 404, not a real file. The middleware calls `c.notFound()`
     itself for these, as it already does for made-up languages, because Void would otherwise only
     decide "not found" after the middleware has returned;
   - it's a page load: `GET` or `HEAD`, with `Sec-Fetch-Dest: document` (every engine sends it
     since 2023-03; caniuse.com, read 2026-11-14), or, from a client that sends no `Sec-Fetch-Dest`,
     an `Accept` that includes `text/html`. A `POST`, a script's `fetch` and an image never redirect.

   Then: a 302 to the same path under the best language (`/<best>` + the path, or `/<best>` for
   `"/"`). Whether that page exists is the app's own routing: the browser lands on it, or on the
   not-found page in its own language.
   - **The match:** `negotiate(acceptLanguage, locales)` in the package (section "Languages the site
     doesn't have, and inherited ones", below).
   - **The response is never shared:** Void itself marks the 302 `Cache-Control: no-store`. In the
     check below it replaced the middleware's own `Vary` and `Cache-Control` with its own, so the plan
     relies on Void's `no-store`, and the tests check for it, rather than on headers the middleware
     sets.
   - **Search engines:**
     - the home page's hreflang `x-default`, and the sitemap's, becomes `"/"`, the auto-redirecting
       home page. Google's own words: "Consider adding a fallback page for unmatched languages,
       especially on language/country selectors or auto-redirecting home pages. Use the x-default
       value" (developers.google.com/search/docs/specialty/international/localized-versions, read
       2026-11-14);
     - every other page keeps its source-language page as `x-default`, as today. Google endorses
       redirecting addresses for home pages only, and an hreflang target that redirects can void the
       annotation. So the other unprefixed addresses redirect people, but aren't advertised.
   - **Void's own docs show a different way:** a rewrite by `Accept-Language`, serving another
     language at the same address (`reference/api/rewrites.md`). We don't do that. It would put two
     languages behind one URL, which breaks the rule "one address per language".

3. **A language page reached from outside offers the person's own language.** Two conditions:
   - the page is in a language other than the person's best match from `navigator.languages`;
   - they arrived from outside the site: `document.referrer` is empty (a typed address, an email, an
     app) or another site's (a search result, a shared link).

   When both hold, a small notice in _their_ language offers the same page in their language. It's
   added by the browser after hydration, so the cached page stays the same for everyone.

   `document.referrer` belongs to the document, and doesn't change when Void moves between pages
   without reloading. So `<YourLanguage>` goes in the root layout, which Void keeps across those moves
   (`reference/api/pages.md`: "layouts persist"), and decides once per document. A link that reloads
   the page (the header's language links are plain links) makes a new document whose referrer is this
   site, so it doesn't show again. There's nothing to dismiss and nothing to remember. How it looks is
   the app's.

4. **The header's language links stay** as plain links to this page in each language, each named in
   its own language. That's for someone who wants another language on purpose. They're not the way
   in any more.

## Languages the site doesn't have, and inherited ones

The browser sends a list, best first (`Accept-Language: fr, th;q=0.5`). `negotiate()` goes down it
and takes the first one the site can serve, by these rules.

1. **Languages the site doesn't have are skipped, not guessed.** `fr, th;q=0.5` gives Thai, their
   second choice. If nothing on the list can be served, or there's no list (Google's crawler), the
   answer is the app's source language. That's fbtee's own fallback (`sourceLocale`) and the meaning
   of `x-default`. The notice in point 3 doesn't show then: there's nothing better to offer.
2. **Inherited languages follow CLDR, the Unicode locale data every browser and Intl use.** A
   language variant inherits from its parent:
   - `es-MX` and `es-AR` → `es-419` (Latin American Spanish) → `es`;
   - `en-AU` and `en-GB` → `en-001` (international English) → `en`;
   - `pt-AO` → `pt-PT`;
   - `zh-Hant-MO` → `zh-Hant-HK`;
   - `hi-Latn` (Hindi written in Latin letters) → `en-IN`, which crosses into another language.

   From CLDR's `parentLocales` table (`cldr-core` 49.0.0 on npm, `supplemental/parentLocales.json`,
   198 entries, read 2026-11-14), with likely scripts from `Intl.Locale.maximize()`.

   A request matches the app's language that shares the closest ancestor with it. So, for a site
   with `en-US` and `en-GB`, an Australian reader gets `en-GB` (shared `en-001`), not `en-US` (shared
   only `en`). And a Mexican reader gets `es-419` when the site has it, not `es-ES`.

3. **A different script is a different language.** `zh-Hant` (Traditional) never gets `zh-Hans`
   (Simplified), and `sr-Latn` never gets `sr-Cyrl`: their CLDR parent is the root, so they share no
   ancestor. Such a reader goes on down their list, and gets the source language if nothing else
   fits.

**Why not just fbtee's rule.** fbtee 6.0.0 already picks a language from a browser's list
(`setupLocaleContext`; inside it `negotiateLocale`, which isn't exported). It's script-aware (it gives
`zh-HK` → `zh-TW`, and `sr-Latn` nothing). But it doesn't know CLDR's parents. Run on 2026-11-14
against a site with `en-US`, `en-GB`, `es-ES`, `es-419`, `pt-BR` and `pt-PT`, it gave:

- `en-AU` → `en-US`;
- `es-MX` and `es-AR` → `es-ES`;
- `pt-AO` → `pt-BR`.

All three are the wrong inheritance. It also can't be called from the middleware: it changes fbtee's
global setup.

So the plan is:

- void-fbtee's `negotiate()` keeps fbtee's script rule and adds CLDR's parents;
- the CLDR table is copied into the package by a script, with its version and date recorded beside
  it, and the package's upgrade step refreshes it;
- an issue for nkzw-tech/fbtee (drafted, filed only with the user's OK) asks for CLDR's parents in
  `negotiateLocale`, and for exporting it. If it lands, void-fbtee uses fbtee's and deletes its own.

## What changes

- **Package:**
  - `middleware.ts`: the redirect for addresses without a language;
  - `locales.ts`: `negotiate()`, with CLDR's parent table in `cldr-parents.ts`, generated by
    `scripts/cldr-parents.ts` from `cldr-core` (a devDependency, so it's pinned and upgraded like the
    other tools);
  - `head.ts` and `server.ts`: the `x-default` and the sitemap;
  - `react.tsx`: `<YourLanguage>`;
  - `init.ts`: writes no fixed redirect, and removes one that `init` wrote before;
  - `check.ts`: reports a fixed redirect for `"/"` as the bug;
  - `skills/void-fbtee/SKILL.md`;
  - `package.json`: the version's minor number goes up, since it changes what apps get at `"/"`.
    CI then releases it (`.github/workflows/ci.yml`, release job), and the release notes say an app
    should drop its own fixed redirect: `void-fbtee check` says so too.
- **Example:**
  - `void.config.ts`: the fixed redirect and its comment go;
  - the root layout shows `<YourLanguage>`;
  - `SiteHeader.tsx`'s comment no longer calls the links the way in.
- **README:** the line about `"/"`.

## What was checked (2026-11-14), before writing the code

The checks ran on the dev server and on the built Worker (`vp preview`, workerd), with a temporary
probe and a rough version of the redirect in the middleware. Both were reverted afterwards.

- **The middleware sees `"/"` once Void's fixed redirect is gone:** yes, in both.
- **What Void reports as the answering route:**

  | Address                                            | What Void reports |
  | -------------------------------------------------- | ----------------- |
  | `"/"`, `/docs/intl`, `/events/new`, `/events/<id>` | no route at all   |
  | `/events`, `/nope`                                 | `/:lang`          |
  | `/xx-XX/events`                                    | `/:lang/events`   |
  | `/robots.txt`, `/sitemap.xml`, `/tickets/:id`      | their own routes  |

  So the first rule written here ("the answering route starts with a parameter") would have missed
  most pages. The rule above covers both cases.

- **Void decides "not found" only after the middleware returns,** so the middleware calls
  `c.notFound()` itself to see the 404.
- **Files** (`/void.svg`, `/pwa-192x192.png`) are answered before the middleware locally. On
  Cloudflare they reach the Worker, and Void's not-found handler serves them (200), so they're never
  redirected.
- **With the rough redirect in place**, on the built Worker:
  - `/docs/intl` asked for in Thai, Arabic (`ar-SA`) and with no language, twice over, gave
    `/th-TH/…`, `/ar-EG/…` and `/en-US/…` every time. Nothing was shared;
  - `"/"`, `/events/new` and an event's page went to the right language;
  - files, `/robots.txt`, `/sitemap.xml`, `/api/live` and `/tickets/<unknown>` were left alone;
  - `/th-TH/…` never moved;
  - the rough version also redirected a `POST`, which the real one won't (rule above).
- **Void replaced the redirect's own `Vary` and `Cache-Control`** with `Vary: X-VoidPages…` and
  `no-store` (see "never shared" above).
- **Still to see on Cloudflare itself,** after deploying: a Thai request for `"/"` lands on `/th-TH`,
  a file still loads, and the redirect is `no-store` there too (in "How we'll know").

## How we'll know it's right

The preview tests use real requests and real browsers, not stand-ins.

- `"/"` and two of the example's pages without a language (`"/events"`, `"/docs/intl"`, used here only
  as examples, which the package knows nothing about), asked for as each of the following, give the
  right language:
  - `th`;
  - `th-TH,th;q=0.9,en;q=0.8`;
  - `ar-SA,ar;q=0.9`;
  - `en-GB`;
  - `fr`;
  - `fr,th;q=0.5`, which gives Thai: the best one the app has;
  - no header at all, which gives the source language.
- `negotiate()`'s unit tests, with the expected answers taken from CLDR's own table, not from the
  code:
  - for the example's three languages: `ar-MA` → `ar-EG`, `zh-HK` → `en-US` (no Chinese), and
    `es-MX` → `en-US` (no Spanish);
  - for a site with many languages: `en-AU` → `en-GB`, `es-MX` → `es-419`, `pt-AO` → `pt-PT`,
    `zh-HK` → `zh-TW`, `sr-Latn` → the source, `hi-Latn` → `en-IN` when the site has it.
- The redirect is never shared: the same address, asked for in Thai and then in Arabic, gives each
  its own answer, and is marked `no-store`.
- A client with no `Sec-Fetch-Dest` but `Accept: text/html` is redirected; a `fetch` and an image
  aren't.
- The home page's `x-default` (in its head and in the sitemap) is `"/"`, and every other page's is
  still its source-language page.
- `/th-TH/…` never redirects, whatever the browser asks for.
- Files and the app's own routes are left alone: `/void.svg`, `/robots.txt`, `/sitemap.xml`,
  `/api/live`.
- A `POST` to an address without a language isn't redirected.
- A made-up path (`/nope`, `/xx-XX/events`) goes to the not-found page in the person's own language,
  not in English. The preview test that expects a 404 at once changes with it.
- In Playwright, with real Chromium and WebKit (`e2e/browsers/`):
  - a Thai browser (`locale: "th-TH"`) opening `"/"` lands on Thai;
  - an Arabic one lands on Arabic, right to left.
- The notice:
  - a Thai browser opening `/en-US/docs/intl` from outside sees the offer, in Thai;
  - the same browser, after moving to another page inside the site (Void's own move, and a plain
    link that reloads), doesn't;
  - an English browser on an English page never sees it.
- No page sets a cookie, and the existing cache tests stay green.
- `void-fbtee check`:
  - on an app with the old fixed redirect, it reports it;
  - the fresh-app test: a new app from `void-fbtee init` has no fixed redirect, and `"/"` follows
    the browser.
- On the live site after deploying: `"/"` from a Thai `Accept-Language` lands on `/th-TH`.

Then `vp check`, `test:unit`, `test:dev`, `test:preview` and `i18n:check`. Committed locally, and
pushed when the user says.

## The issue for nkzw-tech/fbtee (draft, not filed)

Title: `negotiateLocale` ignores CLDR parent locales (es-MX → es-ES when es-419 is available)

> fbtee 6.0.0's `negotiateLocale` (used by `setupLocaleContext`) is script-aware, which is great. But
> it doesn't follow CLDR's `parentLocales`. With available `en-US`, `en-GB`, `es-ES`, `es-419`,
> `pt-BR` and `pt-PT`, client locales `en-AU`, `es-MX` and `pt-AO` resolve to `en-US`, `es-ES` and
> `pt-BR`. CLDR (49, `supplemental/parentLocales.json`) gives `en-AU → en-001`, `es-MX → es-419`
> and `pt-AO → pt-PT`, so the expected answers are `en-GB`, `es-419` and `pt-PT`.
>
> Could `negotiateLocale` prefer the available locale that shares the closest CLDR ancestor? And
> could it be exported, so servers can pick a locale from `Accept-Language` without
> `setupLocaleContext`, which also sets up fbtee's global runtime?
>
> Seen in https://github.com/joeblew999/void-fbtee.
