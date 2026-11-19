---
name: void-fbtee
description: Translate a Void app that uses void-fbtee (fbtee strings in i18n/translations/, markdown pages under pages/<locale>/) and fix its i18n setup. Use when asked to translate the app, add a language, update translations or fix what `vp dev` or `vp build` reports.
---

# Translate a Void app with void-fbtee

The app's own Vite+ commands do the work; there are no i18n scripts or other commands. Setting
an app up is the one void-fbtee command: `vp exec void-fbtee init`. After that:

- `vp dev` prepares: as it starts and on each save, every new string goes into every catalog,
  marked new. Straight after, it translates what's new with Void's AI (Gemini 4 Hydrogen, one
  string a request, each answer checked), then Claude Code for what that leaves: a signed-in
  `claude -p` with this skill, else a prompt in its log ("void-fbtee: … entries with "status":
  "new""); a coding agent given it translates by this skill. Each entry records who translated
  it (`translatedBy`, `translatedAt`), and what it cost (`usage`, when Void's AI made it). It
  records each markdown page you mark done and reports
  what's left, until "all translated, nothing to fix".
- `vp build` (and so `void deploy` and CI) fails on anything left or broken: untranslated strings
  and pages, a translation missing a line or a `{placeholder}` (the check `vp dev` runs on each
  answer), setup problems, a removed language's leftovers. Its message lists them. Nothing
  translated is ever set back to new.
- `vp check` runs fbtee's lint rules (text no one wrapped for translation).

Translate only this way, never by other means, so the app's own tooling is what's used.

## Strings

1. The catalogs are in `i18n/translations/`, one per language (the languages come from
   `voidFbtee()` in `vite.config.ts`), already prepared by `vp dev`: new strings have
   `"status": "new"`, fbtee's built-in strings included. Don't run `fbtee collect` or
   `fbtee prepare-translations`: the dev server does that.
2. Translate every entry with `"status": "new"` by fbtee's own skill,
   `node_modules/fbtee/skills/fbtee-translate/SKILL.md`, steps 3 to 5, into the catalog's locale
   (the code: `ar-EG` is Egyptian Arabic, `ar-SA` standard Arabic): each line for its plural form
   or gender, every `{placeholder}` kept. Then mark the entry done: `"status": "translated"`, with
   `"translatedBy": "claude"` and `"translatedAt"` the day (YYYY-MM-DD).
3. What's specific to editing a void-fbtee app's catalogs is below.

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
locale; the dev server writes them, you edit them, nothing else under `i18n/`. Locales:
`voidFbtee({ sourceLocale, locales })` in `vite.config.ts`. The source locale (the code's language)
takes its text from the code, so it usually has no catalog. The exception is a source language with
more plural forms than a `<fbt:plural>` can write in the code (the text for exactly 1, and `many` for
the rest): an app written in Arabic, say. Then the dev server makes a catalog for the source language too,
holding only the strings with a count. You write each form there in the source language itself, so
2, 11 and 100 each get their own grammar. Its lines are marked `"status": "new"` like any other.

**Gender, in the catalog.** A `<fbt:name>` entry has `"types": [3]`, and the dev server gives it
one line per gender, `variations` `{"0": 1}` male, `{"0": 2}` female, `{"0": 3}` unknown, in every
language: fill all three, the same sentence where the language doesn't change its words. With a
count too, a line for each gender and plural form, each keyed by its own token's index. A sentence
spoken to the reader that changes by the reader's gender has `subject={gender}` on its `<fbt>` in
the code (below): it gets `"tokens": ["__subject__"]` and its three lines the same way. Never add
tokens by hand, and never change the hash keys.

**Plurals, in the catalog.** A string with a count has one line per plural form the language uses
(the dev server adds them; fbtee's own prepare-translations doesn't). Each line's `variations`
names its form by fbtee's code: 16 zero, 4 one, 8 two, 20 few, 12 many, 24 other. Don't add or
remove lines.

## Writing strings

When you write or change the app's code, mark every piece of text a person sees as you write it,
each with a description: `<fbt desc="Button that saves the event">Save</fbt>`. That's writing the
code, not translating:
`vp dev` collects what's marked and translates it, and nothing marks text for you. Text left
unmarked is never translated; `vp check` reports it (fbtee's `no-unwrapped-strings`), so fix it
there. Names that stay as they are (the app's own, a product's) go in that rule's `ignoredWords`.

**The description is all a translator knows** of the text, with the code around it: Void's AI is
sent it with every string, and so is Claude Code. So it says:

- what's happening and to whom: "Told to the reader right after they book a seat at an event:
  their seat is confirmed", not "Told to the reader who just booked" (a seat, a table or a job?);
- which sense a word has, where it has several ("book a seat", "open a page", "post an event");
- what each placeholder holds, and which is which: "{translated} is how many strings are
  translated, {total} how many there are"; "{price} is an amount of money, already formatted";
  "{pages} is the names of the site's pages, joined as an 'or' list". fbtee has no description
  for a placeholder, so the string's description names them;
- then where it shows: "Booking form error", "Heading of the events page".

A description is part of the string's key (fbtee hashes the text and its description), so a new
description makes a new entry: `vp dev` translates it again.

`<fbt>` for text in components; `fbs("…", "…")` wherever a plain string is needed: an attribute
(`aria-label`, `placeholder`), a title, an email, anything stored or sent. `fbs` returns a string
as it is; never `String(fbt(…))`, which can give "[object Object]" (fbtee's lint rule `prefer-fbs`
reports it). A label used on several pages is a common string: once in `voidFbtee({ common })`
(text → description, e.g. `{ Save: "Button label for saving changes" }`), then `<fbt common>Save</fbt>`
or `fbs.c("Save")` everywhere. In server code (an email, a job, a page title), a number in an `fbs`
string is `fbs.param("count", n, { number: true })`: fbtee formats it the language's way. In a
component, format it in `<Formatted>` instead (below).

Part of a page in another language (a row for a Thai reader on an English page) goes in
`<InLanguage locale="th-TH">` from `void-fbtee/react`. Inside it, a component that translates
calls `const { fbt } = useFbt();` (from `fbtee`) and uses that `fbt`; plain `<fbt>` stays in the
page's language. `gender` (`"male"`, `"female"` or `"unknown"`) is the reader's, only when the
person gave it. A sentence said to the reader that changes with their gender (Arabic's "you're
booked") says so in the code: `<fbt desc="…" subject={gender}>`, with fbtee's
`IntlVariations.GENDER_MALE`, `GENDER_FEMALE` or `GENDER_UNKNOWN`. Use fbtee's other pieces as its
README describes: `<fbt:list>` for a list in a sentence (not
`String(list(…))`), `<fbt:enum>` for a choice from a fixed set, `<fbt:name>` and
`<fbt:pronoun>` for a person's gender, `<fbt:same-param>` for a value used twice.
For choosing another language, use `<LanguagePicker />` from `void-fbtee/react`, not a row of
links: it reads the app's languages from `voidFbtee({ locales })` (never list them yourself), puts
the visitor's own first, and has a search box. It has no look: pass `classNames` per part, in the
app's own styling, and its words (`label`, `placeholder`, `yours`) as the app's fbtee strings
(`fbs("Language", "…")`), so they're translated with the rest.
Not fbtee's own language switching (`createLocaleContext`, `useLocaleContext().setLocale`): with
void-fbtee each language has its own address, so a page never changes language where it stands; a
link to the other language's address does.

## Dates, numbers and names in components

Data stays neutral: a time is a UTC instant or a `Temporal.ZonedDateTime` with its zone name, a
number is a number, money is a number with a currency code. Never store, send or compare
formatted text. A form sends neutral values too (a `datetime-local` gives `"2026-04-01T20:00"`;
read a number typed the language's way back to a number in the browser before sending it).

Money in a sentence is a plain `<fbt:param>` holding the amount `Intl` formatted, currency and
all: never `number={amount}`, which makes fbtee treat it as a count, with a line per plural form.
Write "Your ticket costs {price}.", never "{price} euros".

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

### Translated PDFs

A PDF (a ticket, an invoice, a receipt, a report) is server code with no page too: write it with
`inLocale` in its reader's language, the one saved with them. Make it a page of HTML and have a
real browser print it, Cloudflare Browser Run (`env.BROWSER.quickAction("pdf", { html })`): a
browser joins Arabic and lays it right to left, and breaks Thai between words, which PDF libraries
that draw text themselves get wrong. Then:

- **System fonts only:** name `system-ui, sans-serif`, as the pages do. Cloudflare's Chrome has
  fonts for Arabic, Thai and the rest, so the app ships none.
- **`<html lang dir>`** in the reader's language, and `<bdi {...langAttrs(its locale)}>` around
  text in another, as on a page. A written-out address gets `dir="ltr"`.
- **Not while anyone waits:** printing takes up to a second and the free plan allows 3 browsers at
  once, so print in a queue, with retries.
- **Print once, keep it** (R2, through `void/storage`): browser time is the cost (10 minutes a day
  free).
- **Setup:** `cloudflare: { browser: { binding: "BROWSER", remote: true } }` in `void.config.ts`
  (it runs on Cloudflare in dev too, through Void's sign-in), and a compatibility date of
  `2026-03-24` or later for `quickAction`.

The example prints each booking's ticket, attaches it to the booking's email and offers it for
download (its PDFs docs page shows one, with the code: `src/pdf.ts`, `src/events/tickets.ts`,
`src/events/TicketLayout.tsx`, `queues/ticket.ts`).

Testing translated server code the Void way: in unit tests, Void's email harness
(`createEmailTestHarness` from `void/email/testing`) catches each email, so its subject and text can
be checked in each language; on the dev server, Void's inbox holds them (`/__void/inbox`, with the
token in `.void/dev-trigger-token`), and Void's triggers run a queue or a cron on demand
(`POST /__void/queue`, `POST /__void/scheduled`), so a test can check the email a job sent in the
recipient's language.

## What people post

Text people write (an event's title, a review, a message) isn't in the catalogs: it's stored, in
the language its writer wrote it in. void-fbtee translates it into the app's other languages. The
table needs a text `id` and a `locale` column, the language each row was written in, and the
fields to translate are text. Name the table and its fields, once, in the app's folder:

```sh
vp exec void-fbtee gen translations events title description
```

It writes ordinary files at Void's own places. The translations table is kept by void-fbtee, as
Void keeps Better Auth's tables; the rest are the app's, written once and never over one that's
there (what it can't write, it says):

- `db/schema/events_translations.ts`, kept by void-fbtee (its first line says so), re-exported from
  `db/schema.ts`. The app's part is one line, the list of fields,
  `export const events_translations_fields = ["title", "description"] as const`: change it to
  translate other columns (text ones). The rest is the package's table: the row's id, the
  language, the fields as JSON typed through that list from the table's own columns
  (`Pick<typeof events.$inferSelect, …>`), who made it (`translatedBy`, the AI Gateway log, what it
  cost, what it was made from). `vp dev` rewrites the rest whenever it isn't the package's current
  table (after upgrading void-fbtee, say), and says so: then run `vp exec void db generate` in a
  terminal, for its migration. `vp build` never rewrites it: it fails while it isn't. The app's
  formatter is welcome (quotes, semicolons, commas don't count). Deleting a row deletes its
  translations (the foreign key cascades).
- `src/content.ts`: `export const content = translatedContent(schema, { db, queue })`, the app's
  schema (`import * as schema from "@schema"`), its database session and its translate queue
  (`queue: (): TranslateQueue => queues.translate`, typed by Void from `queues/translate.ts`; the
  annotation keeps the two files' types from depending on each other) handed to the package
  once. Everything `content` gives is typed from the schema: `content.textOf(events, …)` gives the
  events' own fields, and a table with no translations, or a field it doesn't translate, doesn't
  compile.
- `queues/translate.ts`: `translationQueue(content)` from `void-fbtee/queues/translate`, with
  `void/ai` imported and the retries written there, since Void reads them from the app's own files
  (`vp build` fails while `void/ai` isn't imported). To refresh pages, tell open ones or take the
  next step when a translation lands, pass `{ onTranslated }`; add
  `onTranslationFailed(table, id, locales)` for what mustn't wait for a retry (it's called each
  time those languages fail: the app goes on with the row as written).
- `crons/translations.ts`: `translationsCron(content)` from `void-fbtee/crons/translations`, the
  daily job, keeping every row in the app's languages both ways: translations into a language the
  app no longer has are deleted, and anything missing (or `unknown`) is queued.
- `middleware/99.i18n.ts`: `i18nMiddleware({ content })` from `void-fbtee/middleware`, so a page
  that showed a row not yet in its language asks for the translation. Without it, that page's log
  says so.

`vp build` fails, saying the line to add, while one of the app's files is missing or not wired to
the content, as Void would wire Better Auth's routes itself.

To show it, from the app's `content`: `content.translationsFor(events, ids, locale)` gets the
stored translations a page in `locale` can show, and `content.textOf(events, row, translations,
locale)` gives the row's fields in the best of them, else the original. A page that showed a row
not yet in its language isn't kept in Void's page cache, and the translation is queued then (the
middleware): a new post is translated the first time it's read in another language. To queue one
at once, call `content.translateSoon(events, id)` as it's posted, and
`content.translateSoon(events, id, { changed: true })` when it's changed (asked at once, whatever
was asked in the last hour): each translation keeps a fingerprint of the fields it was made from
(`translated_from`), so a changed row is translated again, its old translation shown until the
new one lands (a page that reads it asks for it too).

Read the app's database through a session that starts on D1's main copy,
`createDb(env.DB, { session: "first-primary" })` (the `primaryDb` in `src/content.ts`), as Void's
own `db` may read a replica that hasn't caught up. Open one per loader, action, queue message or
cron, and pass it to these functions as their last argument
(`content.translationsFor(events, ids, locale, db)`, `content.translateSoon(events, id, {}, db)`),
so all their reads share it: each session's first read is a trip to the main copy. Without one,
each opens its own.

Mark the element showing it with its own language, whichever that is, by spreading
`langAttrs(locale)` from `void-fbtee/react` on it (`<h1 {...langAttrs(text.locale)}>`): `lang` for
screen readers and search engines, and `dir`, so Arabic posted on an English page reads right to
left. Inside a translated sentence, put it in a `<bdi {...langAttrs(locale)}>` in the
`<fbt:param>`, so its direction doesn't reorder the sentence around it. Say when it's shown in
another language than the page's, in the page's own words (`<fbt>`, with the language's name from
`Intl.DisplayNames` in `<Formatted>`): "Written in Arabic", or "Translated by machine from Arabic"
with the original one click away.

Void's AI translates it (Gemini 4 Hydrogen, the same model as the app's own text) on Cloudflare in
dev and the preview too, through Void's Cloudflare sign-in (`void cloudflare login`), paid from the
account's AI Gateway credits (Unified Billing, no key); for the preview, mark the binding remote in
`void.config.ts`: `cloudflare: { ai: { binding: "AI", remote: true } }`. Each language is stored as
soon as it's translated, so a retry pays only for what's still missing; while the account isn't
paying (credits used up, a spend limit reached) a message waits an hour. Each keeps what it cost
(`usage`). Posts go to Google's Gemini, and aren't kept in AI Gateway's logs (`collectLog: false`):
their log has the model, tokens and cost, not the text. The example (github.com/joeblew999/void-fbtee,
`apps/example`) shows all of it.

## Markdown pages

Pages under `pages/<source locale>/` have a copy per locale at the same path under
`pages/<locale>/` (the locale's URL segment). Translate the whole file:

- **What's translated, what's kept:** the text, and the frontmatter's `title` and
  `description`, into the page's locale; the Markdown structure, code blocks (their comments
  too), links, components, the `<script>` block and the other frontmatter keys exactly as they
  are (`vp build` checks the kept parts match the original's).
- **Dates, times, numbers:** a page shows them through a component that formats them with `Intl`
  (an island, with the value as a prop), not as written-out text. Leave the component as it is;
  if the original has one written out, keep it as written and say so in your summary. An island
  goes on a line of its own, between paragraphs: @void/md cuts the page's HTML at each island, so
  one inside a list item, a table or a sentence breaks the HTML around it (the list falls apart).
- **translatedFrom:** each translated page records the original it came from in its frontmatter.
  Don't write its value yourself: when a page is done (translated, or checked and right), set
  `translatedFrom: done`, and the dev server replaces it with the original's version. Say who
  translated it, as entries do: `translatedBy: "claude"` and `translatedAt:` the day; `vp build`
  fails on a page that doesn't say. For a page
  reported out of date, compare it with the original and change only what changed.

## Reviewing

`vp dev` has Void's AI translate, then asks Claude Code to review what the AI wrote: a signed-in
`claude -p`, else a prompt in its log ("Review this Void app's machine translations"). An entry to
review has `"translatedBy"` an AI's id or `"unknown"` (not `"claude"`) and no `"review"`; a
translated page to review, the same `translatedBy` in its frontmatter and no `reviewedBy`.

Every translation says who made it (`translatedBy`), and `vp build` fails on one that doesn't: a
model's id (with `gatewayLogId`, the AI Gateway log of the request, and `usage`, what it cost,
when Void's AI made it), `"claude"`, or `"unknown"` for one from before this was recorded.
An `"unknown"` one is reviewed like an AI's. Never write `"unknown"` for one you translate.

1. Read each such entry as a reader of the language would: its description and source lines, and
   the code around the string if you need it. Judge it as a reader of that locale would: the
   meaning kept, the locale's own words and grammar (each plural form for its count, each gender
   line), the app's words for its terms, product names, commands and file names kept.
2. Right: add `"review": { "by": "claude", "at": "<YYYY-MM-DD>", "verdict": "ok" }`.
3. Wrong: correct the lines, set `"translatedBy": "claude"` and `"translatedAt"` to today, and add
   `"review": { "by": "claude", "at": "<YYYY-MM-DD>", "verdict": "wrong", "of": "<the AI's id it
   had>", "note": "<what was wrong, in a sentence>", "was": [<its lines as they were>] }`.
4. A page: read it beside its original, by the same rules (and "Markdown pages" above: the
   frontmatter's `title` and `description` translated, code, links and file names kept). Right:
   add `reviewedBy: "claude"` and `reviewedAt: "<YYYY-MM-DD>"` to its frontmatter. Wrong: correct
   it, set `translatedBy: "claude"` and `translatedAt` to today, and add `reviewedBy`,
   `reviewedAt` and `reviewNote: "<what was wrong, in a sentence>"`. Leave `translatedFrom` as it
   is.
5. Say in your last line what was wrong, if anything was. Then `vp dev` checks your corrections
   like any translation.

## Finish

Don't run anything: the dev server checks as you save and reports what's left in its log, and
`vp build` fails on it. Report one line per file: done, or what's left and why.

## Setup problems

If `vp dev` or `vp build` reports `setup:` problems, `vp exec void-fbtee init` fixes most of them (it only adds what's
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
- No redirect for `/` in `void.config.ts`: void-fbtee's middleware sends `/` to each visitor's own
  language (their browser's `Accept-Language`, matched by fbtee's rule), else
  `voidFbtee({ fallbackLocale })` (default the source language), with a 302 nobody caches. Every
  other address keeps its language. An app with its own `pages/index.*` sets
  `voidFbtee({ redirectHome: false })`. A fixed `"/"` redirect to one language (`init` wrote one
  before 0.6.0, and removes it) sends everyone there; the build reports it.
- tsconfig: `"fbtee/ReactTypes"` in `compilerOptions.types`; `"lib"` with `ES2025`, `DOM`,
  `DOM.Iterable`.
- Vite+: `lint.jsPlugins` with `@nkzw/eslint-plugin-fbtee` and fbtee's strict rules in the
  workspace root's `vite.config.ts` (`init` prints the rules). Strict also warns of text no one
  wrapped for translation (`vp lint` lists it); names that stay as they are (the app's,
  products') go in that rule's `ignoredWords`.
- A void-fbtee section in `AGENTS.md`. No scripts: an older init's `i18n:*` scripts are removed.

`vp build` checks every finished translation for what breaks the app (a line or a
`{placeholder}` missing), and reports it; it never sets one back to new, so a catalog from an older
version keeps its translations. Void's AI translates with Gemini 4 Hydrogen on AI Gateway credits
(no model to choose). A table's translation is told only its fields: what a table holds is no
longer sent.
