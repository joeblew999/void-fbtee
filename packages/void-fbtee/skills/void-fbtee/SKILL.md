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
next to "{number} nights"): translate both.

**fbtee's built-in strings.** Every catalog has 12 from fbtee (`fbtee/Strings.json`): how `list()`
joins items and number labels ("{number}+"). Use the locale's own conventions; for the list
strings, CLDR's, which `Intl.ListFormat` prints (`new Intl.ListFormat("ar-EG").format(["A","B","C"])`
is `A وB وC`: no commas). `{ type: "disjunction" }` gives the "or" lists.

**Right-to-left locales** (`ar-EG`): void-fbtee sets `<html dir="rtl">`, so write natural text with
no direction marks (U+200E, U+200F).

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
the browser's; `useHydrated()` is for anything else of the browser's own.

## Markdown pages

Pages under `pages/<source locale>/` have a copy per locale at the same path under
`pages/<locale>/` (the locale's URL segment). Translate the whole file:

- **Translate:** headings, paragraphs, lists, link text, image alt text, and frontmatter values
  meant for people (`title`, `description`). Keep the keys, and values that are data (dates,
  numbers, slugs, file names).
- **Keep exactly:** the `<script>` block at the top (first in the file; its import paths stay the
  same), components and islands with their props, code blocks, inline code, URLs, HTML
  attributes, and the page's structure (same headings in the same order). One exception: a link
  to another page of the site points to that page in the copy's language (`/th-TH/events`).
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

- `voidFbtee({ sourceLocale, locales })` from `void-fbtee/vite`, first in `plugins` in
  `vite.config.ts`.
- `middleware/i18n.ts`: `export { default } from "void-fbtee/middleware";`.
- `pages/layout.tsx` wraps its children in `<I18nProvider>` from `void-fbtee/react`.
- `worker: { compatibility_flags: ["temporal"] }` in `void.config.ts`.
- tsconfig: `"fbtee/ReactTypes"` in `compilerOptions.types`; `"lib"` with `ES2025`, `DOM`,
  `DOM.Iterable`.
- Vite+: `lint.jsPlugins` with `@nkzw/eslint-plugin-fbtee` and `void-fbtee/lint` in the
  workspace root's `vite.config.ts` (`init` prints the rules).
- Scripts `i18n:prepare`, `i18n:check`, `i18n:translate`; a void-fbtee section in `AGENTS.md`.
