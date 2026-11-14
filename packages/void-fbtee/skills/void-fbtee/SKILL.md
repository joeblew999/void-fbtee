---
name: void-fbtee
description: Translate a Void app that uses void-fbtee (fbtee strings in i18n/translations/, markdown pages under pages/<locale>/) and fix its i18n setup. Use when asked to translate the app, add a language, update translations or fix void-fbtee check problems.
---

# Translate a Void app with void-fbtee

Commands: `void-fbtee --help` (run them with `vp exec` in a Vite+ app, else through the app's
package manager, e.g. `pnpm exec void-fbtee check`).

`void-fbtee translate` hands this work to Claude Code (`claude -p`). Run inside Claude Code, it
doesn't start a second one: it prints the prompt for the session it runs in. Then you do the work
here, by this skill.

## Strings

1. If you can run commands, run `void-fbtee prepare` first. It updates every locale's catalog in
   `i18n/translations/` (the locales come from `voidFbtee()` in `vite.config.ts`): new strings get
   `"status": "new"`. Use it instead of `fbtee collect` and `fbtee prepare-translations`; it also
   adds fbtee's built-in strings. If you were given a list of files, they're already prepared.
2. Translate every entry with `"status": "new"` by fbtee's own skill:
   `node_modules/fbtee/skills/fbtee-translate/SKILL.md`. Follow its steps 3 to 5 (match the
   locale's existing style, read each description and the source, keep placeholders exactly, then
   mark the entry done).
3. What's specific to void-fbtee apps is below.

**Page titles and descriptions.** A page's `head()` (Void's `defineHead`, in its `.server.ts`)
runs inside void-fbtee's per-request state, so its text is `fbs("…", "…")` and is in the catalogs
like any other string. Write it with `pageHead` from `void-fbtee/head`, which gives the same title
and description to link previews (`og:title`, `og:description`):
`export const head = defineHead(() => pageHead({ title: fbs(…), description: fbs(…) }))`.
Where the title is the page's heading, use the heading's own text and description: it's then the
same entry, translated once. A markdown page's title and description are its frontmatter's
`title` and `description`, translated with the page; the middleware gives them to link previews.
So a translated markdown copy keeps a translated `title` and `description` in its frontmatter. Structured data for search engines (schema.org JSON-LD) goes in the same `head()` as
`script: [jsonLd({ "@context": "https://schema.org", "@type": "Event", … })]` (`jsonLd` from
`void-fbtee/head`), never a script's `innerHTML` written by hand: Void writes it into the page as
it is, and `jsonLd` escapes what visitors typed so it can't end the script. Its text in the
language the page shows it in (`inLanguage`).

**Where things are.** Catalogs: `i18n/translations/<locale>.json`, one per locale except the source
locale; `prepare` writes them, you edit them, nothing else under `i18n/`. Locales:
`voidFbtee({ sourceLocale, locales })` in `vite.config.ts`. The source locale (the code's language)
has no catalog: its text comes from the code.

**A finished entry.** Set the text in `translations[0].translation`, keep every `{placeholder}`
exactly as written, and change `"status": "new"` to `"status": "translated"`. Leave `tokens`,
`types` and the hash keys as they are.

**Plurals.** A string with a count has one line per plural form the language uses (`prepare` adds
them; fbtee's own prepare-translations doesn't). Each line's `variations` names its form by
fbtee's code: 16 zero, 4 one, 8 two, 20 few, 12 many, 24 other. Write each line in that form's
grammar; the form a count falls in is `new Intl.PluralRules(locale).select(n)`, the rule fbtee's
runtime uses. A form may leave out `{number}` where the language does (Arabic two: "ليلتان").
Don't add or remove lines. A `<fbt:plural>` also comes as a separate entry for exactly 1 ("1 night"
next to "{number} nights"): translate both. A plural that hides its count (`showCount="no"`, "One
seat is left" / "seats are left") has its lines too.

**fbtee's built-in strings.** Every catalog has 12 from fbtee (`fbtee/Strings.json`): how `list()`
joins items and number labels ("{number}+"). Use the locale's own conventions; for the list
strings, CLDR's, which `Intl.ListFormat` prints (`new Intl.ListFormat("ar-EG").format(["A","B","C"])`
is `A وB وC`: no commas). `{ type: "disjunction" }` gives the "or" lists.

**Right-to-left locales** (`ar-EG`): void-fbtee sets `<html dir="rtl">`, so write natural text with
no direction marks (U+200E, U+200F).

## Writing strings

`<fbt>` for text in components; `fbs("…", "…")` wherever a plain string is needed: an attribute
(`aria-label`, `placeholder`), a title, an email, anything stored or sent. `fbs` returns a string
as it is; never `String(fbt(…))`, which can give "[object Object]" (fbtee's lint rule `prefer-fbs`
reports it). A label used on several pages is a common string: once in `voidFbtee({ common })`
(text → description, e.g. `{ Save: "Button label for saving changes" }`), then `<fbt common>Save</fbt>`
or `fbs.c("Save")` everywhere. In server code (an email, a job, a page title), a number in an `fbs`
string is `fbs.param("count", n, { number: true })`: fbtee formats it the language's way. In a
component, format it in `<Formatted>` instead (below).

## Dates, numbers and names in components

Data stays neutral: a time is a UTC instant or a `Temporal.ZonedDateTime` with its zone name, a
number is a number, money is a number with a currency code. Never store, send or compare
formatted text. A form sends neutral values too (a `datetime-local` gives `"2026-04-01T20:00"`;
read a number typed the language's way back to a number in the browser before sending it).

Text formatted while rendering (`Intl`, `toLocaleString`) goes in `<Formatted>` from
`void-fbtee/react`: `<Formatted>{new Intl.NumberFormat(locale).format(n)}</Formatted>`, inside an
`<fbt:param>` too. The server formats it; the browser keeps the server's text through hydration,
since each browser engine has its own locale data (Safari writes some values differently from
Chrome and the Worker), and a mismatch is React error 418. A list that comes from `Intl` (such as
`Intl.supportedValuesOf("timeZone")`) comes from the loader, not the browser. What only the
browser knows is formatted only by the browser: `useTimeZone()` is null on the server and while
hydrating, then the reader's zone, so render a time "in your time" as nothing until then (keep
its space), never a stand-in such as UTC. `useNow()` is the server's "now" while hydrating, then
the browser's (`useNow({ updateInterval: 60_000 })` reads it again each minute, for a page left
open); `useHydrated()` is for anything else of the browser's own.

The page's language: `useLocale()` in components; `c.get("i18n")` in loaders and actions
(typed, no cast: `const { locale } = c.get("i18n")`). Both are
`{ locale, dir, now, path }`. After a change, `revalidate` from `void-fbtee/server` (Void's, with
every language) refreshes a page: `revalidate({ paths: ["/[lang]/events", "/sitemap.xml"] })`
clears the events page in each language, and any path without `/[lang]` as it is. A page under `pages/[lang]/` that only a deploy changes is
prerendered in every language with `export const prerender = true;` and
`export const getPrerenderPaths = langParams;` in its `.server.ts` (`langParams` from
`void-fbtee/server`): it's cached until the next deploy, in each language. Void's own
platform also builds it during the deploy; an app deployed straight to Cloudflare builds it on
the first visit after each deploy (Void 1.7.0).

Links are built with `routeUrl()` from `void-fbtee/routes`: Void's own, with the language filled
in, so Void's typed routes still check each one. `routeUrl("/[lang]/events")` is the events page
in the current language: the page's in a component, the request's in a loader, action or route,
`inLocale()`'s in a job. Other parameters as in Void's (`routeUrl("/[lang]/events/[id]", { params: { id } })`),
and `params: { lang }` for another language. A markdown page has a route per language, and
`routeUrl("/[lang]/docs/tour")` takes it too: it type-checks only if the page exists in every
language. An action redirects the same way: `c.redirect(routeUrl("/[lang]/events/[id]", { params: { id } }))`.
Forms use `useForm` from `void-fbtee/react` (Void's, with the page's language filled in):
`useForm("/[lang]/events/new", { title: "" })`. With Zod 4 as the validator (drizzle-zod's or by
hand), `form.errors.name` is Zod's own message in the page's language (Zod's message sets, for each
of the app's languages Zod has; English for one it hasn't). A field's own plainer message
("Give it a title.") is still better: write it with `<fbt>` in the page and show it when the
field has an error, as the example does. Don't write a link as a plain string: Void checks
plain strings too, but the app's `pages/[lang]/` makes every `/…` path look like a page (its type is
`/${string}`), so a wrong one passes. A language the app doesn't have gets the not-found page from
the middleware. Where there's no current language at all (a server route that isn't in a
request's language, code outside `inLocale`), `routeUrl` says so: pass `params.lang`.

Every link is `Link` from `void-fbtee/react`, not Void's: it's Void's, but a link into another
language loads a fresh page, where Void's would keep the old language's text and `<html lang dir>`.
It works inside an island too. The language links: `useLocales()` is each of the app's languages
(`{ locale, segment, dir }`), and the same page in one is `` `/${l.segment}${path}` `` with `path`
from `useLocale()`; give each `hrefLang={l.locale}` and `lang={l.locale}`, and name it in its own
language with `Intl.DisplayNames` inside `<Formatted>`. On the server, `currentLocale()` from
`void-fbtee/server` is the current language (the request's or `inLocale()`'s; undefined outside
both), and `siteOrigin(c)` is the site's address (`voidFbtee({ site })`, else the request's), for
anything that writes full addresses.

## Server code with no page

Void runs scheduled jobs (`crons/`), queue consumers (`queues/`) and inbound email handlers with no
request, so there's no page language, and `fbs` there has nothing to translate with. Run the code
in a language with `inLocale` from `void-fbtee/server`: `fbs` and `<fbt>` inside are in it, also
after an `await`, with the same catalogs as a page. It gets `{ locale, dir }`, for Intl, Temporal
and an email's `dir`:
`const subject = await inLocale(user.locale, () => fbs("Your booking", "Email subject: a booking is confirmed"))`.
The language is one of the app's (a person's own, kept with them), never the page's of whoever
caused it: an email to an organiser is in the organiser's language, sent while a visitor books in
another. A language the app hasn't is an error. Strings in these folders are collected like any
other, so translate them the same way.

Links in an email go to where it was sent from: `new URL(c.req.url).origin` (the dev server, a
preview, or the live site), not `siteOrigin(c)`, which is the canonical, live address everywhere
`voidFbtee({ site })` is set; `siteOrigin` is for the sitemap, robots.txt and structured data. A job
or a queue has no request: keep the origin with what caused it (a booking's row, the queue message).

### Translated emails

An email is server code with no page, so it's written with `inLocale` in its recipient's language:
the one saved with them (a booking's, a user's), not the page's of whoever caused it. Void leaves
the HTML to the app (`sendEmail`'s `html` is a string), so whatever builds it, these make a
translated email arrive the right way round:

- **`lang` and `dir` on the content too**, not only on `<html>`: Gmail drops `<html>`, `<head>` and
  `<body>` and keeps what's inside, so an Arabic email marked only on `<html>` shows left to right.
  Put them on the content's outer element as well.
- **The builder's own defaults:** an email builder can write its own language around the content;
  React Email's `Body` is `dir="ltr" lang="en"` unless given the email's.
- **Text in another language** (a title as its author wrote it): `<bdi {...langAttrs(its locale)}>`,
  as on a page.
- **A written-out address** in a right-to-left email: `dir="ltr"` on it, or its parts come out
  reversed.
- **Images inside the email** (Void's inline attachments, `cid:`), not linked: they show in every
  mail app, and in dev, where the site's address is localhost.

The example does each (its Emails docs page shows them, with the code: `src/events/emails.ts`,
`src/events/EmailLayout.tsx`).

Testing translated server code the Void way: in unit tests, Void's email harness
(`createEmailTestHarness` from `void/email/testing`) catches each email, so its subject and text can
be checked in each language; on the dev server, Void's inbox holds them (`/__void/inbox`, with the
token in `.void/dev-trigger-token`), and Void's triggers run a queue or a cron on demand
(`POST /__void/queue`, `POST /__void/scheduled`), so a test can check the email a job sent in the
recipient's language.

## What people post

Text people write (an event's title, a review, a message) isn't in the catalogs: it's stored, in
the language its writer wrote it in. Keep that language with it (a `locale` column), and any
translations one row per language beside it: a table such as `event_texts` with the item's id,
`locale` and the translated fields, unique on the id and `locale`. Pick what to show with
`textLocales(locale)` and `pickText(rows, locale)` from `void-fbtee/server`: the page's language,
then its fallbacks (`voidFbtee({ fallbackLocales })`), else none, and then the original.

Mark the element showing it with its own language, whichever that is, by spreading
`langAttrs(locale)` from `void-fbtee/react` on it (`<h1 {...langAttrs(text?.locale ?? event.locale)}>`):
`lang` for screen readers and search engines, and `dir`, so Arabic posted on an English page reads
right to left. Inside a translated sentence, put it in a `<bdi {...langAttrs(locale)}>` in the
`<fbt:param>`, so its direction doesn't reorder the sentence around it. Say when it's shown in
another language than the page's, in the page's own words (`<fbt>`, with the language's name from
`Intl.DisplayNames` in `<Formatted>`): "Written in Arabic", or "Translated by machine from Arabic"
with the original one click away.

To translate it as it's posted, the example (github.com/joeblew999/void-fbtee, `apps/example`)
sends each post to a queue whose consumer asks Workers AI, and stores every translation through
one function, which also clears the pages and tells open ones. A page showing a post in a language
it isn't translated into yet sends `x-revalidate: 0`, so Void's page cache never keeps it in the
wrong language. Workers AI runs on Cloudflare in dev and the preview too, through Void's Cloudflare
sign-in (`void cloudflare login`); for the preview, mark the binding remote in `void.config.ts`:
`cloudflare: { ai: { binding: "AI", remote: true } }` (Void marks it so by itself only in dev).

## Markdown pages

Pages under `pages/<source locale>/` have a copy per locale at the same path under
`pages/<locale>/` (the locale's URL segment). Translate the whole file:

- **Translate:** headings, paragraphs, lists, link text, image alt text, and frontmatter values
  meant for people (`title`, `description`). Keep the keys, and values that are data (dates,
  numbers, slugs, file names).
- **Keep exactly:** the `<script>` block at the top (first in the file; its import paths stay the
  same), components and islands with their props, code blocks, inline code, URLs, HTML
  attributes, and the page's structure (same headings in the same order). That includes links to
  the site's own pages: they're written relative (`../events`, or `./other.md` for a markdown
  page, which @void/md turns into its route), so the copy's links stay in its language as they
  are. In an original, write them that way, never with the language (`/en-US/events`).
- **Boxes and alerts** (`::: tip …`, `> [!NOTE] …`): translate the title after the marker, and
  keep the marker (`tip`, `[!NOTE]`) as it is. The original gives every one a title (@void/md's
  own default titles are English: "TIP", "WARNING", "Details"); `void-fbtee check` reports one
  without, in the original or a copy.
- **Also keep exactly:** heading ids (`{#times}`, so `#times` links work in every copy) and other
  `{…}` attributes, footnote labels (`[^dst]`; translate the footnote's text), the keys in
  `<kbd>`, and code blocks with their meta (`{4} :line-numbers`) and `// [!code …]` comments.
- **Dates, times, numbers:** a page shows them through a component that formats them with `Intl`
  (an island, with the value as a prop), not as written-out text. Leave the component as it is;
  if the original has one written out, keep it as written and say so in your summary.
- **translatedFrom:** each translated page records the original it came from in its frontmatter.
  Don't write it yourself: `void-fbtee translate` records it, and after a hand translation run
  `void-fbtee stamp pages/<locale>/<path>.md`. For a page `check` reports out of date, compare it
  with the original and change only what changed.

## Finish

Run `void-fbtee check` if you can; it exits 1 and lists anything still missing. When
`void-fbtee translate` started you, don't run anything: it records the pages and runs check
itself. Report one line per file: done, or what's left and why.

## Setup problems

If check reports `setup:` problems, `void-fbtee init` fixes most of them (it only adds what's
missing; where it can't safely edit a file it prints the line to add). The pieces:

- `src/locales.ts`: the languages once (`export const locales = [...] as const`) and their type
  registered (`declare global { interface VoidFbteeRegister { locales: typeof locales } }`).
- `voidFbtee({ sourceLocale, locales })` from `void-fbtee/plugin`, first in `plugins` in
  `vite.config.ts`. Its `locales` is imported from `src/locales.ts`.
- `middleware/99.i18n.ts`: `export { default } from "void-fbtee/middleware";`. The 99 makes Void run
  it after the app's own middleware (01-98), since it adds to the shared and head data they set.
- `pages/layout.tsx` wraps its children in `<I18nProvider>` from `void-fbtee/react`.
- `routes/sitemap.xml.ts`: `export const GET = defineHandler((c) => sitemap(c))` (`sitemap` from
  `void-fbtee/server`): every page under `pages/[lang]/` whose only parameter is the language,
  and every markdown page that's in every language, each in every language with its alternates.
  The app's own pages go in `pages` (`{ path: "/[lang]/events/[id]", params: { id }, lastmod }`),
  a listed page's last change too (`{ path: "/[lang]/events", lastmod }`), and `exclude` leaves
  one out (a form). To keep it in Void's page cache, give `/sitemap.xml` a time in
  `routing.revalidate` (`void.config.ts`) and clear it with `revalidate` when a page is added.
- `pages/_not-found.tsx` and `pages/_error.tsx`: Void's not-found and error pages, in the page's
  language, with a link to the home page under `pages/[lang]/` (init writes them once that page
  exists, and never over the app's own). They take no `head()`, so their tab title is React's own
  `<title>` with an `fbs(…)` string.
- `worker: { compatibility_flags: ["temporal"] }` in `void.config.ts`. The Worker's own Temporal
  replaces `temporal-polyfill` there; unit tests under `vp test` run in Node.js and keep the
  polyfill.
- `routing: { redirects: { "/": { to: "/<source locale>", status: 301 } } }` in `void.config.ts`:
  Void's own redirect sends `/` to the source language.
- tsconfig: `"fbtee/ReactTypes"` in `compilerOptions.types`; `"lib"` with `ES2025`, `DOM`,
  `DOM.Iterable`.
- Vite+: `lint.jsPlugins` with `@nkzw/eslint-plugin-fbtee` and fbtee's strict rules in the
  workspace root's `vite.config.ts` (`init` prints the rules). Strict also warns of text no one
  wrapped for translation (`vp lint` lists it); names that stay as they are (the app's,
  products') go in that rule's `ignoredWords`.
- Scripts `i18n:prepare`, `i18n:check`, `i18n:translate`; a void-fbtee section in `AGENTS.md`.
