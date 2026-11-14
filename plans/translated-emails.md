# plans/translated-emails.md: translated emails, documented by the package and shown by the example

Status: approved by the user 2026-11-14 and done the same day (committed locally).

## Why

The example is void-fbtee's documentation and proving ground: everything it does shows and tests
what the package gives an app. It sends its emails in each person's own language (booking,
reminder, cancellation, the private link), but nothing in the package or on the docs site says how,
and what we learned doing it (2026-11-13) lives only in the example's code.

## What's already in the package (checked 2026-11-14)

An email needs nothing new from void-fbtee: the example's emails already use only the package's
own API.

- `inLocale(locale, fn)` (void-fbtee/server): the email is written in the recipient's language,
  and gets `{ locale, dir }` (apps/example/src/events/emails.ts).
- `langAttrs(locale)` (void-fbtee/locales, also void-fbtee/react): `{ lang, dir }` for text in
  another language, the same helper the pages use for an event's title and venue
  (pages/[lang]/events/[id].tsx, lines 363-410).
- `routeUrl` (void-fbtee/routes): the email's link in the recipient's language.

A void-fbtee email helper would only rename these. Void leaves the HTML to the app (`sendEmail`'s
`html` is a string: node_modules/void/docs/guide/email/sending.md), so the package stays out of how
an email is built (React Email is the example's choice).

## What's missing, and the change

### The package: say how (SKILL.md and README)

A "Translated emails" part in the SKILL's "Server code with no page" section, and a short one in
the README, any email builder:

1. The email in the recipient's language: `inLocale` (already there).
2. `lang` and `dir` on the content's outer element too, not only `<html>`: Gmail drops `<html>`,
   `<head>` and `<body>` and keeps what's inside, so an Arabic email showed left to right.
3. A builder's own defaults: React Email's `Body` says `dir="ltr" lang="en"` unless given the
   email's own.
4. Text in another language (an event's title) in `<bdi {...langAttrs(its locale)}>`, as on pages.
5. A written-out address in a right-to-left email: `dir="ltr"`, or its parts come out reversed.
6. Images sent inside the email (Void's inline attachments, `cid:`), so they show wherever it's
   read, dev's inbox on localhost included.

Each points to the example's code that does it.

### The example: emails shown like every other feature

The site shows each feature three ways; emails get all three.

1. **Home page, a feature card** (src/home/HomeSections.tsx, `features()`, beside "Strings, by
   fbtee" and "Dates and times, by Temporal"): "Emails in each person's language", a mail icon,
   three facts the code and docs back (written in the recipient's language, not the visitor's who
   caused it; right to left in Gmail too; Void's dev inbox catches them, so tests read them), and
   a link to the Emails page.
2. **The tour, a section** (pages/en-US/docs/tour.md, and its Arabic and Thai translations, as its
   other sections): "Emailed in your language", walking through the demo: book a seat, get the
   email in your own language; the organiser gets theirs in theirs; a cancellation reaches
   everyone booked, each in their own. With the code that does it, as the tour's other sections
   show theirs.
3. **Reference, an Emails page** (below).

### The example: an Emails docs page

`/[lang]/docs/emails`, under Reference beside Intl and Temporal (src/docs/DocsLayout.tsx). It
shows the example's real emails, made by its own code (src/events/emails.ts) for a fixed sample
event, in the page's language: the subject, the text version, and the HTML as a mail app gets it
(in an iframe, the logo shown from the page's own file since `cid:` only works in a mail app). A
short text for each point above, with the file and line that does it. Prerendered in every
language like Intl (fixed data). Its strings translated into Arabic and Thai like the others.

## Checks

- `vp check`; the example's unit tests (emails.test.ts unchanged, plus one for the page's loader).
- The dev tests that open each docs page in every language include the new page; the home page's
  new card and the tour's new section in all three languages.
- Its translations: `void-fbtee check` all good.
- Commit locally; push when the user says.

## Found while doing it

- Code in the Arabic markdown pages ran right to left: code blocks and inline code took the page's
  direction, so `=>` showed as `<=` and brackets reversed (the tour's existing blocks too). Fixed in
  pages/style.css: markdown code is left to right and isolated from the sentence around it.
- Not changed here: on the tour's "Formatted for you" list, each value drops to its own line and the
  first item has no bullet, in every language (the `<Fmt>` islands in list items).
