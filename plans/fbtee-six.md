# plans/fbtee-six.md: move to fbtee 6 and use what fbtee gives us

Status: approved by the user 2026-11-13 and done the same day (one change, committed locally).

## Why

fbtee 6.0.0 came out on 2026-11-11 (https://github.com/nkzw-tech/fbtee/releases/tag/v6.0.0). All
four packages we use are at 6.0.0 on npm (checked 2026-11-13): `fbtee`, `@nkzw/fbtee-compiler`,
`@nkzw/vite-plugin-fbtee`, `@nkzw/eslint-plugin-fbtee`. We're on 5.0.0, and void-fbtee has never
been checked against everything fbtee offers. This plan does both: the upgrade, and a review of
fbtee's features against void-fbtee and the example, so we use fbtee's own features rather than our
own versions of them.

Sources, all from the 6.0.0 packages on npm (GitHub wasn't reachable from the session):
`fbtee/README.md`, `fbtee/skills/fbtee-translate/SKILL.md`, the eslint plugin's
`docs/rules/*.md`, and the type files in `fbtee/lib/`.

## What the review found

### Workarounds fbtee 6 makes unnecessary

1. **fbtee#83: plurals with `showCount="no"`.** void-fbtee bans `showCount="no"`: a lint rule
   (`void-fbtee/no-show-count-no`, packages/void-fbtee/src/lint.ts) and a line in `void-fbtee
   check` (src/check.ts, line 182). v6's notes: "Plural forms are no longer lost when the count is
   hidden, including languages with more than two plural forms". Measured 2026-11-13 with each
   compiler's prepare step on the same three strings, for ar-EG: 5.0.0 writes `tokens: []` for
   all; 6.0.0 writes `["count"]`, `["number"]`, and `["__plural_0"]` for the hidden count.
   To do: prove it end to end (an Arabic catalog with all six forms, rendered by fbtee's runtime,
   showCount="no"), then delete the rule, the check line, their tests and docs. If the lint plugin
   then has no rules, remove `void-fbtee/lint` entirely, with init's code that adds it.
2. **plurals.ts.** Written because 5.0.0's prepare "always writes `tokens: []` and `types: []`".
   6.0.0 now fills both, but still gives each entry one line, not one per plural form. To do:
   keep only what fbtee still doesn't do (one line per form the locale uses) and drop the rest;
   plurals.test.ts, which runs fbtee's real compiler and runtime, decides.

### fbtee features to start using

3. **`fbs` returns a plain string.** Remove `String()` around `fbs(...)`: about 13 places (the
   emails, the two error pages, the page templates init.ts writes, two aria-labels).
4. **fbtee's lint config instead of a hand-written list.** Today vite.config.ts lists two fbtee
   rules by hand. Use fbtee's `recommended` set, which now includes `prefer-fbs`, in our config
   and in what init writes.
5. **`no-unwrapped-strings` (fbtee's `strict` set): text nobody wrapped for translation.** For an
   i18n package this is the check that matters most, and we don't run it. Run it, fix what it
   finds, and list deliberate words (brand and API names such as "Intl" and "Temporal") in
   `ignoredWords`. Init then gives apps the same.
6. **`fbs.param(name, value, { number: true })`** formats a number for the reader's locale. Use
   it wherever we format a number by hand to put it in an `fbs` string, and teach it in the SKILL.
7. **Common strings (`<fbt common>`).** The same labels with the same descriptions appear on
   several pages ("Seats", "Sold out", the seats-left plural). One shared description each, in
   `common_strings.json`. Check how the vite plugin and `fbtee collect` take it, then decide.
8. **fbtee's own translation skill** (`fbtee/skills/fbtee-translate/SKILL.md`). It does what our
   SKILL's translating part does: collect, prepare, match existing terms and tone, fill every
   form, remove `"status": "new"`, check. Have our SKILL point to it for the translating and keep
   only what's Void's own (markdown pages, `void-fbtee check`, the AI's event titles). Less of our
   own to keep in step with fbtee.

### Already right

- Server and runtime: void-fbtee already uses `runWithFbtee`, `fallbackLocales`, `sourceLocale`
  and `onMissingTranslation`, as the README describes.
- "Missing" already means what `fbtee translate --strict` checks (catalogs.ts, line 8).

### Looked at, not needed now

- `fbt:enum`, gender and pronouns, `fbt:same-param`, `LocaleProvider`/`useFbt` scoped runtimes,
  `mergeTranslations`, `migrate-locales`: nothing in the example needs them. Not added just to
  show them.

## Steps

1. Upgrade the four packages to 6.0.0 (root, example, package, and the package's peer range,
   which apps then need too). `vp install`, `vp check`.
2. Items 3 and 4.
3. Item 1: the end-to-end proof first, then the deletions.
4. Item 2, with plurals.test.ts.
5. Item 5: run, fix, ignoredWords.
6. Items 6 and 7.
7. Item 8, and README, SKILL.md and the example's AGENTS.md wording.
8. Check: `vp check`, the package's unit tests, the example's unit tests, the dev tests for the
   pages, Intl (where `list()` is turned into text) and the emails, and a fresh `void-fbtee init`
   (e2e/fresh). Commit locally; push when the user says.

## Found while checking

- A new Void app starts with Void's English starter page, so fbtee's `no-untranslated-strings` as
  an error would fail `vp check` the moment void-fbtee is added. init sets it to warn: `vp lint`
  lists the text to wrap without failing. This repo keeps it an error (all its text is wrapped).
- init counted an app as part of any pnpm workspace above its folder; pnpm counts it only when the
  workspace's `packages` list takes it in. So the fresh npm app (under `.vitest/`) was linted with
  this repo's own root config, never with what init writes. init now follows pnpm's rule (test:
  "an app in a workspace's folder but not in its packages list is its own root").
