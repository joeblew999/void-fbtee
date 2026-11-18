# plans/translation-simple.md: translating with Gemini the simple way

Status: 2026-11-18, waiting for the user's OK. No code changed yet.

## The change

Today every request to Gemini carries ~1,400 tokens of rules (built for Gemma 4, no longer used),
and answers are matched back by position. Requests sent by hand on 2026-11-18 showed Gemini needs
none of it. So: one model, one plain request with the locale codes, answers matched by key. The
rules, and the tests built on them, go.

This covers everything the package translates: the app's strings, its Markdown pages, and posts
people write at runtime (the example's events).

## The request

- Model `google/gemini-4-hydrogen`, `thinkingLevel: "low"`, no `temperature`, through Void's AI.
- One instruction sentence naming the two locale codes (`en-US` into `ar-EG`). No language names,
  no style rules.
- The answer's shape set with `responseJsonSchema`, the same keys as sent.

| What        | Sent as                                                                                                                                                                                                                                      | Example                                                                                    |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| App strings | each new catalog entry under its fbtee key: its description and its lines, each line named by its form (`one`, `few`, `female`, `few, female`) via `MARKS` in `plurals.ts`; the English from fbtee's collected strings, not the catalog line | `{"pyuIHcl…": {"description": "…", "lines": {"one": "{number} seat left", "other": "…"}}}` |
| Posts       | each field under its name                                                                                                                                                                                                                    | `{"title": "…", "description": "…"}`                                                       |
| Pages       | the whole Markdown page, answered as Markdown, not JSON; told to keep code blocks (their comments too), links, components and frontmatter keys                                                                                               | `pages/en-US/docs/tour.md`                                                                 |

One plain function builds the request and reads the answer. The plugin uses it for catalogs; the
post queue (`queue-translate.ts`) uses it for posts. It replaces `translateStrings` and
`translate` in `ai.ts`.

## The answer back

1. Each key onto the entry with that key; each line onto the line with that name. Never by
   position. A key not sent is ignored; a key missing leaves the entry `"new"`.
2. The English line's leading and trailing spaces put back (`spaced`, `translate.ts`).
3. Checked: every `{placeholder}` there and no extra, every line there. If not, asked once more
   with the reason; still wrong, left `"new"` (a post: left for the queue's next retry).
4. Catalogs: the file read again and only entries still `"new"` written, with `translatedBy`,
   `translatedAt`, `gatewayLogId`, in fbtee's JSON layout. Posts: stored as now
   (`storeTranslation` in `content.ts`, the `events_translations` table, same shape).

## Order of the work

1. **By hand, no code** (`cf ai run google/gemini-4-hydrogen --body @request.json`, one sign-in you
   approve): ten real example entries into `th-TH` and `ar-EG` with and without the code context,
   keep-words and glossary we send today (as good without: dropped); a line varying by count and
   gender; fbtee's built-in strings (list joiners, `{number}+`). The answer to the test entries is
   saved as test data.
2. The code.
3. The tests.
4. `vp check`, `test:unit`, `test:dev`, `test:preview`. Commit; push only when you say.

## Goes

- The rules: `rulesFor`, `SECTIONS`, `languageRules`, `instructions` (`ai.ts`), `fbteeRules`
  (`translate.ts`), the translate skill (`skills/void-fbtee-translate/`).
- `grammar.json` and its checks in `judge.ts`, `postProblems`.
- Matching by position, English read from the catalog line, `thinkingBudget`, `temperature`, the
  schema pasted into the prompt, language names.
- Today's uncommitted experiments in `ai.ts`, `judge.ts`, `plugin.ts`, the translate skill and the
  tests (keeping only corrected comments).

## Stays

- The example's real translations, pages and posts, as they are. Nothing retranslated.
- The catalog loop, who-translated-it, `vp build` failing on anything untranslated.
- The post system: its table, `translationsFor`, `textOf`, the queue's retries, the cron, the
  middleware, and all the example's post code.
- The void-fbtee skill (`vp dev`'s review prompt points to its "Reviewing" section instead of the
  deleted skill).

## Also fixed

`fallbacksOf` (`runtime.ts`) skips natural parents (`fr-CA` → `fr`), which fbtee's own lookup uses.
It picks which post translation a page shows and which catalogs it preloads. The example has no
fallbacks, so nothing there changes; a unit test covers it.

## Tests

New:

- Test data of its own, not the example's: `test/entries.json` (six entries: a label, a `{time}`
  sentence, a plural, a gender line, count and gender, a list joiner) and `test/answers.json`
  (Hydrogen's real answer to them from step 1, with model, date and gateway log id).
- `test/unit/translate-entries.test.ts`: our function on that data, both ways.
- `test:dev`: the same entries through the dev route with `dryRun`, to real Gemini, checking keys,
  lines and placeholders, not wording.

Old, in `packages/void-fbtee/test/unit/`:

| Test                                                | Action                                            |
| --------------------------------------------------- | ------------------------------------------------- |
| `judge.test.ts`                                     | deleted, except one placeholder-check test        |
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
