# plans/translation-simple.md: translating with Gemini the simple way

Status: 2026-11-18, checked line by line against the code, waiting for the user's OK. No code
changed yet.

## The change

Today every request to Gemini carries ~1,400 tokens of rules (built for Gemma 4, no longer used),
answers are matched back by position, and every finished translation is judged by the same rules
when `vp dev` starts and at `vp build`. One that fails is set back to "new" and translated
again. Requests sent by hand on 2026-11-18 showed Gemini needs none of the rules. So: one model,
one plain request with the locale codes, answers matched by key, and a check of only what can break
the app. The rules, their checks and the tests built on them go.

This covers everything the package translates: the app's strings, its Markdown pages, and posts
people write at runtime (the example's events).

## Where it runs (as now)

- **Strings and pages, in `vp dev`:** the plugin (Node, `translate.ts`) finds what's new, sends it
  to the dev server's route (`POST /__void-fbtee/translate`, `devTranslate` in `ai.ts`, in the
  Worker, where Void's AI is), and writes the answers into the files. The route never writes.
- **Posts, at runtime:** the queue (`queue-translate.ts`, run by the example's
  `queues/translate.ts`) calls Void's AI in the Worker and stores the answer.
- **Anything Gemini leaves:** Claude Code (`claude -p`, `translateTask` in `translate.ts`), then
  Claude's review (`reviewApp`). Both stay.

## The request

- Model `google/gemini-4-hydrogen` (`GEMINI` in `models.ts`), `thinkingLevel: "low"`, no
  `temperature`.
- One instruction sentence naming the two locale codes (`en-US` into `ar-EG`). No language names,
  no style rules.
- The answer's shape set with `responseJsonSchema`: the same keys as sent.
- How many strings go in one request is settled by test first (step 1 below), not carried over
  from today's 50 (`BATCH` in `models.ts`, set for Gemini 3.5 Flash). Only 1 and 2 have been
  tried: thinking grew with the strings (one: 57–88 tokens; two: 520–690), so batching may save
  little with Hydrogen.

| What        | Sent as                                                                                                                                                                                                                                                                      | Example                                                                                    |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| App strings | each new catalog entry under its fbtee key: its description and its lines, each line named by its form (`one`, `few`, `female`, `few, female`) via `MARKS` in `plurals.ts`; the English from fbtee's collected strings (`freshCatalog`, `catalogs.ts`), not the catalog line | `{"pyuIHcl…": {"description": "…", "lines": {"one": "{number} seat left", "other": "…"}}}` |
| Posts       | each field under its name                                                                                                                                                                                                                                                    | `{"title": "…", "description": "…"}`                                                       |
| Pages       | the whole Markdown page, answered as Markdown, not JSON; told to keep code blocks (their comments too), links, components and frontmatter keys                                                                                                                               | `pages/en-US/docs/tour.md`                                                                 |

One plain function builds the request and reads the answer, used by the dev route for strings and
by the post queue. It replaces `translateStrings` and `translate` in `ai.ts`, and
`translateEntry`'s three tries in `translate.ts`. Pages keep `translatePage` with the instruction
above in place of the rules.

## The answer back

1. Each key onto the entry with that key; each line onto the line with that name. Never by
   position. A key not sent is ignored; a key missing leaves the entry `"new"`.
2. The English line's leading and trailing spaces put back (`spaced`, `translate.ts`).
3. Checked: no line empty, every `{placeholder}` there and none extra, every line there. If not,
   asked once more on its own with the reason; still wrong, left `"new"` for Claude Code (a post:
   left for the queue's next retry).
4. Strings: written as now (`translateWithVoidAi`): the file read again, only entries still
   `"new"` written, with `translatedBy`, `translatedAt`, `gatewayLogId`, in fbtee's JSON layout.
   Pages: written and stamped as now, after the existing check that the code blocks, links and
   components came back unchanged. Posts: stored as now (`storeTranslation` in `content.ts`, the
   `events_translations` table, same shape).

## What `vp dev` and `vp build` check (`check.ts`)

- Stays: anything untranslated fails the build; every translation says who made it
  (`translatedBy`); every line there, none empty, every placeholder kept.
- Goes: judging finished translations by the rules (the script, "still the source text", kept
  words, `grammar.json`, wording; `problemsWith` in `judge.ts`).
- Goes: `reopenFailing` (`check.ts`, called by `plugin.ts` when `vp dev` translates), which sets
  finished translations back to `"new"` when they fail those checks. Nothing that's translated is
  ever set back.

## Order of the work

1. **By hand, no code** (`cf ai run google/gemini-4-hydrogen --body @request.json`, one sign-in you
   approve): ten real example entries into `th-TH` and `ar-EG` with and without what we send today
   besides the text (the code around each string `sourceContext`, the words to keep `keptTerms`,
   the glossary `glossaryFor`). As good without: dropped, with `glossaryMisses`. Also: a line
   varying by count and gender, and fbtee's built-in strings (list joiners, `{number}+`). And
   batching: the same 50 real new entries sent one per request, 10 per request, and all 50 in
   one, comparing what each costs, how long it takes, and whether every key comes back right. The
   cheapest that comes back right is the size. The answer to the test entries is saved as test
   data.
2. The code.
3. The tests and docs.
4. `vp check`, `test:unit`, `test:dev`, `test:preview`. Commit; push only when you say.

## Goes

- The rules: `rulesFor`, `SECTIONS`, `languageRules`, `instructions`, `TRANSLATING` (`ai.ts`),
  `fbteeRules` (`translate.ts`), the translate skill (`skills/void-fbtee-translate/`) and its
  bundling into `dist/ai.mjs` (`void-fbtee:raw` in the package's `vite.config.ts`).
- `grammar.json` and `judge.ts`'s rule checks; what's left of `judge.ts` is the placeholder and
  line check.
- `reopenFailing`; `postProblems`; matching by position; English read from the catalog line;
  `thinkingBudget`, `temperature`, the schema pasted into the prompt, language names.
- Today's uncommitted experiments in `ai.ts`, `judge.ts`, `plugin.ts`, the translate skill and the
  tests (keeping only corrected comments).

## Stays

- The example's real translations, pages and posts, as they are. Nothing already translated is
  translated again.
- The catalog loop, who-translated-it, `vp build` failing on anything untranslated.
- The post system: its table, `translationsFor`, `textOf`, the queue's retries and payment waits,
  the cron, the middleware, and all the example's post code.
- Claude Code for what's left and Claude's review; their prompts point only to the void-fbtee
  skill, not the deleted one (`translateTask`, `reviewTask`, `translatingSkillPath`).

## Docs that change with it

- `skills/void-fbtee/SKILL.md` (ships to apps): its pointers to the translate skill and
  `grammar.json`, and the model name.
- The package README, the root README, the comments in `models.ts` and `plurals.ts` (`MARKS`).
- The example's docs page (`pages/[lang]/docs/translating.tsx` and `.server.ts`) names Gemini 3.5
  Flash. Its sentences are updated; the strings that change come up as new and are translated like
  any new string. Only those.

## Also fixed

`fallbacksOf` (`runtime.ts`) skips natural parents (`fr-CA` → `fr`), which fbtee's own lookup uses.
It picks which post translation a page shows (`textLocales`, `server.ts`) and which catalogs a page
preloads. The example has no fallbacks, so nothing there changes; a unit test covers it.

## Tests

New:

- Test data of its own, not the example's: `test/entries.json` (six entries: a label, a `{time}`
  sentence, a plural, a gender line, count and gender, a list joiner) and `test/answers.json`
  (Hydrogen's real answer to them from step 1, with model, date and gateway log id).
- `test/unit/translate-entries.test.ts`: our function on that data, both ways.
- `test:dev`: the same entries sent to the dev route (which writes nothing), real Gemini, checking
  keys, lines and placeholders, not wording.

Old, in `packages/void-fbtee/test/unit/`:

| Test                                                | Action                                            |
| --------------------------------------------------- | ------------------------------------------------- |
| `judge.test.ts`                                     | deleted, except the placeholder-check tests       |
| `skills.test.ts`, `ai-rules.test.ts`                | deleted                                           |
| `translate.test.ts`                                 | prompt tests changed; page stamping kept          |
| `models.test.ts`                                    | rewritten for Hydrogen                            |
| `fixture/`                                          | kept; its entry falsely labelled `"claude"` fixed |
| `e2e/fresh/check.ts`, `e2e/preview/strings.test.ts` | the skill files a new app gets                    |

Everything else runs unchanged, including `e2e/dev/events.test.ts`, which already creates a post
in dev and waits for real Gemini to translate it: it now goes through the new function.

## Not in this change

Other models or a model option; simplifying the post queue, cron and markers; the fbtee asks
(`plans/fbtee-issues.md` #3, filed only with your OK).

## Evidence (2026-11-18, `cf ai run`)

| Request                                    | Model     | Result                       | Tokens in / out / thinking | Cost    |
| ------------------------------------------ | --------- | ---------------------------- | -------------------------- | ------- |
| "Book a seat", today's full rules          | 3.5 Flash | right                        | 1,425 / 46 / 0             | $0.0026 |
| the same, no rules                         | 3.5 Flash | same answer                  | 183 / 46 / 0               | $0.0007 |
| "Book a seat", low, schema                 | Hydrogen  | right                        | 188 / 29 / 57              | $0.0009 |
| plural + gender into ar-EG / ar-SA / ar-MA | Hydrogen  | each country's Arabic, right | 510 / ~150 / 520–690       | ~$0.006 |
| tour page into Thai                        | Hydrogen  | right, code identical        | 2,143 / 2,283 / 0          | $0.020  |
| dessert post, th-TH → en-US                | Hydrogen  | right                        | 263 / 58 / 136             | $0.0018 |
| "Your time: {time}" by key                 | Hydrogen  | right, under its key         | 321 / 53 / 88              | $0.0015 |

Hydrogen is $1.50 / $7.50 per million tokens; a few hundred strings for a language is about a
dollar.

Sources (checked 2026-11-18): Google's
[Gemini 3.5 notes](https://ai.google.dev/gemini-api/docs/generate-content/whats-new-gemini-3.5),
[structured output](https://ai.google.dev/gemini-api/docs/generate-content/structured-output),
[thinking](https://ai.google.dev/gemini-api/docs/generate-content/thinking); Cloudflare's
[model list](https://developers.cloudflare.com/ai/models/).
