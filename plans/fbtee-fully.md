# plans/fbtee-fully.md: use all of fbtee that fits, before building anything on top

Status: proposed 2026-11-14, waiting for the user's OK. Comes before every other plan in `plans/`.
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

- **Lists:** `list` and `<fbt:list>` ("Bangkok, Cairo and New York", with each language's own "and").
  For the use cases' "who's watching from where".
- **Choices from a fixed set:** `<fbt:enum>`, each value translated in its sentence. That's how
  `plans/use-cases.md`'s "how they take part" (there, online, organising) gets written, not as
  separate strings joined together.
- **A person's name in a sentence:** `<fbt:name>`, which carries that person's gender into the
  translation ("Laila booked a seat" is worded by Laila's gender in Arabic).
- **Gender:** fbtee's viewer gender and `<fbt:pronoun>`. Arabic, for one, words "you booked"
  differently for a man and a woman. `Reader` gets an optional gender, used only when the person
  gives it, never guessed, for emails and tickets that address them.
- **Missing translations at run time:** `onMissingTranslation`, so a string missing in production
  is logged once, beside the build-time report the plugin already gives.
- **Its translate skill** (`node_modules/fbtee/skills/fbtee-translate/SKILL.md`). It does what
  `void-fbtee translate` asks Claude Code to do. Check whether ours repeats it, and if it does, use
  theirs.

## What changes, in order

1. **The translate skill.**
   - Compare `packages/void-fbtee/skills/void-fbtee/SKILL.md` (the part `void-fbtee translate` gives
     Claude Code) with `node_modules/fbtee/skills/fbtee-translate/SKILL.md`.
   - Where ours repeats fbtee's steps (matching existing terminology and tone, keeping placeholders,
     plural and gender variants, only removing `"status": "new"` when an entry is whole), point at
     fbtee's skill instead. Keep only what's Void's: markdown pages, `translatedFrom`, the checks.
2. **`onMissingTranslation`:** set by void-fbtee's runtime config (`packages/void-fbtee/src/runtime.ts`),
   so a string missing in production is logged once per language, on the Worker and in the browser.
3. **Scoped runtimes:** a void-fbtee wrapper, `<InLanguage locale>`, around fbtee's
   `createFbteeRuntime` and `LocaleProvider`, with the app's catalogs. It shows part of a page in
   another language. The use-cases rows and `void-moq`'s captions use it, and it replaces the plain
   `<bdi lang dir>` wrapper planned in `plans/primitives.md`, item 8.
4. **`<fbt:enum>`, `<fbt:name>` and gender:** shown working in the example and its docs (the
   Strings page gets a section for each, in all three languages), so the later plans use them as
   they're meant:
   - `<fbt:enum>` for a fixed set of choices;
   - `<fbt:name>` with the person's gender for a person named in a sentence;
   - viewer gender for text addressed to the reader, only when the person has given it.
5. **The skill and README** say which fbtee piece does what, and void-fbtee doesn't repeat them.

## How we'll know it's right

- **The skill:** a diff of the two skills shows no step of fbtee's repeated in ours. Then a real
  `void-fbtee translate` run on a new string and a new markdown page completes in all languages.
- **`onMissingTranslation`:** a preview test removes one Thai translation from a built catalog and
  sees exactly one log line for it, and none for the rest.
- **`<InLanguage>`:** a Thai row inside an English page renders in Thai with its own plural forms,
  and the page around it stays English.
- **`<fbt:enum>` and `<fbt:name>`:** unit tests render each in all three languages, with the
  expected words taken from the catalog's own translations. They're checked again in the browser on
  the Strings page.
- Then `vp check`, `test:unit`, `test:dev`, `test:preview` and `i18n:check`.

Committed locally, and pushed when the user says.
