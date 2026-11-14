# plans/fbtee-fully.md: use all of fbtee that fits, before building anything on top

Status: proposed 2026-11-14, waiting for the user's OK. Its place in the order: `plans/README.md`.
void-fbtee is fbtee for Void, so the rest has to be built on fbtee's own pieces, not on copies of
them. An audit of all of fbtee found pieces we don't use, and one place where we likely repeat it.

## What fbtee has, and what we use

From the whole of fbtee 6.0.0's README and its type definitions (`ReactTypes.d.ts`, the package's
exports), read 2026-11-14.

Already used:

- `<fbt>`/`fbs`, `<fbt:param>` and `<fbt:plural>`;
- common strings and `list()`;
- `runWithFbtee` per request, and `setupLocaleContext` in the browser;
- `fallbackLocales`;
- the compiler's collect, prepare and translate (including its partial-catalog fallback);
- the lint rules.

Not used yet, and wanted:

- **Scoped runtimes:** `createFbteeRuntime`, `LocaleProvider` and `useFbt()` show part of a page in
  another language. Uses:
  - the use-cases page's rows, each person in their own language;
  - `void-moq`'s captions panel in the watcher's language.

  void-fbtee wraps it with the app's catalogs, rather than writing its own.

- **Lists inside a sentence:** `<fbt:list>` ("Watching from Bangkok, Cairo and New York", with each
  language's own "and" and the sentence worded around it). `list()` on its own is already used (the
  Intl page, the home page), but not a list inside a translated sentence. For the use cases' "who's
  watching from where".
- **Choices from a fixed set:** `<fbt:enum>`, each value translated in its sentence. That's how
  `plans/use-cases.md`'s "how they take part" (there, online, organising) gets written, not as
  separate strings joined together.
- **A person's name in a sentence:** `<fbt:name>`, which carries that person's gender into the
  translation ("Laila booked a seat" is worded by Laila's gender in Arabic).
- **Gender:** fbtee's viewer gender and `<fbt:pronoun>`. Arabic, for one, words "you booked"
  differently for a man and a woman. `Reader` gets an optional gender, used only when the person
  gives it, never guessed, for emails and tickets that address them.
- **Missing translations at run time:** `onMissingTranslation`. Already used, but only in the browser
  and only in dev (`packages/void-fbtee/src/install.ts`: "Dev only: name each string this page shows
  untranslated"). Not in production, and not on the server (`runWithFbtee`).
- **Its locale matching:** which of the app's languages fits a person's list ("Locale Matching and
  Fallback" in fbtee's README). `plans/their-own-language.md` uses it to send each visitor to their
  own language. It's not exported yet, so void-fbtee carries fbtee's code for it unchanged, tested
  to agree with fbtee's public `setupLocaleContext`, until fbtee exports `negotiateLocale` (the
  issue drafted in that plan).
- **Its translate skill** (`node_modules/fbtee/skills/fbtee-translate/SKILL.md`). Ours already
  hands the translating to it ("Follow its steps 3 to 5", `skills/void-fbtee/SKILL.md`, "Strings").
  What's left to tidy is in "Answers" below.

## Answers to the open questions (checked 2026-11-14, before writing the code)

Each was run, not read. fbtee 6.0.0, its compiler and React 19, from this repo's `node_modules`.
The throwaway scripts are in `apps/example/.vitest/proof/` (git-ignored).

1. **An app written in Arabic can have all six plural forms, but only with a catalog for its own
   language.**
   - With no catalog, fbtee uses the inline text, which has two forms: the text, and `many`. Arabic
     then reads `حجزت ٢ ليالٍ`, `حجزت ١١ ليالٍ` and `حجزت ١٠٠ ليالٍ`, all with the same word, which is
     wrong grammar for 2, 11 and 100.
   - Given an `ar-EG` catalog for the source language, with void-fbtee's plural lines added, fbtee
     picked each form: zero, exactly one, two, few, many and other. So a source catalog works,
     and fbtee reads it ("then the source locale's catalog if supplied", its README).
   - Today void-fbtee makes catalogs only for the translated languages, and its skill says "The
     source locale has no catalog". So `prepare` will also make one for the source language when that
     language has more plural forms than the inline two (`Intl.PluralRules(locale)
     .resolvedOptions().pluralCategories`), with the plural strings only. The skill says so.
   - **A small thing seen on the way:** in the inline text, the "exactly one" form writes a Latin
     `1` (`حجزت 1 ليلة`), where the other counts come out in Arabic digits (`٢`). A source catalog
     avoids it, as the translated catalogs do: the live Arabic Strings page reads `حجزت ليلة واحدة`.
     It goes to fbtee as a note in the issue drafted in `plans/their-own-language.md`.
2. **`onMissingTranslation` works per request on the server.** Inside `runWithFbtee` it reported a
   Thai request's two missing messages once each, though one was asked for twice. So it's set on the
   server too, and in production, logged once per language and message.
3. **Scoped runtimes work in a server render.** An English request rendering a Thai `LocaleProvider`
   gave `<div>You booked | <span>คุณจองแล้ว</span></div>`. So:
   - on pages rendered on the server, and on markdown pages and static layouts, `<InLanguage>`
     works as it is;
   - in a hydrated component (an island, a page), the runtime has to be made again in the browser,
     because the runtime object carries functions, and fbtee's README says to "pass locale and
     translation data across that boundary". So `<InLanguage locale>` takes only the locale, and
     loads that language's catalog itself, the same way on the server and in the browser.
4. **The translate skill.**
   - Ours already gives the translating to fbtee's skill (its steps 3–5).
   - Its steps 1, 2 and 6 (collect, prepare, compile) are replaced on purpose by `void-fbtee prepare`
     and the plugin: they add the plural lines and fbtee's built-in strings, and fbtee's own
     prepare doesn't.
   - What repeats fbtee: "A finished entry" (keep placeholders, the status) restates fbtee's steps 4
     and 5, so it gets cut down to what's ours.
   - The status wording isn't a conflict: fbtee says remove `"status": "new"`, ours says set
     `"translated"`, and both mark the entry done for fbtee's compiler and for `void-fbtee check`.

## What changes, in order

There's one step for each item in "Not used yet, and wanted" above, so none is dropped. Locale
matching is the exception: it's built in `plans/their-own-language.md`, the next plan, where it's
used.

1. **The translate skill.**
   - Compare `packages/void-fbtee/skills/void-fbtee/SKILL.md` (the part `void-fbtee translate` gives
     Claude Code) with `node_modules/fbtee/skills/fbtee-translate/SKILL.md`.
   - Where ours repeats fbtee's steps (matching existing terminology and tone, keeping placeholders,
     plural and gender variants, only removing `"status": "new"` when an entry is whole), point at
     fbtee's skill instead. Keep only what's Void's: markdown pages, `translatedFrom`, the checks.
2. **`onMissingTranslation`:** on the server (`runWithFbtee` in `packages/void-fbtee/src/server.ts`,
   which the middleware uses), in production too, and in the browser in dev, logged once per
   language and message (answer 2). The browser stays dev-only: in production the texts module is
   empty there, so the page doesn't carry every string's source text.
3. **Scoped runtimes:** a void-fbtee wrapper, `<InLanguage locale>`, around fbtee's
   `createFbteeRuntime` and `LocaleProvider`. It takes only the locale and loads that language's
   catalog itself, on the server and in the browser (answer 3). It shows part of a page in
   another language. The use-cases rows and `void-moq`'s captions use it, and it replaces the plain
   `<bdi lang dir>` wrapper planned in `plans/primitives.md`, item 8.
4. **`<fbt:list>`:** a list inside a translated sentence. First, the example's workaround goes:
   - `apps/example/pages/[lang]/index.tsx` joins a list into plain text (`String(list(items))`)
     because, in its comment's words, a list inside a string "renders as one text on the server but
     as separate pieces in the browser, so hydration fails (seen with fbtee 5.0.0)". We're on 6.0.0.
   - Run on 2026-11-14 with 6.0.0, the server (`runWithFbtee`) and the browser's setup gave the same
     HTML for a list inside a sentence ("Watching from Bangkok, Cairo and New York").
   - That's a render, not a hydration. So the real check is the preview's browser tests, which fail
     on any hydration error, with the home page using `<fbt:list>`. If it passes, `listText` and
     the `String(list(...))` on the Intl page go. If it doesn't, the workaround stays, its comment
     says 6.0.0, and fbtee gets an issue with the failing case.
5. **`<fbt:enum>`:** a choice from a fixed set, translated within its sentence.
6. **`<fbt:name>`:** a person's name in a sentence, with that person's gender.
7. **Gender and `<fbt:pronoun>`:** viewer gender for text addressed to the reader, and pronouns,
   only when the person has given their gender, never guessed.

8. **`<fbt:same-param>`:** shown on the Strings page (the rule below).
9. **A catalog for the source language** when it has more plural forms than fbtee's inline two
   (answer 1): `prepare`, `check` and the skill.
10. **A fresh app written in Thai** in the fresh-app test (section "A source language other than
    English").

Steps 4–8 are each shown working in the example: the Strings page gets a section for each, in all
three languages, so the later plans use them as they're meant.

**The rule: all of fbtee that fits, and every piece shown.** The example is how void-fbtee is
proven, so every fbtee feature an app could need is used where the example has a real case for it,
and shown on the Strings page either way. That covers `<fbt:same-param>` too (the same value twice
in one sentence), shown there even though the events app has no case for it yet. One piece stays
out, with its reason written in the skill: fbtee's own language switching (`createLocaleContext`,
`useLocaleContext().setLocale`) changes a page's language in place. void-fbtee gives each language
its own address (`plans/their-own-language.md`), so a page never switches language where it
stands. Then the skill and README say which
fbtee piece does what, without repeating fbtee.

## A source language other than English

(Answer 1 above settles the Arabic question: a catalog for the source language. It's built here.)

void-fbtee doesn't require English. The source language is a setting: `voidFbtee({ sourceLocale })`,
and `void-fbtee init --source-locale`, whose default is `en-US`. That's also fbtee's own:
"set `sourceLocale` when the inline messages are not US English" (fbtee 6.0.0 README). The package
code has no other English in it (searched `packages/void-fbtee/src/`, 2026-11-14).

But it's never been tried. Every test, the unit fixture and the fresh-app test are written in
English. So this plan proves it:

- **A fresh app written in Thai** (`void-fbtee init --source-locale th-TH`, with English and Arabic
  as translations) goes through init, prepare, translate, check and a build. Its pages, the
  redirect from `"/"` and the sitemap all work.
- **One question to settle for a source like Arabic,** whose plurals have six forms. In the source
  code, fbtee's `<fbt:plural>` takes two forms (the text, and `many`). Can an app written in Arabic
  give all six for its own language, perhaps through a catalog for its source language, or doesn't
  fbtee allow it? Checked in fbtee's code and with a real build. The answer goes into the skill, and
  to fbtee as a question if it's a limit.

## How we'll know it's right

- **The skill:** a diff of the two skills shows no step of fbtee's repeated in ours. Then a real
  `void-fbtee translate` run on a new string and a new markdown page completes in all languages.
- **`onMissingTranslation`:** a preview test removes one Thai translation from a built catalog and
  sees exactly one log line for it, and none for the rest.
- **`<InLanguage>`:** a Thai row inside an English page renders in Thai with its own plural forms,
  and the page around it stays English.
- **`<fbt:list>`, `<fbt:enum>`, `<fbt:name>` and gender with `<fbt:pronoun>`:** unit tests render
  each in all three languages, with the expected words taken from the catalog's own translations.
  They're checked again in the browser on the Strings page.
- **Nothing dropped:** each "wanted" item is ticked off against its step and its test (locale
  matching against `plans/their-own-language.md`'s) before the change is committed.
- Then `vp check`, `test:unit`, `test:dev`, `test:preview` and `i18n:check`.

Committed locally, and pushed when the user says.

## Done (2026-11-14)

All ten steps are built. What each is checked by:

1. The skill: "A finished entry" (fbtee's steps again) became "Gender", the part that's
   void-fbtee's; `<InLanguage>`, the pieces and why fbtee's language switching stays out are in it.
   The package README lists which fbtee piece does what. A real `void-fbtee translate` run
   (2026-11-14, in this Claude Code session, which is what translate does inside Claude Code): a
   new string and a new markdown page, both translated into Thai and Arabic by the skill, the pages
   stamped, `void-fbtee check` all good, both pages served in dev; then the original edited and
   check reported both copies out of date. The trial was removed after.
2. `onMissingTranslation`: a unit test (`runtime.test.ts`), two requests in German log one line for
   the one missing string. Done as a unit test, not the preview test planned, since it's the same
   `runWithFbtee` the server calls.
3. `<InLanguage>`: the Strings page's "For the reader" and "Part of the page in another language",
   in `e2e/preview/strings.test.ts`, each part carrying its own `lang`, the page keeping its own.
4. to 8. `<fbt:list>` (the home page's workaround is gone), `<fbt:enum>`, `<fbt:name>`,
   `<fbt:pronoun>` with the reader's gender, `<fbt:same-param>`: the same preview test, in all three
   languages, through hydration with no other text shown.
5. The source catalog: `catalogs.test.ts` (an Arabic source gets one, English and Thai don't).
6. The Thai-source app: `vpx e2e/fresh/check.ts thai-source`. It found that init's not-found and
   error pages are written in English whatever the source language; init now says to rewrite them
   in the code's language.

**Found on the way:** fbtee joins every list item but the last with one string, the same for "and",
"or" and plain lists (`{previous items}, {following items}`, fbtee 6.0.0 `lib/index-core`). So
Arabic can't have CLDR's "and" list, `A وB وC`, without its "or" list becoming `A وB أو C`. The
catalog keeps `A، B وC`, and the skill no longer says "no commas". A question for fbtee, drafted with
the others in `plans/their-own-language.md`, filed only with the user's OK.
