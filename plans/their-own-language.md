# plans/their-own-language.md: every visitor lands in their own language

Status: proposed 2026-11-14; its unknowns were checked the same day (below, "What was checked"). Waiting
for the user's OK. Its place in the order: `plans/README.md`.

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
   - it's `GET` or `HEAD`, and not a page's own part: `Sec-Fetch-Dest` is `document`, or it isn't
     sent at all. Every browser engine sends it (since 2023-03; caniuse.com, read 2026-11-14), so a
     script's `fetch` (`empty`), an image or a style is never redirected. Clients that send none get
     the redirect, with their `Accept-Language` or the source language:
     - link previews (WhatsApp, Slack, X fetch `"/"` to show a card);
     - crawlers;
     - `curl`.

     (The first version of this rule asked for `Accept: text/html` too, which would have given a
     link preview a 404 for `"/"`.) A `POST` never redirects.

   Then: a 302 to the same path under the best language (`/<best>` + the path, or `/<best>` for
   `"/"`), keeping the query string (`/docs/intl?x=1` → `/th-TH/docs/intl?x=1`). Whether that page exists is the app's own routing: the browser lands on it, or on the
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

   When both hold, a small link to the same page in their language shows at the top. It's named in
   that language by `Intl.DisplayNames` ("ไทย", "العربية"), so it needs no translated sentence and
   no other language's catalog on the page. It's added in the browser after load, so the cached page
   stays the same for everyone.

   **How it runs on every page.** Not as a React component in the root layout: on markdown pages and
   island pages Void renders layouts "static only, so they are not hydrated on the client"
   (`node_modules/void/docs/guide/pages-routing/islands.md`, "Layouts", read 2026-11-14), and the
   docs are those. Instead, void-fbtee's middleware adds a small script to every page's head
   (Void's head `script`, "set in middleware to apply defaults to every page", `head.md`).
   - The script carries the same `negotiate()` as the middleware, so the redirect and the notice
     choose the same way.
   - It decides once per document load. `document.referrer` belongs to the document, so Void's
     moves between pages without reloading don't show it again. A plain link that reloads makes a
     new document whose referrer is this site.

   There's nothing to dismiss and nothing to remember. How it looks is the app's, through one CSS
   class.

4. **The header's language links stay** as plain links to this page in each language, each named in
   its own language. That's for someone who wants another language on purpose. They're not the way
   in any more.

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
   answer is fbtee's own `fallbackLocale`: "`fallbackLocale` controls the selected language when
   none of `clientLocales` is supported. It defaults to `sourceLocale`" (fbtee 6.0.0 README, read
   2026-11-14). void-fbtee doesn't pass it today (searched `packages/void-fbtee/src/`, 2026-11-14).
   So `voidFbtee({ fallbackLocale })` passes it through to fbtee, unchanged, as `fallbackLocales`
   already is. `negotiate()` uses it, and so does the home page's `x-default`. An app written in
   Thai that wants English for visitors it can't match sets `fallbackLocale: "en-US"`; the example
   leaves it unset (English is its source). The notice in point 3 doesn't show
   then: there's nothing better to offer.
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
`es-419` (fbtee: `es-ES`), `pt-AO` → `pt-PT` (fbtee: `pt-BR`). With one variant per language, which
is every app here, both give the same answer. A second rule would mean two answers to "which
language" in one system, plus a CLDR dependency. So we use fbtee's. The difference goes to fbtee as
a suggestion (the issue below), to change there if they agree.

**How void-fbtee calls it.** fbtee's chooser, `negotiateLocale`, isn't exported. The only way to it,
`setupLocaleContext`, also calls `setupFbtee` and changes fbtee's global setup. That's unsafe in the
middleware, where requests in different languages run at once, and on a page whose fbtee is already
set up. So:

- `negotiate()` in void-fbtee carries fbtee 6.0.0's matching (`getLocaleHierarchy`,
  `areEquivalentLocales`, `negotiateLocale` in `fbtee/lib/index-core-*.mjs`, MIT), with that
  source, version and licence noted at the top. It's the same code, not a new rule.
- A unit test runs every case above through both: fbtee's public `setupLocaleContext(...).getLocale()`
  (in a test, where its global setup does no harm) and `negotiate()`. The answers must be equal, so
  an fbtee upgrade that changes the rule fails the test instead of drifting.
- The issue below asks fbtee to export `negotiateLocale`. When it does, `negotiate()` calls fbtee's
  and its copy is deleted. The signature is kept the same as fbtee's, so nothing else changes then.

## Edges

- **`Accept-Language` that isn't clean:**
  - `*` is skipped;
  - `q=0` means "not this one" and is skipped;
  - a tag `Intl.getCanonicalLocales` rejects is skipped;
  - the rest is tried in `q` order, the header's own order breaking ties.
- **An app with its own `"/"` page** (`pages/index.tsx`): it's one of the app's own routes, so it's
  left alone, and the app decides.
- **Browsers that already have the old 301.** Until now the live site answered `"/"` with a
  permanent redirect to `/en-US`, with no `Cache-Control` (checked on
  https://void-fbtee-example.gedw99.workers.dev, 2026-11-14). A browser may keep such a redirect,
  and the site can't take it back. Someone who opened `"/"` before may still land on English until
  their browser forgets it. Every link the site and its emails give carries its language, so it's
  only `"/"`. The release notes tell apps the same, and from now on `init` never writes a permanent
  redirect.

## What changes

- **Package:**
  - `middleware.ts`: the redirect for addresses without a language;
  - `locales.ts`: `negotiate()`, fbtee 6.0.0's matching (see "How void-fbtee calls it");
  - `plugin.ts` and `runtime.ts`: the `fallbackLocale` option, passed through to fbtee;
  - `head.ts` and `server.ts`: the `x-default` and the sitemap;
  - `middleware.ts` also adds the notice's script to every page's head, with `negotiate()` in it,
    so the redirect and the notice choose the same way;
  - `init.ts`: writes no fixed redirect, and removes one that `init` wrote before;
  - `check.ts`: reports a fixed redirect for `"/"` as the bug;
  - `skills/void-fbtee/SKILL.md`;
  - `package.json`: the version's minor number goes up, since it changes what apps get at `"/"`.
    CI then releases it (`.github/workflows/ci.yml`, release job), and the release notes say an app
    should drop its own fixed redirect: `void-fbtee check` says so too.
- **Example:**
  - `void.config.ts`: the fixed redirect and its comment go;
  - `pages/style.css` styles the notice's class;
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
- With `fallbackLocale` set to Thai, a French browser lands on Thai, and the home page's `x-default`
  points there.
- `negotiate()` gives the same answer as fbtee's own `setupLocaleContext(...).getLocale()` for every
  case, for the example's languages and for a site with many: `th`, `ar-SA`, `ar-MA`, `en-GB`,
  `en-AU`, `es-MX`, `pt-AO`, `zh-HK`, `zh-Hant`, `sr-Latn`, `fr` and none.
- The redirect is never shared: the same address, asked for in Thai and then in Arabic, gives each
  its own answer, and is marked `no-store`.
- A client with no `Sec-Fetch-Dest` (a link preview, `curl`) is redirected; a `fetch`
  (`Sec-Fetch-Dest: empty`) and an image aren't.
- The query string survives the redirect.
- `Accept-Language` with `*`, `q=0` and a malformed tag: each is skipped, and the next one decides.
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
- The notice, on a code page, an island page and a markdown page (`/en-US/docs/intl`,
  `/en-US/docs`, `/en-US/docs/tour`):
  - a Thai browser opening one from outside sees the link, named "ไทย";
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

Title: Export `negotiateLocale` (choosing a locale on the server without `setupLocaleContext`)

> void-fbtee picks the language for a request from `Accept-Language` in middleware, and wants fbtee's
> exact rule for it, so the whole app chooses one way. `negotiateLocale` isn't exported, and
> `setupLocaleContext` also calls `setupFbtee`, which isn't safe per request. Could
> `negotiateLocale` (and the locale-chain helpers it uses) be exported? Until then void-fbtee
> carries a copy of it, with a test that compares it to `setupLocaleContext(...).getLocale()`.
>
> A smaller question: for sites with several regional variants of one language, would CLDR's parent
> locales be welcome as an option? `en-AU` → `en-GB` (shared `en-001`), `es-MX` → `es-419`, `pt-AO`
> → `pt-PT`, where the current rule gives `en-US`, `es-ES` and `pt-BR`. It's your documented rule,
> so this is only a suggestion.
>
> Seen in https://github.com/joeblew999/void-fbtee.
