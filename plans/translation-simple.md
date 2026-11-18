# plans/translation-simple.md: translating with Gemini the simple way

Status: rewritten 2026-11-18, waiting for the user's OK. Nothing in the code is changed yet.

## Why

The way void-fbtee calls Gemini was built to prop up Gemma 4, a small local model we no longer
use. Every request carries about 1,400 tokens of rules cut out of a skill file, plus fbtee's own
rules, and answers are matched back by their position in the list. Requests sent by hand on
2026-11-18 showed Gemini needs none of the rules: with the locale codes and one sentence it
translated strings, a whole page and posts correctly, and one of our rules (Thai's "no full stop")
leaked into English answers and made them worse. The tests and test data grew around the same
rules and are cleared out with them.

## The order of the work

1. Three questions answered by real requests, before any code (below, "First: three questions").
   Their answers to the test entries become the test data's recorded answer.
2. The code: the request and the answer as below, the old pieces deleted.
3. The tests and test data: the old ones out, the new ones in (below).
4. Everything run: `vp check`, `test:unit`, `test:dev`, `test:preview`. Committed here; pushed and
   deployed only when the user says.

## What we send

Every request goes through Void's AI (Cloudflare, Unified Billing), as now.

**For every request**

- Model: `google/gemini-4-hydrogen`, one model for everything (Google's current fast model,
  released 2026-11-12, the successor to Gemini 3.8 Flash; on Cloudflare's model list, checked
  2026-11-18). $1.50 / $7.50 per million tokens in / out (Google's price; thinking is billed as
  output).
- `generationConfig.thinkingConfig.thinkingLevel: "low"`, the lowest Hydrogen takes (`minimal` and
  `thinkingBudget`, which we send today, fail with a 400 on Hydrogen).
- No `temperature` (Hydrogen ignores it; Google advises Gemini 3.x's sampling defaults).
- The answer's shape as a setting, `responseMimeType: "application/json"` with
  `responseJsonSchema`, not pasted into the prompt (Google's structured output). Tested: the answer
  had exactly the schema's keys.
- One `systemInstruction` sentence with the two locale codes (`en-US`, `ar-EG`), never language
  names and no style rules. The code alone picks the country's language: `ar-SA` gave standard
  Arabic, `ar-EG` Egyptian, `ar-MA` Moroccan (the user's decision: stick to the locales).

**App strings:** the catalog's new entries, several per request, by their own keys

```
systemInstruction: "You translate a web app's interface text from en-US into ar-EG. Each entry
  has a description of where the text appears, and its lines, each marked with the plural form
  or gender it is for."
message: {"pyuIHcl9IjiwEfzc6+OZQw==": {"description": "How many seats at an event are still free
  to book; {number} is the count", "lines": {"zero": "{number} seats left", "two": "…", …}}, …}
schema:  the same keys, each with the same line names, all required
```

- Each line is named by its plural form or gender instead of fbtee's code: `MARKS` in `plurals.ts`
  (16 `zero`, 4 `one`, 8 `two`, 20 `few`, 12 `many`, 24 `other`; 1 `male`, 2 `female`, 3
  `unknown`). A line that varies by a count and a gender is named by both, `few, female`. A line
  with no variation is a plain string.
- The English comes from what fbtee collects from the code (the collected strings `freshCatalog`
  in `catalogs.ts` uses), never from the entry's line in the file, which holds the translation once
  translated. Today's code reads the line (`toSend` in `translate.ts`).
- Left out unless the first test shows they're needed: the code around each string, the words to
  keep exactly, and the glossary of the app's own terms, which today's requests send.

**Pages:** one Markdown page per request; the answer is the page itself, no JSON

```
systemInstruction: "You translate a Markdown page from en-US into th-TH. Translate the text and the
  frontmatter's title and description; keep the Markdown structure, code blocks (their comments
  too), links, components and frontmatter keys as they are. Reply with the page only."
```

Tested on `pages/en-US/docs/tour.md`: its three code blocks and `<script>` block came back
identical. Without "(their comments too)" it translated a comment inside a code block.

**Posts:** the example's events, or any table's fields an app declares in `voidFbtee({ content })`

The example's posts run on the package, so this change reaches them. Each field is an entry, sent
and answered by key as app strings are:

```
systemInstruction: "You translate a post someone wrote in a web app from th-TH into en-US. Each key
  is one of the post's fields; translate its text."
message: {"title": "เวิร์กช็อปขนมไทยโบราณ", "description": "…"}
schema:  the same keys, required
```

What changes for posts, all inside the package:

- The queue (`queue-translate.ts`, which the example's `queues/translate.ts` runs) calls the one
  function below instead of `translate()` in `ai.ts`, with the post's own language and the
  reader's locale codes.
- The dev route's `"post"` kind goes through the same function.
- `postProblems` in `judge.ts` goes; a post is checked as a string is (every field there, no
  placeholder lost), asked once more, then left for the queue's next retry as now.

What stays the same:

- The stored shape: a row per post and locale in `events_translations` (`source_id`, `locale`,
  `fields` as JSON, who translated it), written by `storeTranslation` and read by
  `translationsFor` and `textOf` in `content.ts`. Posts already translated stay as they are.
- The example's own post code doesn't change: `queues/translate.ts`, `src/events/translations.ts`,
  `pages/[lang]/events/*`, `crons/translations`, the middleware.
- The queue's retries and the waiting when the account isn't paying (`paymentProblem`).

**One function for all of it.** One plain function, with no file access, turns entries into the
request and the answer back into entries. The plugin (Node, which reads the files) uses it for the
catalogs; the app's Worker uses it for runtime content. It replaces the two translators we have
(`translateStrings` and `translate` in `ai.ts`).

## What comes back

Matched by key and line name, never by position:

1. For each key in the answer, the entry with that key; a key the request didn't send is ignored.
2. Each answered line onto the entry's line with that name (`MARKS` both ways; `few, female` by both).
3. The English line's spaces at its start and end put back (`spaced`, `translate.ts`): some lines
   are pieced together around other text, and Gemini trims.
4. The check: every `{placeholder}` of the English line is in the translation, and no other, and
   every line is there. An entry that fails stays `"new"` and is asked once more, told what was
   wrong. (fbtee itself compiles a translation that loses a placeholder: checked 2026-11-18,
   `plans/fbtee-issues.md` #3.)
5. The file read again, since a save may have changed it while Gemini answered; each translated
   entry is written only where its key is still there and still `"new"`, with
   `"status": "translated"`, `translatedBy`, `translatedAt` and `gatewayLogId`.
6. Written as JSON in fbtee's layout (two spaces, a newline at the end), so a diff shows only what
   changed.

A key or line missing from the answer leaves that entry `"new"`. Nothing lands on the wrong string.

## First: three questions, answered with `cf ai run`

Real requests in the shape above, sent by hand with Cloudflare's CLI (`cf ai run
google/gemini-4-hydrogen --body @request.json`, signed in with `cf auth login --no-use-keyring`,
which needs the user's approval once). No code. Each result is written into this plan.

1. **The code around each string, the words to keep, the glossary.** Ten real entries from the
   example (a plain label, technical words, a time slot, a plural, a gender line, an email
   sentence) into `th-TH` and `ar-EG`, with and without them. As good without: they're dropped.
   Not: they stay, and this plan shows them.
2. **A count and a gender at once** (none in the example, so made up), lines named `few, female`:
   that every combination comes back.
3. **fbtee's built-in strings** (the list joiners, `{number}+`, `<{number}`), with their English and
   descriptions from fbtee's `Strings.json`.

## Trying a translation without deploying

- `cf ai run`, as above: Cloudflare and Google only, none of our code. Shows what Gemini does with a
  request.
- The dev route, with `vp dev` running: `POST /__void-fbtee/translate` (`devTranslate` in `ai.ts`,
  the token in `node_modules/.void-fbtee/dev-token`) takes new entries in the catalog's shape, the
  locales and `"dryRun": true`, and answers with the request that went to Gemini, the answer, the
  entries as they would be written, and the tokens and cost. Nothing is written. Shows what our code
  does.

A difference between the two is a bug in our code.

## Tests and test data

**Test data, independent of the example app** (which keeps changing):

- `packages/void-fbtee/test/entries.json`: six entries in fbtee's catalog format, `"status": "new"`,
  English in place, written for the tests: a plain label, a sentence with a `{time}` slot, a plural
  count, a gender line, a count and a gender together, and a list joiner.
- `packages/void-fbtee/test/answers.json`: Hydrogen's real answer to exactly those entries, captured
  with `cf ai run` in step 1, untouched, labelled with the model, the date and the AI Gateway log id.

**New tests**

- `test/unit/translate-entries.test.ts`, our code on that data both ways: entries to the request
  (every key, description and named line, nothing extra); the recorded answer back into a copy of
  the catalog (each line on its own key and line name, spaces and placeholders kept, a missing key
  left `"new"`, a placeholder lost caught).
- In the example's `test:dev`: the same six entries through the dev route with `"dryRun": true`, to
  real Gemini, for `th-TH` and `ar-EG`, checking keys, line names and placeholders, never wording. A
  few US cents a run; `test:dev` isn't run in CI, so Gemini being down can't block a deploy.
- Posts: `e2e/dev/events.test.ts` already creates a post in `vp dev` and waits for the queue to
  translate it with real Gemini, then books it in Thai and checks the Thai email; it runs unchanged
  and now goes through the new function. `e2e/preview/events.test.ts` (an Arabic post read in
  English) reads stored translations and runs unchanged.

**Old tests and test data, in `packages/void-fbtee/test/`**

| File                         | What it is                                                              | In this change                                                                  |
| ---------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `unit/judge.test.ts`         | 16 tests on Gemma 4's saved answers and the old checks                  | deleted; one test of the placeholder check stays                                |
| `unit/skills.test.ts`        | holds the translating skill to fbtee's codes                            | deleted with the skill                                                          |
| `unit/ai-rules.test.ts`      | today's uncommitted per-language rules test                             | deleted                                                                         |
| `unit/translate.test.ts`     | the coding-agent prompts, page stamping                                 | the prompt tests that name the translating skill change; page stamping stays    |
| `unit/models.test.ts`        | the old model and payment errors                                        | rewritten for Hydrogen                                                          |
| `unit/content-files.test.ts` | the queue, cron and translations table files written for an app         | unchanged: those files don't change                                             |
| `unit/fixture/`              | a tiny app with a German catalog, one entry falsely labelled `"claude"` | kept for the catalog and command tests; the label says it's hand-made test data |

Elsewhere: `e2e/fresh/check.ts` and `e2e/preview/strings.test.ts` (which skill files a new app
gets) change. `e2e/dev/jobs.test.ts` (the queue acks a translated post and a deleted one) runs
unchanged. `e2e/fresh/check.ts`'s
hand-written translations for a fresh app (`FROM_THAI`) stay, since that test can't call Gemini,
but no longer claim to match the example's catalog.

Unchanged: the other unit tests (`catalogs`, `commands`, `negotiate`, `server`, `plugin`,
`plurals`, `head`, `init`, `language-list`, `runtime`, `constructs`) and the browser, preview and
deployed tests. They test fbtee, routing, setup, pages and the live site against the example's real
content, which stays as it is.

## Claude's review

`vp dev`'s review of machine translations (`reviewTask` and `reviewApp` in `translate.ts`) tells
Claude to read the translating skill for "how a translation should be". With that skill gone, the
prompt points only at the void-fbtee skill's "Reviewing" section, which says what to record; the
judging is Claude's own, as it is Gemini's.

## What goes

- The rules in every request: `rulesFor`, `SECTIONS`, `languageRules` and `instructions` in
  `ai.ts`, fbtee's rules (`fbteeRules` in `translate.ts`), and the translating skill
  (`skills/void-fbtee-translate/`).
- `grammar.json` and the checks built on it in `judge.ts`, including the "always Modern Standard
  Arabic" rule, which contradicts the locale decision.
- Matching answers by position (`translateCatalog` in `translate.ts`); the separate post translator
  (`translate()` and `postProblems`); taking the English from the line in the file.
- `thinkingBudget`, `temperature`, the schema pasted into the prompt, language names.
- Today's uncommitted changes, except the two kept below.

## What stays

- The catalog loop: fbtee finds the strings and prepares the files; new entries go to Gemini; the
  answers go back into the file.
- Who made each translation, and `vp build` failing on anything untranslated.
- The void-fbtee skill (`skills/void-fbtee/`), which tells a developer's coding agent how to write
  translatable code.
- The example's real content: its catalogs and pages stay as they are.
- From today's uncommitted changes: the fix that stops the capitals check comparing against an
  original with no capitals (if any capitals check is left), and the corrected comments.

## Also in this change

- `fallbacksOf` (`runtime.ts`) skips a locale's natural parents (`fr-CA` → `fr`), where fbtee's
  own lookup uses them. It decides which stored post translation a page shows (`textLocales` in
  `server.ts`) and which catalogs a page preloads (`translationsFor` in `runtime.ts`). Fixed. The
  example (`en-US`, `ar-EG`, `th-TH`, no `fallbackLocales`) shows nothing different; a unit test in
  `runtime.test.ts` covers it.

## Not in this change

- Retranslating anything already translated.
- Other Gemini models, a model option, a repeatable smoke test: later.
- Simplifying what grew around posts (the queue, the "queued" markers, the nightly cron, the
  middleware): its own plan.
- What we'd like from fbtee: `plans/fbtee-issues.md` #3, filed only with the user's OK.

## The requests behind this (2026-11-18, `cf ai run`)

| Request                                               | Model     | Result                                        | Tokens in / out / thinking | Cost    |
| ----------------------------------------------------- | --------- | --------------------------------------------- | -------------------------- | ------- |
| "Book a seat for {eventName}", today's full rules     | 3.5 Flash | right                                         | 1,425 / 46 / 0             | $0.0026 |
| the same, no rules                                    | 3.5 Flash | the same answer                               | 183 / 46 / 0               | $0.0007 |
| "Book a seat", thinking low, JSON schema              | Hydrogen  | right, the schema's key                       | 188 / 29 / 57              | $0.0009 |
| 2 strings (plural, gender) into ar-EG / ar-SA / ar-MA | Hydrogen  | that country's Arabic, forms and gender right | 510 / ~150 / 520–690       | ~$0.006 |
| The tour page into Thai                               | Hydrogen  | right, code blocks identical                  | 2,143 / 2,283 / 0          | $0.020  |
| The dessert post, th-TH → en-US                       | Hydrogen  | "Traditional Thai Dessert Workshop"           | 263 / 58 / 136             | $0.0018 |
| "Your time: {time}" by its own key                    | Hydrogen  | "เวลาของคุณ: {time}" under the key             | 321 / 53 / 88              | $0.0015 |

Hydrogen costs 3–5 times the old model per request, almost all of it thinking it can't turn off;
a few hundred strings for a language is about a dollar.

## Sources

- Google, "What's new in Gemini 3.5 Flash" (sampling defaults, `thinking_level`, short prompts):
  https://ai.google.dev/gemini-api/docs/generate-content/whats-new-gemini-3.5
- Google, "Structured outputs": https://ai.google.dev/gemini-api/docs/generate-content/structured-output
- Google, "Prompt design strategies": https://ai.google.dev/gemini-api/docs/prompting-strategies
- Google, "Gemini thinking" and Vertex AI's thinking page (levels per model; Hydrogen and 3.8 Flash
  reject `minimal`): https://ai.google.dev/gemini-api/docs/generate-content/thinking
- Cloudflare's model list: https://developers.cloudflare.com/ai/models/
