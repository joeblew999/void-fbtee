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
3. **Addresses and clearing the cache in the current language,** with the example's 28 places
   changed to use them.
4. **Translated form errors.**
5. **Not-found and error pages from `void-fbtee init`,** with the title helper.
6. **The sitemap from the package.**
7. **Translated content:** the pattern, then translating it with AI in a queue.
8. **Email** in the recipient's language.
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
