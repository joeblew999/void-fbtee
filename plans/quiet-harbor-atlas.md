# plans/quiet-harbor-atlas.md: every Void feature, in every language, with no extra work

## Context

void-fbtee's aim is a Void app that's translated without its developer handling languages. Today
the package covers the core (strings with fbtee, dates and numbers, the language in the address,
page titles and hreflang, `<html lang dir>`), but the example still does a lot of language plumbing
itself, and every Void feature we haven't used yet touches language too. Each piece the app does by
hand is something every app would redo, or forget.

Sources: Void 1.8.0's own docs (`apps/example/node_modules/void/docs/`, read 2026-11-13), the
package (`packages/void-fbtee/src/`) and the example (`apps/example/`), as of commit `931ec6a`.

## The test of "just works"

Make a fresh app with `void init`, add void-fbtee with `void-fbtee init`, then build from Void's
docs examples as written. Each one should come out right in every language: the right words, the
right direction, the right addresses, nothing stale in the cache. We already install the package
into fresh `void init` apps (`e2e/fresh/`); this extends it with Void's docs examples, one per
feature, so a gap shows up the day a new Void version adds or changes a feature.

## The map

For each Void feature: how it touches language, what happens today, and what the package should do.

### Pages and routing (`guide/pages-routing/`)

| Feature                                                               | Today                                                                                                                                      | The package should                                                                                                                                                                                       |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Addresses (`routeUrl`, `Link`, `c.redirect`, `useForm`, typed routes) | The app passes `lang` each time: 28 places in the example call `routeUrl` or `localizedPaths`                                              | Fill in the current language by itself, so `routeUrl("/[lang]/events")` needs no `params.lang`, and still type-check                                                                                     |
| Layouts and shared data                                               | `shared.i18n` from the middleware (`middleware.ts`)                                                                                        | Nothing more                                                                                                                                                                                             |
| Loaders and actions                                                   | `c.get("i18n")`                                                                                                                            | Nothing more                                                                                                                                                                                             |
| Form errors (`useForm`, `form.errors.*`)                              | Void shows the Zod message, which is English; the example writes its own translated message for each field (`pages/[lang]/events/new.tsx`) | Give Zod's messages in the page's language, so `form.errors.name` is already translated, as Void's own example uses it. An app can still write its own, plainer message for a field, as the example does |
| Not-found and error pages (`errors.md`)                               | Translated in the example; the tab title needed React 19's `<title>` by hand (`pages/_not-found.tsx`)                                      | A helper for the title, and `void-fbtee init` writing translated `_not-found.tsx` and `_error.tsx`                                                                                                       |
| Head (`head.md`)                                                      | `pageHead` from `void-fbtee/head`                                                                                                          | Nothing more                                                                                                                                                                                             |
| Islands                                                               | Read the language from `<meta name="void-fbtee">`                                                                                          | Nothing more                                                                                                                                                                                             |
| Markdown pages (`@void/md`)                                           | One copy per language under `pages/<locale>/`, stamped with `void-fbtee stamp`                                                             | Nothing more                                                                                                                                                                                             |
| `defer()` with Suspense                                               | Works; Void logs a console error (voidzero-dev/void#809)                                                                                   | Nothing: Void's to fix                                                                                                                                                                                   |
| View transitions (`view-transitions.md`)                              | Not used                                                                                                                                   | Check right-to-left pages slide the right way; mirror if not                                                                                                                                             |

### The edge (`guide/edge/`)

| Feature                                      | Today                                                                                          | The package should                                            |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Redirects                                    | `/` to the source language (`void.config.ts`), required by `void-fbtee check`                  | Nothing more                                                  |
| Prerendering                                 | `getPrerenderPaths = langParams`                                                               | Nothing more                                                  |
| Clearing the cache (`revalidate({ paths })`) | The app must list every language (`localizedPaths`); forgetting one leaves that language stale | A `revalidate` that clears a page in every language by itself |
| Cache bypass                                 | A request with a cookie skips the cache (`revalidation.md`, "Cache bypass")                    | Never use a cookie for the language (it doesn't)              |

### Server routes (`guide/server-routing.md`, `typed-fetch.md`, `sse.md`, `websockets.md`, `live.md`)

| Feature                     | Today                                                                                                | The package should                                                                                                                                             |
| --------------------------- | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API routes (`routes/api/…`) | The middleware leaves them alone, so they have no language (`routes/api/live.ts`)                    | Give a route a language when it's asked for one (the `Accept-Language` header or a `locale` parameter), for messages an API returns and for an MCP route later |
| Sitemap and robots          | The example's `routes/sitemap.xml.ts`, about 100 lines of Google's rules for multi-language sitemaps | Make the sitemap's pages part itself (every page in every language, with alternates); the app adds only its own entries, such as events                        |
| Live streams                | Numbers only; the page formats them                                                                  | Nothing more                                                                                                                                                   |

### Work with no request (`guide/jobs.md`, `queues.md`, `email/`)

Scheduled jobs (`defineScheduled(async (controller, env) => …)`) and queue consumers
(`defineQueue(async (batch, env) => …)`) run with no request, so there's no page language and
fbtee has no state: any translated text in them comes out wrong or fails.

| Feature                     | Today                                                   | The package should                                                                                                              |
| --------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Running in a given language | Only inside a request (the middleware's `runWithFbtee`) | `inLocale(locale, () => …)`: the same translations, dates and numbers, for a job, a queue message or anything else              |
| Email (`sendEmail`)         | Not used                                                | Write each email in the recipient's language, with its subject, through `inLocale`, and the recipient's language kept with them |

### Data (`guide/database.md`, `kv.md`, `storage.md`)

| Feature                  | Today                                                                                                                                                                                               | The package should                                                                                                                    |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Content people write     | The example's own pattern: `event_texts` holds a title and description per language; the page shows the reader's language, else the original, saying "translated by machine from…" or "written in…" | One pattern for this, from the package: the table's shape, the query that picks the reader's language with the fallback, and the note |
| Translating that content | Only the sample events are translated, by hand in a migration                                                                                                                                       | Translate new content once, when it's posted, with Void's AI (`void/ai`), in a queue so posting stays fast                            |
| KV and file storage      | Not used                                                                                                                                                                                            | Nothing, unless content in them is per language                                                                                       |

### Accounts (`guide/auth.md`)

| Feature                               | Today                                         | The package should                                                                                          |
| ------------------------------------- | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Sign-in (Better Auth, set up by Void) | Not used                                      | Translated sign-in pages and Better Auth's error messages, and each user's language kept with their account |
| Caching                               | Signed-in pages get `Cache-Control: no-store` | Nothing: per-user pages aren't shared anyway                                                                |

### Tests (`guide/testing.md`)

| Feature    | Today                                                      | The package should                                    |
| ---------- | ---------------------------------------------------------- | ----------------------------------------------------- |
| Unit tests | Work; the package keeps the Temporal polyfill under Vitest | `inLocale` for testing translated code outside a page |

## The order

Each step is shipped and proven before the next, each with its docs example in the fresh-app test.

1. [x] **The fresh-app test with Void's docs examples,** done 2026-11-13: `e2e/fresh/app/`
       holds Void's head(), loader, form (`useForm` with a Zod validator) and server-route examples,
       put into each fresh app (`e2e/fresh/check.ts`). Checked in Thai: head() and the loader work.
       Seven known gaps, each failing as expected, with its step: `inLocale` (2), a link without
       `lang` and `revalidate` in every language (3), the form's error in Thai (4: today it's Zod's
       "Too small: expected string to have >=1 characters"), a not-found page in Thai (5), the
       sitemap (6), a server route in the language asked for (10: today it answers `en-US`). A gap
       that starts working stops the run, so its step turns it into a check.
2. [x] **`inLocale`:** translation with no request, done 2026-11-13. `inLocale(locale, fn)`
       from `void-fbtee/server` (`packages/void-fbtee/src/server.ts`): the page's catalogs and
       fallbacks, through `await`, nested; a language the app hasn't is an error. Tested in the
       package (`test/server.test.ts`, built as a Worker is) and in the fresh app, where Void's
       scheduled job example runs through Void's dev trigger (`POST /__void/scheduled`); a job that
       throws gets a 500, so the check fails when the text is wrong. Found on the way: strings were
       collected only from pages/, routes/, src/, components/, lib/, so a string used only in a job
       or an email was never translated; now every folder of code in Void's project structure
       (`reference/structure.md`) too. The other helpers for server code (`localizedPaths`,
       `langParams`, `inEveryLocale`, `siteOrigin`, `appLocales`) are still in
       `void-fbtee/middleware`: they move to `void-fbtee/server` in step 3, with `revalidate`.
3. [x] **Addresses and clearing the cache in the current language,** done 2026-11-13.
       `routeUrl` from `void-fbtee/routes` (`src/routes.ts`): Void's, typed against the app's routes
       as Void's is, with `lang` optional; it takes the current language (`src/current.ts`): on the
       server the request's (the middleware, `withLang`) or `inLocale`'s, held in an
       AsyncLocalStorage (`src/server.ts`); in the browser the page's (`<meta name="void-fbtee">`, as
       islands read it). `routeUrl("/[lang]/docs/tour")` takes a markdown page, and type-checks only
       if it exists in every language. `useForm` from `void-fbtee/react`: Void's, with the page's
       language filled in. `revalidate` from `void-fbtee/server`: Void's, with `"/[lang]…"` cleared in
       every language. The server helpers moved there from `void-fbtee/middleware` (`localizedPaths`,
       `langParams`, `inEveryLocale`, `siteOrigin`, `appLocales`). The example: every link, both
       forms, the post's redirect and both cache clears use them; only the sitemap (each language
       on purpose) and the breadcrumbs (the event's own language) still pass `lang`. Checked on dev:
       every page links in its own language, also after Void's client navigation; both forms post
       to their page's action; a post in Arabic lands on the Arabic event page. Package tests for
       routeUrl (`test/server.test.ts`); in the fresh app the two gaps are now checks.
4. [x] **Translated form errors,** done 2026-11-13. When the app has Zod 4, the plugin makes
       `virtual:void-fbtee/zod` (`zodMessages`, `src/plugin.ts`): Zod's own message sets for the
       app's languages (a locale's own, else its language's; English where Zod has none), and the
       middleware points Zod's `localeError` at the current request's language (`currentLocale` in
       `src/server.ts`). An app's own messages still win: Zod ranks `localeError` below them. Without
       Zod 4 it does nothing; Valibot and other libraries aren't covered. Package tests: German and
       Arabic messages, an app's own message kept, English with no language. In the fresh app the gap
       is now a check.
5. [x] **Not-found and error pages from `void-fbtee init`,** done 2026-11-13. `init` writes
       `pages/_not-found.tsx` and `pages/_error.tsx` (`NOT_FOUND`, `ERROR` in `src/init.ts`) when
       the app has none and has a home page under `pages/[lang]/` (their link home goes there; else
       a line to run init again). Their strings are the example's, so the example's catalogs
       translate them. No title helper after all: React 19's own `<title>` with an `fbs(…)` string
       is one line, and the template shows it. Package tests for the three cases; in the fresh app
       the gap is now a check (the Thai page and its Thai tab title).
6. [x] **The sitemap from the package,** done 2026-11-13. `sitemap(c, { pages, exclude })` from
       `void-fbtee/server`: every page under `pages/[lang]/` whose only parameter is the language,
       from Void's own list of the app's pages (`PagePathMap` in the `.void/routes.d.ts` Void
       generates; `langPages` in `src/plugin.ts`), and every markdown page in every language, with
       the example's rules (alternates, x-default, `<lastmod>` only where real). `init` writes
       `routes/sitemap.xml.ts` when the app has none. The example's sitemap is now `sitemap()` with
       its events and dates (about 100 lines to 40; `fast-xml-builder` removed). Its output on dev
       matches the live site's old one: the same 18 non-event addresses, alternates and `<lastmod>`.
       Package tests for the list, the alternates and `<lastmod>`; in the fresh app the gap is now a
       check.
7. [x] **Translated content: the pattern,** done 2026-11-13; translating it with AI is planned
       separately (below). `textLocales(locale)` and `pickText(rows, locale)` from
       `void-fbtee/server`: which stored translation to show, the page's language then its
       fallbacks. `langAttrs(locale)` from `void-fbtee/react` (`src/locales.ts`): `lang` and `dir` for
       text in a language of its own. The example used `lang` alone, so an Arabic post on an English
       page was laid out left to right; now every post's title, description, original, breadcrumb and
       venue carries both (the venue had neither; in a sentence it's in a `<bdi>`). Both events pages
       pick the translation with them (the board in a second query, so fallbacks can't double a
       row). Checked on dev: an untranslated Arabic post is `ar-EG`/`rtl` on the English board and
       page; the Arabic original under a Thai translation too. Package tests for the three.
   - **7b, done 2026-11-13: machine translation with Void's AI, in a queue, the same locally and
     on Cloudflare** (asked for 2026-11-13; decided: one queue, two translators). One consumer
     (`queues/translate.ts`), sent on each post (`new.server.ts`). On Cloudflare it asks Workers AI
     (Llama 3.3 70B, by the measure below); locally Workers AI is off (`inference.bindings.ai` in
     `void.config.ts`, on only with `WORKERS_AI=on`, which the deploy tasks and the preview build
     set), so the consumer finds AI "Not available" and leaves the post for Claude, who translates
     through a dev-only route (`routes/api/translations.dev.ts`: lists what's waiting, stores
     translations). Both store through one function (`src/events/translations.ts`), which also
     clears the pages and tells open pages (live), so a page reloads its data when its translation
     arrives. Checked on dev: a post with Workers AI off waits, then my translations through the
     route show in Thai and Arabic; with `WORKERS_AI=on`, Workers AI translated a post in 4 s and
     an open Thai page changed from English to Thai with no reload. The build has the AI binding
     only with the switch, the queue always; the dev route isn't in the build. The events browser
     tests pass at their old speed (no Cloudflare connection). This is the 2026-11-11 design
     (`5d1d47b`, removed 2026-11-12 in `a4eb631` because `void/ai` made every local run connect
     to Cloudflare), now with that connection only where it's wanted. Its tsconfig entries for the
     queue's types are back. Found along the way, earlier: Posting an event sends a queue message; the consumer
     translates the title and description into each of the app's languages with Void's AI
     (`void/ai`), stores them (`event_texts`) and clears those pages (`revalidate`). Found
     2026-11-13:
     - Queues: locally a send runs the consumer in Miniflare, the same handler as in
       production, and `POST /__void/queue` (with the dev trigger token) runs a batch by hand
       (`guide/queues.md`, "Local development"); no login. On Cloudflare, Void's deploy creates
       and wires the queue, as the example's deploy already does for what's missing (README,
       `vp run deploy`).
     - AI locally, tried in a plain Void 1.8.0 app with no Cloudflare login: the dev server
       starts; `ai.run()` throws "ai: Not available. Configure a Workers AI binding…", and Void
       logs "AI requires authentication. Run `void account login`, then restart the dev server"
       (the docs say `void cloudflare login`). So with no login, dev and the tests here and in
       CI run, and a post isn't translated: the consumer leaves it as written, never fails.
     - AI on Cloudflare: the deployed Worker has the binding (Workers Builds deploys with its
       own token).
     - Models (Cloudflare's model pages, checked 2026-11-13): `@cf/meta/m2m100-1.2b` is Workers
       AI's one general translation model (many-to-many, Arabic and Thai among them;
       `{ text, source_lang, target_lang }`; zero data retention; $0.342 per million tokens in
       and out). `@cf/ai4bharat/indictrans2-en-indic-1B` is for Indian languages only. A text
       model (`@cf/meta/llama-3.3-70b-instruct-fp8-fast`, the one Void's docs show) translates
       when asked and is likely better at Thai, unmeasured. The sample events' human
       translations (`db/migrations/20261111064630_sample_events.sql`) are the measure to
       compare them on, once there's a login to run them.
     - To decide: the login for AI in dev (Void's own `void account login`, approved in the
       browser as `cf`'s is; or none, so posts are only translated on Cloudflare), then the
       model, by that measure.
8. [x] **Email in the recipient's language,** done 2026-11-13, live sending too.
       The example sends a booking's confirmation (`src/events/booking-email.ts`, now `src/events/emails.ts`) in the booker's
       language, kept with the booking (`bookings.locale`), through `inLocale`, so the same code can run
       in a queue: the subject, greeting, the event's title as they read it (`pickText`), its start on
       the place's clock, and its page in their language; HTML in the email's own `lang`/`dir`, the
       title in its own (`<bdi>`). Void's `sendEmail` never throws, so a booking can't fail because of
       it. The request's `locale` is now typed as one of the app's (`SharedI18n.locale: AppLocale`),
       what `inLocale` takes. Checked: Void's test harness (`void/email/testing`) in the example's unit
       tests; a booking in Thai on dev lands in Void's dev inbox in Thai; the events browser tests,
       where a production build answers `BINDING_MISSING` and the booking goes through; importing
       `void/email` leaves the Worker's settings as they were (the built `wrangler.json`, all 12).
   - Live sending, done 2026-11-13: `email.from` in `void.config.ts` is
     `void-fbtee <events@events.ubuntusoftware.net>`, a mail subdomain of `ubuntusoftware.net` (a
     zone on the account, whose apex mail is left alone). `void email setup --platform cloudflare`
     turned on Email Routing and Email Sending for the subdomain and plus addressing for the zone,
     and recorded the binding in `void.lock.json`. The account sends to any address (recipient mode
     "arbitrary", 1,000 a day). The deploys don't pass `--require-email`: Workers Builds' token can't
     read the email settings, so that check refused the first deploy though sending was set up.

9. **Sign-in,** when the example needs accounts.
10. **API routes with a language,** with the MCP route when that's planned.

The tests deleting what they post (`plans/tidy-ember-ledger.md`) is separate and can go first.

## Not in this plan

- Void features with no language in them: deployment, the Void platform, sandboxes, Durable
  Objects (unless they hold per-language content).
- Choosing a language for the visitor: one address per language, never a redirect by the
  visitor's language (the reason is in `void.config.ts`).

## Verification

Every step: `vp check`, the package tests (`vp test run --project void-fbtee`), the example's unit
tests (`vp run example#test`), and the fresh-app test for that step, which must fail before the step
and pass after it. After a push: CI's `vp run test:deployed`.
