---
name: void-fbtee
description: Translate a Void app that uses void-fbtee (fbtee strings in i18n/translations/, markdown pages under pages/<locale>/) and fix its i18n setup. Use when asked to translate the app, add a language, update translations or fix void-fbtee check problems.
---

# Translate a Void app with void-fbtee

The docs ship next to this skill, in `node_modules/void-fbtee/docs/`. Commands: `void-fbtee --help`
(run them through the app's package manager, e.g. `pnpm exec void-fbtee check`).

## Strings

1. If you can run commands, run `void-fbtee prepare` first. It updates every locale's catalog in
   `i18n/translations/` (the locales come from `voidFbtee()` in `vite.config.ts`): new strings get
   `"status": "new"`. Use it instead of `fbtee collect` and `fbtee prepare-translations`; it also
   adds fbtee's built-in strings. If you were given a list of files, they're already prepared.
2. Translate every entry with `"status": "new"` by fbtee's own skill:
   `node_modules/fbtee/skills/fbtee-translate/SKILL.md`. Follow its steps 3 to 5 (match the
   locale's existing style, read each description and the source, keep placeholders exactly, then
   mark the entry done). In these catalogs a finished entry has `"status": "translated"`. A string
   with a count has one line per plural form; fill each in that form's grammar
   (`docs/strings.md`, "Plurals").
3. Then read `docs/strings.md` for what's specific to Void apps: fbtee's built-in strings,
   right-to-left locales, and the source locale.

## Markdown pages

Pages under `pages/<source locale>/` (blog posts, marketing pages) have a copy per locale under
`pages/<locale>/`. Read `docs/markdown-pages.md` before translating one.

## Finish

Run `void-fbtee check` if you can; it exits 1 and lists anything still missing. When
`void-fbtee translate` started you, don't run anything: it records the pages and runs check
itself. Report one line per file: done, or what's left and why.

## Setup problems

If check reports `setup:` problems, read `docs/setup.md`. `void-fbtee init` fixes most of them.
