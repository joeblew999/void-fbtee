# plans/their-own-language.md: every visitor lands in their own language

Status: proposed 2026-11-14, waiting for the user's OK. Comes before everything else in `plans/`:
it's the front door, and it's broken.

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
   it can't know any app's paths: it knows only the app's languages and what Void itself tells it.
   - **`"/"`:** a 302 to `/<best language>`.
   - **Anything else whose first segment isn't one of the app's languages.** Today the middleware
     already finds these: when the route that will answer is one under `pages/[lang]/` (its first
     segment is a parameter, `answeringRoute()` in `packages/void-fbtee/src/middleware.ts`), it
     hands them to Void's not-found handler. That handler serves a real file if there is one
     (`/void.svg`), and otherwise the not-found page. The change: when no file answers and the
     request is a page load (`Sec-Fetch-Dest: document`, or `Accept: text/html`), answer with a 302
     to the same path under the best language (`/<best>` + the path). Whether that page exists is
     the app's own routing: the browser lands on it, or on the not-found page in its own language.
   - **The app's own routes** (`/api/…`, `/__void/…`, its `routes/` files, which don't start with a
     parameter) and real files are left alone, as today.
   - **The match**, in `negotiate(acceptLanguage, locales)` in the package:
     - the browser's languages in their `q` order, each tried exactly first, then by its language
       alone: `th` gives `th-TH`, `ar-SA` gives `ar-EG`, `en-GB` gives `en-US`;
     - the source language when nothing matches (`fr`), or when there's no header at all. That's
       Google's crawler, which sends none.
   - **The response** is marked `Vary: Accept-Language`. Void then never shares it: "Responses that
     vary by request headers, such as `Vary: Accept-Language` … are rendered live"
     (`node_modules/void/docs/guide/edge/revalidation.md`, Void 1.8.0, read 2026-11-14). It's also
     `Cache-Control: private, no-store`, so no browser or proxy keeps one person's answer for
     another.
   - **Search engines see the routing for what it is:** each page's hreflang `x-default`, and the
     sitemap's, becomes its address without a language. An auto-redirecting root is fine as the
     `x-default` (John Mueller, seroundtable.com, read 2026-11-14).
   - **Void's own docs show a different way:** a rewrite by `Accept-Language`, serving another
     language at the same address (`reference/api/rewrites.md`). We don't do that. It would put two
     languages behind one URL, which breaks the rule "one address per language".
3. **A language page reached from outside offers the person's own language.** Two conditions:
   - the page is in a language other than the person's best match from `navigator.languages`;
   - they arrived from outside the site: a search result or a shared link (`document.referrer` isn't
     this site).

   When both hold, a small notice in _their_ language offers the same page in their language. It's
   added by the browser after hydration, so the cached page stays the same for everyone. Once they
   move around inside the site, it doesn't show again, so there's nothing to dismiss and nothing to
   remember. It's a package component, `<YourLanguage>`; how it looks is the app's.

4. **The header's language links stay** as plain links to this page in each language, each named in
   its own language. That's for someone who wants another language on purpose. They're not the way
   in any more.

## What changes

- **Package:**
  - `middleware.ts`: the redirect for addresses without a language;
  - `locales.ts`: `negotiate()`;
  - `head.ts` and `server.ts`: the `x-default` and the sitemap;
  - `react.tsx`: `<YourLanguage>`;
  - `init.ts`: writes no fixed redirect, and removes one that `init` wrote before;
  - `check.ts`: reports a fixed redirect for `"/"` as the bug;
  - `skills/void-fbtee/SKILL.md`.
- **Example:**
  - `void.config.ts`: the fixed redirect and its comment go;
  - the root layout shows `<YourLanguage>`;
  - `SiteHeader.tsx`'s comment no longer calls the links the way in.
- **README:** the line about `"/"`.

## First, two things to check in Void

- **That the middleware runs for `"/"` once Void's fixed redirect is gone.** On Cloudflare, an app
  with middleware sends every request to the Worker first (noted in
  `packages/void-fbtee/src/middleware.ts`). Check it in dev, the preview and the deploy.
- **That Void's page cache never stores these redirects,** with the `Vary` above, checked in the
  preview by a second request in another language.

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
- The redirect is never shared: the same address, asked for in Thai and then in Arabic, gives each
  its own answer, with `Vary: Accept-Language` and `no-store`.
- `/th-TH/…` never redirects, whatever the browser asks for.
- Files and the app's own routes are left alone: `/void.svg`, `/robots.txt`, `/sitemap.xml`,
  `/api/live`.
- A made-up path (`/nope`, `/xx-XX/events`) goes to the not-found page in the person's own language,
  not in English. The preview test that expects a 404 at once changes with it.
- In Playwright:
  - a Thai browser (`locale: "th-TH"`) opening `"/"` lands on Thai;
  - an Arabic one lands on Arabic, right to left.
- The notice:
  - a Thai browser opening `/en-US/docs/intl` from outside sees the offer, in Thai;
  - the same browser, after clicking a link inside the site, doesn't;
  - an English browser on an English page never sees it.
- No page sets a cookie, and the existing cache tests stay green.
- `void-fbtee check`:
  - on an app with the old fixed redirect, it reports it;
  - the fresh-app test: a new app from `void-fbtee init` has no fixed redirect, and `"/"` follows
    the browser.
- On the live site after deploying: `"/"` from a Thai `Accept-Language` lands on `/th-TH`.

Then `vp check`, `test:unit`, `test:dev`, `test:preview` and `i18n:check`. Committed locally, and
pushed when the user says.
