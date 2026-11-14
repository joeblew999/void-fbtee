# plans/their-own-language.md: every visitor lands in their own language

Status: proposed 2026-11-14; its unknowns were checked the same day (below, "What was checked"), and
it was reviewed by a separate agent the same day, whose 22 findings are folded in. Waiting for the
user's OK. Its place in the order: `plans/README.md` (before `plans/void-1.9.md`).

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

1. **Their own locale:** the browser's `Accept-Language` on the server, `navigator.languages` in the
   page. The two aren't always the same list: Safari sends only its top language in the header
   (Chrome has an intent to do the same, not shipped: blink-dev "Intent to Ship: Reduce
   Accept-Language", read 2026-11-14). So the server may see less than the page. That's why the
   notice (point 3 below) checks again in the page: a Safari user whose first language the site
   doesn't have is redirected to the fallback, and the notice then offers their second one.
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

2. **An address without a language follows the person.** This lives in void-fbtee's middleware
   (`packages/void-fbtee/src/middleware.ts`), so it can't know any app's paths: it knows only the
   app's languages, void-fbtee's own `pages/[lang]/` convention, and what Void tells it.

   **Which requests.** All of these:
   - `GET` or `HEAD`. A `POST` never redirects.
   - A page being opened: `Sec-Fetch-Dest: document`, or no `Sec-Fetch-Dest` at all (link previews
     like WhatsApp's, crawlers, `curl`), or Void's own move to the next page, which fetches with
     `Sec-Fetch-Dest: empty` and `X-VoidPages: true`. Void's client follows a redirect there
     (`void/dist/pages/client.mjs`, `response?.redirected`), so an unprefixed link inside the site
     lands in the language instead of a 404. A script's other `fetch` (`empty`, no `X-VoidPages`),
     an image or a style is never redirected. Every browser engine sends `Sec-Fetch-Dest` (since
     2023-03; caniuse.com, read 2026-11-14).
   - Not Void's or the app's fixed places, kept as the middleware has them today
     (`middleware.ts:163`, `/^\/(__void|api)(\/|$)/`), plus `/.well-known/` (RFC 8615's folder:
     browsers open `/.well-known/change-password` as a document, and it must not move).

   **Which addresses.** The first segment isn't one of the app's languages, and no other route of
   the app answers. Void reports the route that will answer (`answeringRoute()`, `middleware.ts:76`):
   - a route with a fixed first segment (`/robots.txt`, `/tickets/:id`) is the app's: left alone;
   - a route whose first segment is some other parameter (`pages/[user].tsx`, reported `/:user`) is
     the app's too: left alone. Only `/:lang` and `/:lang/…` are void-fbtee's language pages
     (`middleware.ts:165` today treats any `/:x` as the language; that's narrowed);
   - an app catch-all page at the root (`pages/[...all].tsx`) answers everything: left alone. How
     Void reports one is to be seen first (`answeringRoute` skips `*` and `/*` today, as Void's own
     handlers; see "To check first");
   - no route at all (`"/"`, `/docs/intl`, `/events/new`), or `/:lang` taking a non-language as the
     language (`/events` read as `/:lang`): redirected.

   **Files.** On Cloudflare, files reach the Worker before Void's not-found handler serves them
   (200), so a file must never be redirected. Only an address that looks like a file (a last
   segment with an extension, the package's `LIGHT` test, `middleware.ts:72`) is probed with
   `c.notFound()` first, as the middleware does for made-up languages; Void would otherwise only
   decide "not found" after the middleware returns. `"/"` and other addresses without an extension
   are redirected straight away, so the busiest address doesn't render a not-found page each time.

   **A mistyped language** (`/en-us/events`, `/th/events`): if the first segment, matched without
   the fallback, is one of the app's languages (`en-us` → `en-US`, `th` → `th-TH`), it's replaced by
   the right one (`/th-TH/events`), not prefixed (`/th-TH/th/events`, a 404). The address is one of
   the two sources, so it wins over the browser.

   **The answer:** a 302 to `/<best>` + the path (`/<best>` for `"/"`), with the query string
   (`/docs/intl?x=1` → `/th-TH/docs/intl?x=1`). The path and query are taken raw from
   `new URL(c.req.url)`, not from `c.req.path`: Hono decodes that (`hono/dist/utils/url.js`,
   `tryDecodeURI`), and `c.redirect` doesn't fully re-encode, so `/caf%C3%A9` would put a raw `é`
   in `Location`. Whether the page exists is the app's own routing: the browser lands on it, or on
   the not-found page in its own language.
   - **The match:** `negotiate(acceptLanguage, locales, fallbackLocale)` in the package
     ("Languages the site doesn't have", below).
   - **Never shared:** Void marks the 302 `Cache-Control: no-store`, replacing the middleware's own
     `Vary` and `Cache-Control` (seen on Void 1.8.0, "What was checked"). The plan relies on Void's
     `no-store`, and the live test checks it on Cloudflare itself.
   - **Search engines:**
     - the home page's hreflang `x-default`, in its head and in the sitemap, becomes `"/"`, the
       auto-redirecting home page. Google: "Consider adding a fallback page for unmatched
       languages, especially on language/country selectors or auto-redirecting home pages. Use the
       x-default value" (developers.google.com/search/docs/specialty/international/
       localized-versions, read 2026-11-14);
     - every other page's `x-default` is its page in the fallback language (`fallbackLocale`, the
       source language unless set), so it agrees with where unmatched people are sent. Today it's
       the source page; for the example they're the same. Google endorses redirecting addresses for
       home pages only, and an hreflang target that redirects can void the annotation, so the other
       unprefixed addresses redirect people but aren't advertised.
   - **Void's own docs show a different way:** a rewrite by `Accept-Language`, serving another
     language at the same address (`reference/api/rewrites.md`). We don't do that: two languages
     behind one URL breaks "one address per language".

3. **A language page reached from outside offers the person's own language.** Two conditions:
   - the page is in a language other than the person's best match from `navigator.languages`;
   - they arrived from outside the site: `document.referrer` is empty (a typed address, an email,
     an app, or a browser still holding the old cached 301, which lands on `/en-US` with no
     referrer) or another site's (a search result, a shared link).

   When both hold, a small link to the same page in their language shows at the top. It's named by
   `Intl.DisplayNames` in that language, from the language subtag only, as `SiteHeader.tsx:84–86`
   already does: `of("th")` is "ไทย", where `of("th-TH")` is "ไทย (ไทย)" (Node, 2026-11-14). The link
   carries `lang`, `dir` and `hreflang`. It needs no translated sentence and no other language's
   catalog on the page. It's added in the browser after load, so the cached page is the same for
   everyone.

   **How it runs on every page.** Not as a React component in the root layout: on markdown pages and
   island pages Void renders layouts "static only, so they are not hydrated on the client"
   (`node_modules/void/docs/guide/pages-routing/islands.md`, "Layouts", read 2026-11-14). Instead,
   void-fbtee's middleware adds a small script to every page's head (Void's head `script`, "set in
   middleware to apply defaults to every page", `head.md`), keeping any head script an earlier
   middleware set.
   - **Its code:** a small module in the package (`src/notice.ts`) with the same `negotiate()` the
     middleware uses, built by the package's own build into one script and inlined as text with the
     app's languages as data. Not `negotiate.toString()`, which breaks once the function is bundled.
   - **Where it goes:** inserted before `#app`, outside it. Void hydrates `#app`
     (`@void/react/dist/runtime/pages-client.mjs`), so anything put inside breaks hydration.
   - **It goes on the first move inside the site.** Void's head scripts "are SSR-only. They are not
     re-applied on client-side navigation" (`head.md:133`), so a notice shown on one page would stay
     after Void moves to the next, still linking to the first page. The script removes it at the
     first move. How it sees the move (a Void event, the Navigation API, or `popstate` and link
     clicks) is to be seen first ("To check first"). A plain link that reloads makes a new document
     whose referrer is this site, so it isn't shown again.

   There's nothing to dismiss and nothing to remember. How it looks is the app's, through one CSS
   class.

   It stays a script with the language's name only, now that void-fbtee has `<InLanguage>`
   (fbtee-fully): `<InLanguage>` renders on the server, but whether to show the notice is only known
   in the browser after load (`navigator.languages`, `document.referrer`), and a sentence in the
   visitor's language would mean every page carrying every language's catalog.

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
     `fallbackLocale: "en-US"`. The example leaves it unset (English is its source). The notice
     doesn't show then: there's nothing better to offer.
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

- `negotiate()` in void-fbtee (`src/negotiate.ts`, used by the middleware and the notice) carries
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
- **An app with its own `"/"` page** (`pages/index.tsx`), or a root catch-all: one of the app's own
  routes, so left alone, and the app decides.
- **An app with one language:** every unprefixed address goes to it, and the notice never shows.
- **An app written in another language** (the Thai fresh app): the fallback defaults to Thai.
- **Browsers that already have the old 301.** Until now the live site answered `"/"` with a
  permanent redirect to `/en-US`, with no `Cache-Control` (checked on
  https://void-fbtee-example.gedw99.workers.dev, 2026-11-14). A browser may keep it, and the site
  can't take it back. Such a visitor lands on `/en-US` with an empty referrer, so the notice offers
  them their own language. Every link the site and its emails give carries its language, so it's
  only `"/"`. From now on `init` never writes a permanent redirect.

## What changes

The places, found in the code and by the review (2026-11-14):

- **Package (`packages/void-fbtee/`):**
  - `src/negotiate.ts` (new): `negotiate()`, fbtee 6.0.0's matching without its cache, and the
    header reading;
  - `src/notice.ts` (new): the notice, built into one inlined script;
  - `src/middleware.ts`: the redirect; the language-route test narrowed to `/:lang` (`:165`); the
    notice's script in the head; the home page's `x-default` (`:102–111`, where it's built, not
    `head.ts`); its opening comment (`:7–9`, `:15`);
  - `src/server.ts:176`: the sitemap's `x-default`;
  - `src/locales.ts`: the `fallbackLocale` option and its check (next to `:95`);
  - `src/plugin.ts`: takes `fallbackLocale`;
  - `src/init.ts:448–471`: writes no redirect; removes only the exact one it wrote,
    `"/": { to: "/<sourceLocale>", status: 301 }`, and leaves any other an app wrote;
  - `src/check.ts:180–188`: reports a `"/"` redirect only when it points at one of the app's
    languages (`/<locale>`), as the bug, with what to do;
  - `skills/void-fbtee/SKILL.md` (`:318–319`, and where `"/"` is described);
  - `README.md`: the rule, `fallbackLocale`, and the notice's class;
  - `package.json`: 0.5.0 to 0.6.0, since it changes what apps get at `"/"`. CI releases it with
    notes generated from the commit messages (`.github/workflows/ci.yml`, release job), so the
    commit message itself says an app should drop its own fixed redirect; `void-fbtee check` says
    so too.
- **Example (`apps/example/`):**
  - `void.config.ts`: the fixed redirect and its comment go;
  - `pages/[lang]/index.server.ts:31–33`: its comment about `"/"`;
  - `pages/style.css`: the notice's class;
  - `src/shell/SiteHeader.tsx`: its comment no longer calls the links the way in.
- **Tests:**
  - `e2e/preview/server.test.ts:1–2`, `:50–56`: `"/"` no longer always the source language;
  - `e2e/deployed/live.test.ts`: the parts only Cloudflare can show (below);
  - `e2e/fresh/check.ts:234`, `:339–342`, `:556`, `:643–649`: `"/"` follows `Accept-Language` in
    every fresh app, and `/xx-XX` goes to the not-found page in that language rather than a 404 at
    once; the Thai app tests the fallback.
- **Other plans, in the same change:**
  - `plans/quiet-harbor-atlas.md:241–242` says "never a redirect by the visitor's language (the
    reason is in `void.config.ts`)", and that comment goes. It's changed to point here;
  - `plans/primitives.md:78` expects a `<YourLanguage>` component from this plan. It's the notice's
    script instead, so the primitive is `negotiate()` alone.

## What was checked (2026-11-14), before writing the code

On Void 1.8.0, the version the repo runs. The checks ran on the dev server and on the built Worker (`vp preview`, workerd),
with a temporary probe and a rough version of the redirect in the middleware. Both were reverted.

- **The middleware sees `"/"` once Void's fixed redirect is gone:** yes, in both.
- **What Void reports as the answering route:**

  | Address                                            | What Void reports |
  | -------------------------------------------------- | ----------------- |
  | `"/"`, `/docs/intl`, `/events/new`, `/events/<id>` | no route at all   |
  | `/events`, `/nope`                                 | `/:lang`          |
  | `/xx-XX/events`                                    | `/:lang/events`   |
  | `/robots.txt`, `/sitemap.xml`, `/tickets/:id`      | their own routes  |

- **Void decides "not found" only after the middleware returns,** so the middleware calls
  `c.notFound()` itself to see the 404.
- **Files** (`/void.svg`, `/pwa-192x192.png`) are answered before the middleware locally. On
  Cloudflare they reach the Worker, and Void's not-found handler serves them (200). So locally a
  test of files passes whatever the middleware does: it's the live test that proves it.
- **With the rough redirect in place**, on the built Worker: `/docs/intl` in Thai, Arabic and with
  no language, twice over, gave `/th-TH/…`, `/ar-EG/…` and `/en-US/…` every time; `"/"`,
  `/events/new` and an event's page went to the right language; `/robots.txt`, `/sitemap.xml`,
  `/api/live` and `/tickets/<unknown>` were left alone; `/th-TH/…` never moved.
- **Void replaced the redirect's own `Vary` and `Cache-Control`** with `Vary: X-VoidPages…` and
  `no-store`.

## To check first, on Void 1.8.0

Three things the plan relies on that weren't seen yet. Settled first, with a temporary probe as
before, and written here before building:

- how Void reports an app's root catch-all page (`pages/[...all].tsx`) and a `pages/[user].tsx` to
  the middleware;
- how the notice can see Void's move to the next page: an event of Void's, the Navigation API, or
  `popstate` and link clicks;
- that Void's client follows a redirect on its own page fetch (`X-VoidPages`) and lands on the new
  page.

The Void 1.9.1 upgrade comes after this plan (`plans/README.md`), and runs this plan's tests on it.

## How we'll know it's right

Real requests and real browsers, not stand-ins. Locally the preview tests; on Cloudflare the live
test after each deploy, since CI runs only the unit tests and that (`.github/workflows/ci.yml:35`,
`:65`).

**Preview (`e2e/preview/`):**

- `"/"`, `/events` and `/docs/intl` (examples only: the package knows nothing of them), as each of
  these, give the right language, half of them sending `Sec-Fetch-Dest: document` and half sending
  none, so both branches are tested:
  - `th`; `th-TH,th;q=0.9,en;q=0.8`; `ar-SA,ar;q=0.9`; `en-GB`; `fr`;
  - `fr,th;q=0.5`, which gives Thai. That's what a `fetch` with that header gets; Safari would send
    only `fr` (see "The rule"), so this tests `negotiate()`, not what Safari sends;
  - no header at all, which gives the source language.
- A `HEAD` is redirected like a `GET`; a `POST` isn't.
- Void's own page fetch (`Sec-Fetch-Dest: empty`, `X-VoidPages: true`) to `/docs/intl` is
  redirected; a plain `fetch` (`empty`, no `X-VoidPages`) and an image aren't.
- `/api/nope`, `/__void/…` and `/.well-known/change-password` aren't redirected.
- `/en-us/events` and `/th/events` go to `/en-US/events` and `/th-TH/events`.
- The query string survives, and `/caf%C3%A9?q=%20` keeps its encoding in `Location`.
- `Accept-Language` with `*`, `q=0`, a malformed tag, and 30 entries: each handled as in "Edges".
- The home page's `x-default`, in its head and in the sitemap, is `"/"`; every other page's is its
  fallback-language page.
- `/th-TH/…` never redirects, whatever the browser asks for.
- A made-up path (`/nope`, `/xx-XX/events`) goes to the not-found page in the person's own language.
- The redirect and the notice set no cookie and touch no browser storage, and the existing cache
  tests stay green. (Not "no page sets a cookie": the event key cookie is the void-1.9 plan's.)

**Browsers, real Chromium and WebKit (`e2e/browsers/`):**

- a Thai browser (`locale: "th-TH"`) opening `"/"` lands on Thai; an Arabic one on Arabic, right
  to left;
- the notice, on a code page, an island page and a markdown page (`/en-US/docs/intl`,
  `/en-US/docs`, `/en-US/docs/tour`), for a Thai browser opening one from outside: it shows, named
  "ไทย", with `lang`, `dir` and `hreflang`, outside `#app`, and the page hydrates with no errors;
  - then a move inside the site by Void: it's gone, and isn't back;
  - then a plain link that reloads: it doesn't show;
- an English browser on an English page never sees it.

**Unit (`packages/void-fbtee/test/unit/`):**

- `negotiate()` equals fbtee's `setupLocaleContext(...).getLocale()` for single tags and whole lists,
  with and without `fallbackLocale`, for the example's languages and for a site with many: `th`,
  `ar-SA`, `ar-MA`, `en-GB`, `en-AU`, `es-MX`, `pt-AO`, `zh-HK`, `zh-Hant`, `sr-Latn`, `fr`, none;
- reading the header, the 20-entry cap, and that `negotiate()` keeps nothing between calls;
- a `fallbackLocale` the app doesn't have fails at startup;
- `init` writes no redirect and removes only its own; `check` reports only a `"/"` redirect to one
  of the app's languages.

**Fresh apps (`e2e/fresh/check.ts`, in CI):**

- every app: `"/"` follows `Accept-Language`, and `/xx-XX` is the not-found page in that language;
- the app written in Thai: English → `/en-US`, Arabic → `/ar-EG`, French and no header → `/th-TH`
  (the fallback defaults to the source), its home page's `x-default` is `"/"`; with
  `fallbackLocale: "en-US"`, French → `/en-US`;
- a one-language app: `"/"` goes to its language.

**Live, after deploying (`e2e/deployed/live.test.ts`, in CI):**

- `"/"` as Thai, then the same address as Arabic: each its own answer, both `no-store`;
- `/void.svg` is 200 and an image, not a redirect;
- a `POST` to `/docs/intl` isn't redirected.

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
> A small thing seen on the way: with `sourceLocale: "ar-EG"` and no catalog for it, the inline
> exactly-one form of `fbt.plural("ليلة", count, { many: "ليالٍ", showCount: "yes" })` renders a
> Latin `1` ("حجزت 1 ليلة"), where other counts come out in Arabic-Indic digits ("حجزت ٢ ليالٍ").
> Should the exactly-one form format its `1` like the other counts?
>
> And one about lists: `list()` joins every item but the last with one string,
> `{previous items}, {following items}`, for "and", "or" and plain lists alike. In Arabic, CLDR's
> "and" list is `A وB وC` (what `Intl.ListFormat("ar-EG")` prints), but translating that string as
> `و` makes the "or" list `A وB أو C`. Would a separate middle string per conjunction be welcome?
>
> Seen in https://github.com/joeblew999/void-fbtee.
