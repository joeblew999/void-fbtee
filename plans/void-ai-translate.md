# void-ai-translate.md: vp dev translates with Void's AI first

The user's decision, 2026-11-15: `vp dev` translates with Void's AI when the app has it, and
with Claude Code otherwise, with no setting. Built; what follows is how it works now, then what's
left.

## How it works

- **One translator,** `void-fbtee/ai` (src/ai.ts), on Void's AI in the app's Worker. The example's
  queue uses it for posted events (`translate`), and `vp dev` uses it for the app's strings and
  pages (`translateStrings`, `translatePage`) through a route only `vp dev` has
  (`virtual:void-fbtee/dev`, a token per run). Void connects its AI when the app's own files import
  `void/ai` (Void 1.8.0 reads the app's files, not its packages); without it, the route answers 503
  and Claude Code translates.
- **The model per language,** src/models.ts, each choice with where it comes from: Cloudflare's
  docs, llmgateway.io's recommendations, or measured by the translator test. All checked against
  Cloudflare's catalog and its November 2026 deprecation list (2026-11-15).
- **How a string is sent** (src/translate.ts `translateEntry`, the same for `vp dev` and the test):
  alone, with the catalog's closest own translations as examples (not fbtee's built-in strings),
  the app's words for its terms (glossary), the words to keep and the code around it, at
  temperature 0 with a fixed seed, and the translating skill (below). An answer the judge finds problems in goes back with what was
  wrong, up to twice; only one with none is kept.
- **One judge,** src/judge.ts. Problems, which mean an answer is never kept: lines missing, JSON in
  a line, text left in English, the wrong script (the language's likely script, Intl.Locale
  maximize), a placeholder, command, file name or path changed. Signals, for the test to rank
  answers: the meaning score (ai.ts `meaningScores`, Workers AI's multilingual embeddings
  `@cf/baai/bge-m3`), the score against a reference (test/translator/score.ts, chrF), and a
  person's verdict (test/translator/verdicts.json).
- **What's cached:** only answers that passed, where the app keeps its text: the catalog (an
  accepted string is never sent again), a translated page with its recorded original, a stored
  post's translation (event_texts). AI Gateway's cache can't tell a right answer from a
  wrong one, so it's off for `vp dev` and the runtime queue. In the translator test it's set per
  string by the data, verdicts.json: on for a string with an answer judged right, off for the rest,
  so a wrong or unjudged one is asked fresh every run.
- **How the cache is controlled,** on the example's own Cloudflare account: `ai.run()`'s third
  argument is the Workers AI binding's (Void passes it on: runtime/ai.mjs `makeDirectBackend`).
  `gateway.id` sends a request through AI Gateway, `cacheTtl` turns its cache on, `skipCache` off
  (Cloudflare's AI Gateway docs, "Workers Bindings", 2026-11-05). Without an `id` a request skips AI
  Gateway, so the options do nothing. Proven 2026-11-15 by e2e/translator/cache.test.ts (the raw
  response's cf-aig-cache-status: HIT with the cache on, MISS off) and the gateway's own logs. The
  account's "default" gateway (made 2026-09-25) has its own cache off (`cache_ttl: 0`).

## The translator test

`vp run test:translator` (e2e/translator/, on the example's dev server). Its data, in the package
(test/translator/, README.md there): a test app in fbtee's own format, app/src/strings.tsx (the
test strings as real `<fbt>`, each testing one thing a translation can get wrong) and its catalogs,
app/i18n/translations/<locale>.json, every entry translated (the references: written by Claude
Code, not yet reviewed by native speakers); verdicts.json, what a person decided about an answer;
and src/models.json, the model per language, which vp dev and the app's own translate() read too.
test/unit/translator-data.test.ts checks the data on every `vp test`: every catalog complete, every
translation passing the judge in its script, every language with a model.

For each language and string, one test sets that string back to "new" (as fbtee's prepare writes
a new one), the rest of the catalog staying translated, and runs vp dev's own translateWithVoidAi
on it: the examples and glossary are the catalog's, as in a real app. One string per test, so no
test waits on more than one (a single test for a language's 21 strings ran past Void's 120 seconds
with a slower model, 2026-11-15). The catalog's translation is the reference. An answer vp dev
wouldn't keep, or one judged wrong in verdicts.json, is wrong; one judged right is right; the rest
are unreviewed, for Claude Code to judge. Every result goes to test/translator/scores.json,
committed: the git diff is what changed.

Two runs, the same command:

- `TRANSLATOR_PICK=1 vp run test:translator`: every model in models.json on each language. At the
  end, the one with the most right answers is written into models.json as the language's (source
  "measured"), unless answers are still unreviewed: they're listed, Claude Code judges them into
  verdicts.json, and the next pick run makes the pick. Judged answers stay judged, so after the
  first time it's two runs.
- `vp run test:translator`: each language with its own model; a wrong answer fails its string.

Each model's own settings are in models.json too (`models`): JSON Mode, and options sent with every
request that turn its thinking off or to its lowest. A translation needs no thinking, and without
them GLM 4.7 Flash spent all 8192 tokens thinking and gave no answer, Qwen 31 seconds and Gemma 4
nine on one string (AI Gateway's logs, 2026-11-15). An answer with no content, or cut off at
max_tokens, is an unusable answer (ai.ts ask), left for Claude Code.

## How to translate: one skill for every AI (built 2026-11-15)

skills/void-fbtee-translate/SKILL.md says how to translate the app's `<fbt>` text, what people
post and markdown pages, nothing about files or commands, so any AI can follow all of it. vp pack
bundles it into dist/ai.mjs (a `?raw` import, the pack plugin in packages/void-fbtee/vite.config.ts),
so it travels with the code to vp dev and to the Worker (an app's queue), and every app that installs
void-fbtee has it. ai.ts `instructions()` is the one place a request is worded: the skill's sections
for its kind, and for `<fbt>` text fbtee's own skill, steps 3 to 5, read from the app's installed
fbtee (translate.ts `fbteeRules`), never a copy. Claude Code reads the same two skills; the main
skill keeps only what's about editing the catalogs and pages.

In harmony with the code: the marks Void's AI is told each line is for (plurals.ts `MARKS`) come
from the same codes prepared() writes (`CATEGORY_CODE`, `GENDER_CODE`), and test/unit/skills.test.ts
fails if either skill's list of them, or its catalog codes, drift from the code. A placeholder can be
a finished value Intl wrote (a date, money, a number with its unit, a list): the skill says to keep
it and add no unit; money in the code is a plain `<fbt:param>`, never `number=`.

Measured (Gemma 4, the translator test, 2026-11-15, every answer judged by Claude Code): Thai 20/21
with the skill, 18/21 without; Arabic 20/21 with it, 14/21 without (without it Gemma wrote Egyptian
dialect in six strings). So it stays; any change to it is measured the same way
(`TRANSLATOR_PICK=1 TRANSLATOR_MODELS=<model> [TRANSLATOR_RULES=0] vp run test:translator`).

## Next (to approve)

1. Gender variants for `<fbt:name>`, `<fbt:pronoun>` and the reader's gender: vp dev gives such an
   entry one line per gender (fbtee's `types: [3]`) in the languages that change their words, as it
   does plural forms, each line marked with its gender (ai.ts FORMS has male, female, unknown); the
   judge expects those lines; the test's references get them. Arabic "{name} checked her ticket"
   came back masculine from two models, the one structural gap the runs showed.
2. Thai's and Arabic's picks again, with the skill (Thai's Inkling pick was made without it).
3. Done 2026-11-15: all 12 languages translated with Gemma 4 and every answer judged into
   verdicts.json: 253 of 276 right. The 23 wrong, mostly: a seat count's one-seat line given
   the plural (German, Spanish, French, Hindi, Russian), Russian's male lines written
   "забронировал(а)", a word capitalised mid-sentence (Spanish, French, Indonesian, Vietnamese),
   "their" given as someone else's or as "his"/"her" (German, Vietnamese, Chinese), words added
   ("successfully", "with this email", 同じ). Rules for those added to the translating skill
   (2026-11-15): 259 of 276 right after them. They fixed Arabic's zero lines, Russian's counts and
   its male "booked a seat", "their" in Vietnamese and Chinese, and German's one seat. Gemma gave
   the same wrong answer as before, rules or not, for: one seat in Spanish, French and Russian
   counts, "Catálogo", "String", "Chuỗi" capitalised, Hindi's swapped numbers, Korean's particle,
   "successfully" (Vietnamese), "with this email" (Thai), "joint en pièce jointe", "Sie sind
   gebucht", "coding agent" left in English (Thai, Chinese), 同じく, Arabic's 100-and-up line.
   AI Gateway's cache is now keyed by the request and the string's round (ai.ts ask,
   `cacheKey`): every answer is stored the first time it's asked, so a judged answer comes back
   the same until the skill, the examples or the model change.
4. Done 2026-11-15: everything at once. Each string is made new in memory (no catalog file
   written per string), every string in every language is sent at once (translate.ts
   translateCatalog), under Workers AI's 300 a minute (routeCall), and each test waits for its own
   answer. All 12 languages with Gemma 4: 41 s, against about 14 minutes one after another. vp dev
   translates the same way: every new string in every language at once.

## Where it stands (2026-11-15)

Gemma 4 on the full test set (23 strings, every construct), through the real path (prepared(),
translateWithVoidAi, the judge): Thai 20/23, Arabic 20/23. Thai misses: a word added ("with this
message", "her seat"), and the AGENTS.md line leaving "coding agent" in English. Arabic misses: plural
forms (the two form's case, zero and 100-and-up), and "you're booked" reworded. The skill's Arabic
number rule then got zero and 100-and-up, which it lacked: to be measured on the next run.

Open, from this round:

- `<InLanguage gender>` now feeds only fbtee's runtime gender: with the reader's sentences on
  `subject=`, is anything left that uses it? If not, it goes (react.tsx, the skill, the docs page).
- A judge check for a word added that the source doesn't have, which is most of what's left.

## Still to do

- Move the translator test into the package with an app of its own
  (packages/void-fbtee/test/translator/app/: voidFbtee() and one file importing void/ai), started
  and stopped by the test (its whole process group), run as `vp run void-fbtee#test:translator`.
  Later, the user's call (2026-11-15).
- Source strings in another language than English (the Thai-source fresh app is never tested).
- `vp dev` doesn't act on the meaning score yet: what's low enough to ask again is for the test's
  numbers to show.
- Stopping the dev server with `fuser -k 5173/tcp` leaves its workerd processes running (46 had
  piled up, about 5 GB, 2026-11-15). Stop the whole process group, as e2e/dev/setup.ts does for a
  server it started, and say so in the README's "Testing".
- Native speakers to review the references and verdicts.
- Test the runtime path the same way: the example's translate queue runs in `vp dev` too (Void's
  guide/queues.md), so a posted event's translations can be judged with the same verdicts.
- gpt-oss-120b's thinking setting (`reasoning_effort: low`) isn't on its Cloudflare model page as
  read here; its logs show it took (about 170 tokens a string, 2026-11-15). GLM 4.7 Flash was
  dropped: `enable_thinking: false` didn't take (8192 tokens of thinking, no answer, up to 140 s),
  so its languages and the default went to Gemma 4 until a pick run measures them.
