# plans/translation-simple.md: translating with Gemini the simple way

Status: written 2026-11-18, waiting for the user's OK. Nothing in the code is changed yet.

## Why

The way void-fbtee calls Gemini today was built to prop up Gemma 4, a small local model we no
longer use. Every request carries about 1,400 tokens of rules cut out of the translating skill
file, plus fbtee's own rules. Today's requests showed Gemini doesn't need them: with only the
locale codes and one sentence, it translated strings, a whole page and posts correctly, and one of
our rules (Thai's "no full stop") leaked into English answers and made them worse.

## What we send

Every request goes through Void's AI (Cloudflare, Unified Billing), as now.

**Settings, for every request**

- Model: `google/gemini-4-hydrogen` (Google's current fast model, released 2026-11-12, the
  successor to Gemini 3.8 Flash; on Cloudflare's model list, checked 2026-11-18). It costs
  $1.50 / $7.50 per million tokens in / out (Google's price; thinking is billed as output).
- `generationConfig.thinkingConfig.thinkingLevel: "low"`, the lowest Hydrogen takes (it rejects
  `minimal` and `thinkingBudget`, which we send today).
- No `temperature` (Hydrogen ignores it; Google advises leaving Gemini 3.x's sampling defaults).
- The answer's shape as `responseMimeType: "application/json"` plus `responseJsonSchema`, not
  pasted into the prompt (Google's structured output). Tested: the answer had exactly the schema's
  keys.
- A one-sentence `systemInstruction` with the two locale codes (`en-US`, `th-TH`), not language
  names. The code alone picks the country's language: `ar-SA` gave standard Arabic, `ar-EG`
  Egyptian, `ar-MA` Moroccan. That's the decision: stick to the locales, no style rules.

**App strings** (the catalog's new entries, several per request)

The entries as they are in the catalog, by their own keys, with each line named by its plural form
or gender (`zero`, `one`, `two`, `few`, `many`, `other`; `male`, `female`, `unknown`) instead of
fbtee's codes:

```
systemInstruction: "You translate a web app's interface text from en-US into ar-EG. Each entry
  has a description of where the text appears, and its lines, each marked with the plural form
  or gender it is for."
message: {"pyuIHcl9IjiwEfzc6+OZQw==": {"description": "How many seats at an event are still free
  to book; {number} is the count", "lines": {"zero": "{number} seats left", "two": "…", …}}, …}
schema:  the same keys, each with the same line names, all required
```

The English comes from what fbtee collects from the code (the collected strings `freshCatalog` in
`catalogs.ts` uses), never from the entry's line in the file: that line holds the English only
while the entry is new, and the translation after. Today's code reads the line (`toSend` in
`translate.ts`).

One plain function, with no file access, turns entries into the request and the answer back into
entries. The plugin (in Node, which reads the files) uses it for the catalogs; the app's Worker uses
it for runtime content. One piece of code to test, wherever it runs.

**Pages** (one Markdown page per request; the answer is the page, no JSON)

```
systemInstruction: "You translate a Markdown page from en-US into th-TH. Translate the text and the
  frontmatter's title and description; keep the Markdown structure, code blocks (their comments
  too), links, components and frontmatter keys as they are. Reply with the page only."
```

Tested on `pages/en-US/docs/tour.md`: its three code blocks and its `<script>` block came back
identical, the rest in Thai. Without "(their comments too)" it translated a comment in a code block.

**Runtime content** (posts, or any table's fields the app declares in `content`)

The same shape as app strings: each field is an entry (`events/<id>/title` with its description
and one line), sent and answered by key, by the same function. One translate function for both.

## What comes back

Answers are matched by key and line name, never by position. Each line goes onto the entry's line
with the matching name; the entry becomes `"status": "translated"` with `translatedBy`,
`translatedAt` and `gatewayLogId`. A key or line missing from the answer leaves that entry
`"new"`, to go again; nothing lands on the wrong string. Today's code matches by position, so a
skipped item shifts everything after it.

Writing the answer back into the catalog file, step by step (as `translate.ts` does today from
line 836, except that it matches by key and name instead of position):

1. For each key in the answer, the entry with that key. A key the request didn't send is ignored.
2. Each answered line onto the entry's line whose `variations` code has that name: `MARKS` in
   `plurals.ts` both ways (16 ↔ `zero`, 4 ↔ `one`, 8 ↔ `two`, 20 ↔ `few`, 12 ↔ `many`, 24 ↔
   `other`; 1 ↔ `male`, 2 ↔ `female`, 3 ↔ `unknown`). A line that varies by two things (a count
   and a gender) is named by both, `few, female`, and matched by both.
3. The English line's spaces at its start and end put back on the translation (`spaced`,
   `translate.ts` line 587): some lines are pieced together around other text, and Gemini trims.
4. The checks (placeholders, number of lines). An entry that fails them stays `"new"` and is sent
   again once, told what was wrong, as today.
5. The file read again from disk, since a save may have changed it while Gemini answered; each
   translated entry is written only where that key is still there and still `"new"`.
6. Written as JSON in the layout fbtee writes (two spaces, a newline at the end), so a diff shows
   only what changed.

One check stays: every `{placeholder}` and the number of lines came back (fbtee compiles a
translation that loses one: checked 2026-11-18, `plans/fbtee-issues.md` #3).

## Trying a translation without deploying

The same function the app uses, from a running `vp dev`, with one HTTP request and nothing
written: the dev server's route (`POST /__void-fbtee/translate`, `devTranslate` in `ai.ts`, with
the token in `node_modules/.void-fbtee/dev-token`) takes new entries in the catalog's own shape,
the locales and an optional `"dryRun": true`, and answers with the request that went to Gemini, the
answer, the entries as they would be written into the file, and the tokens and cost. Any entry, in
any language, in seconds; the deploy cycle is never needed to see what Gemini gives back.

Before something is in the code, a request shape is tried by hand with Cloudflare's CLI, as on
2026-11-18: `cf ai run google/gemini-4-hydrogen --body @request.json` (signed in with
`cf auth login --no-use-keyring`, which needs the user's approval once).

## To settle by test before the code

Three questions today's tests didn't answer, each settled by real requests with `cf ai run` before
the code is written, and written into this plan with the result:

1. **The code around each string, the words to keep exactly, and the glossary of the app's own
   terms**, which today's requests send and today's tests didn't. Ten real entries (a plain label,
   technical words, a time slot, a plural, a gender line, an email sentence) into `th-TH` and
   `ar-EG`, with and without them. If the answers are as good without, they go; if not, they stay
   in the request and this plan shows them.
2. **A string that varies by a count and a gender at once** (none in the example; made up for the
   test), its lines named by both (`few, female`): that Gemini fills every combination.
3. **fbtee's 12 built-in strings** (the list joiners, `{number}+`, `<{number}`), with their English
   and descriptions from fbtee's `Strings.json`.

## How we'll know it's right

- `vp check`, `test:unit`, `test:dev` and `test:preview`, as for every change.
- `test:dev` sends a few real entries through the dev route with `"dryRun": true`, for `th-TH` and
  `ar-EG` (a plain string, a time slot, a plural count, a gender line) and checks that every answer
  came back on its own key and line name, with its placeholders. Real Gemini, no mock, nothing
  written; a few US cents a run.
- The same entries by hand with `cf ai run`, to compare our code's answer with Gemini's own.
- A post created in `vp dev` comes back translated through the same function.
- After deploying (the user's call), the live site shows the same.

## What goes

- The rules cut from the skill file and fbtee's rules in every request (`rulesFor`, `SECTIONS`,
  `instructions` in `ai.ts`); the translating skill file (`skills/void-fbtee-translate/`), and the parts of
  `test/unit/skills.test.ts` that hold that skill to `plurals.ts`'s codes.
- `grammar.json` and the checks built on it in `judge.ts` (written for Gemma 4's mistakes),
  including the "always Modern Standard Arabic" rule, which contradicts the locale decision.
- Matching answers by position (`translateCatalog` in `translate.ts`), and the separate post
  translator (`translate()` in `ai.ts`).
- `thinkingBudget`, `temperature`, the schema pasted into the prompt, language names.
- Taking a new entry's English from its line in the file (`toSend` in `translate.ts`).
- Today's uncommitted changes, except where kept below: the per-language rule picking, the capitals
  sentence and the small-letter check, the dev-only "no rules" switch and posts on the dev route.

## What stays

- The catalog loop: fbtee finds the strings and prepares the files; new entries go to Gemini; the
  answers go back into the file.
- Who made each translation, and `vp build` failing on anything untranslated.
- The void-fbtee skill (`skills/void-fbtee/`), which tells a developer's coding agent how to write
  translatable code.
- From today's uncommitted changes: the fix that stops the capitals check comparing against an
  original with no capitals, and the corrected comments.

## Also in this change

- `fallbacksOf` (`runtime.ts`) skips a locale's natural parents (`fr-CA` → `fr`) for runtime
  content, where fbtee's own messages use them. Fixed here.

## Not in this change

- Retranslating anything already translated: this changes no existing translation, and offers no
  way to redo one.

- Simplifying what grew around posts (the queue, the "queued" markers, the nightly cron, the
  middleware). Runtime content moving to the catalog entry shape makes the markers unnecessary;
  the rest is its own plan.
- What we'd like from fbtee: `plans/fbtee-issues.md` #3. Filed only with the user's OK.
- The example's Arabic is standard Arabic today; under the locale decision new `ar-EG` strings
  come back Egyptian. Whether to retranslate the existing ones to match is the user's call.

## The tests behind this (2026-11-18, `cf ai run`, Cloudflare's CLI)

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
- Cloudflare's model list (Hydrogen, 3.8 Flash): https://developers.cloudflare.com/ai/models/
- Hydrogen's thinking levels, `minimal` and `thinkingBudget` rejected, sampling ignored: Google's
  Hydrogen migration guide as reported by apiyi.com and agentpedia.codes (2026-11-12); not read on
  Google's own page, which wasn't reachable from here. The tests above confirm `low` works.
