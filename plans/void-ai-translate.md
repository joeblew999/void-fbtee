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
   All five models without thinking on every string (2026-11-15, report only, models.json
   untouched). For the 17 strings Gemma gets wrong: Inkling 2 Small right on 15, DeepSeek V4.1
   Flash on 14, SEA-LION on 9, Llama 3.3 on 6. No model got "Catálogo" right; only Llama "You're
   booked" in German. Their other answers aren't all judged yet (about 5 to 10 a language for
   each), so no language's best model is known yet. Inkling's all judged (2026-11-15): 269 of 276
   right, against Gemma's 259; better in 10 languages, Gemma better in German (22 to 21), Spanish
   open (Inkling 20 with 2 not answered: timed out). Inkling is paid-only, 20 requests a minute,
   and three times Gemma's price a token ($0.30 and $1.00 a million in and out, against $0.10 and
   $0.30; Workers AI pricing, checked 2026-11-15).
   Decided 2026-11-15: Gemma 4 stays for every language. Ten more strings right (of 276) isn't
   worth a second, paid-only model at 20 a minute. What the day cost, from AI Gateway's analytics:
   $1.55 for 10,459 requests, Inkling $0.51 of it; Inkling gave about 340 output tokens an answer
   against Gemma's 50, so it may still think with reasoning_effort "none" (not checked: only
   matters if it's ever chosen).
4. Paid-only models (DeepSeek V4.1 Flash, Inkling 2 Small) are 20 requests a minute each
   (models.json perMinute). Done: the limit is per model (translate.ts routeCall). Open: a retry
   waits behind every request already queued for its model, so with these models a test can wait
   past Vitest's 2 minutes (3 timed out, 2026-11-15); a retry should take the next free slot.
   AI Gateway's cache is now keyed by the request and the string's round (ai.ts ask,
   `cacheKey`): every answer is stored the first time it's asked, so a judged answer comes back
   the same until the skill, the examples or the model change.
5. Done 2026-11-15: everything at once. Each string is made new in memory (no catalog file
   written per string), every string in every language is sent at once (translate.ts
   translateCatalog), under Workers AI's 300 a minute (routeCall), and each test waits for its own
   answer. All 12 languages with Gemma 4: 41 s, against about 14 minutes one after another. vp dev
   translates the same way: every new string in every language at once.

## Proposal: descriptions and grammar (2026-11-15, to approve)

Gemma's 17 wrong answers (of 276): about 3 are missing context, the rest grammar it slips on.

### Descriptions, first class

The description is in the developer's code, next to the text (`<fbt desc="…">`), and it's the
only context a translator gets (with the code around the string). Today most say where the text
shows ("Home feature title: …", "Button: …"), not what's happening; "You're booked." has "Told
to the reader who just booked", so a model can't tell a seat from a table or a job.

1. The void-fbtee skill (Strings): a description says what's happening and to whom, the sense of
   a word that has several ("book a seat at an event", "open a page"), and what each placeholder
   holds ("{pages}: the names of pages"), then where it shows. fbtee has no description for a
   placeholder, so the string's description names them.
2. The translating skill: the description is the situation; choose words by it.
3. The example's 90 descriptions and the test app's rewritten that way.
4. A description is part of an entry's key (fbtee hashes text and description), so a new
   description is a new entry: the catalogs' translations are carried over to the new keys by a
   one-off script (text unchanged), then Void's AI's new answers are judged against them.

### Grammar: checks from Intl and a small data file, sent back to the model

vp dev's checks already send a problem back ("Line 3 must keep {name}") and ask again. Add checks
for what the run found, in judge.ts problemsWith, so vp dev, the translator test and vp build's
report use the same ones. What each language needs is data (grammar.json, with its sources and
when checked), not code:

1. Plural lines: the one line and the other line differ (1 Platz / 2 Plätze); Arabic's many and
   other differ too (مقعدًا / مقعد). Catches 6 of the 17.
2. Gender lines: a male or female line has no both-genders form ("забронировал(а)", "/a"). 1.
3. Capitals: outside German, a word capitalised mid-sentence must be capitalised in the source
   too (a name). Catches "Catálogo", "String", "Chuỗi", "Chaînes": 3.
4. Latin words in Thai, Chinese, Japanese, Korean, Arabic, Hindi, Russian lines only where kept
   (commands, names, placeholders). Catches "coding agent" left in English: 2.
5. Korean: a placeholder followed by one particle alone (를) needs both forms (을(를)). 1.

Left for Claude Code to fix in the catalog: Hindi's swapped numbers and added words (3 or 4).
Then one run with Gemma, judged, to measure it.

### Done (2026-11-15)

- Skills: void-fbtee's says what a description must say; the translating skill, to choose words
  by it.
- Descriptions: 47 of the example's 349 rewritten (the rest already said what happens), all 23 of
  the test app's; their entries and verdicts moved to the new keys (fbtee keys an entry by text
  and description).
- grammar.json and judge.ts: count lines differ where a noun is counted, no both-genders word on a
  man's or a woman's line, no capital mid-sentence (not German; Anda keeps its), no English left
  in another script, Korean particles both ways, Thai's full stop, comma and doubled marks, and a
  form for more than one number (Russian's one: 1, 21, 31) keeps {number}. vp dev sends a
  problem back and asks again; vp build reports what needs only the translation. Over every
  judged answer: 36 of 112 wrong ones caught, none of 462 right ones.
- Gemma 4 after it: 263 of 276 right (259 before). Gemma often gives the same answer again after a
  check's problem (Catálogo, String), so the string is left for Claude Code, as designed. Still
  wrong: "You're booked." in German, Spanish, French, Russian, Vietnamese (the word for booking a
  person); Hindi's swapped numbers; added words; Arabic's 100 and up.

## Next: translate and review through one queue (2026-11-16, agreed)

The grammar checks (above) fixed almost nothing: Gemma gives the same answer again after a
problem, so they turned 2 kept wrong answers into strings left over, and the 259 to 263 was
mostly the descriptions. What's left wrong is meaning and wording, which only a reviewer that
understands the language catches.

### Who does what

|                                      | Translator          | Reviewer                            |
| ------------------------------------ | ------------------- | ----------------------------------- |
| Dev time, Claude Code on the machine | Claude Code         | Claude Code                         |
| Dev time, no Claude Code             | Gemma 4 (Void's AI) | Claude Haiku 5.5 through AI Gateway |
| Runtime                              | Gemma 4 (Void's AI) | Claude Haiku 5.5 through AI Gateway |

- Claude Code is the developer's own `claude` (nothing installed by the package), run by vp
  dev's own process. Gemma 4 and Claude through AI Gateway are both Void's `ai.run` (Void's
  guide/ai.md: Workers AI models, and Cloudflare Gateway models with Cloudflare-managed
  credentials). `anthropic/claude-haiku-5.5`: $0.10 and $0.50 a million tokens in and out, about
  Gemma's price (Cloudflare model catalog, checked 2026-11-16), paid from AI Gateway credits
  (Unified Billing) loaded once on the Cloudflare account: no Anthropic key, no secret.
- Which models: data in models.json, the translators as now and the reviewer beside them.

### The switch

`review: { dev: true, runtime: true }` in voidFbtee's options (the app's vite.config.ts; the
package's plugin.ts VoidFbteeOptions), one for each, off unless set. Off: as now (translate,
check, keep what passes).

### One path: the translate queue (parity)

- Every translation is one message on the app's translate queue: one catalog entry in one
  language at dev time (its plural and gender lines together), one post in one language at
  runtime (its title and description together). 23 strings in 12 languages: 276 messages.
- The consumer does the same for each: translate, check (judge.ts, grammar.json: a free first
  look, its problems handed to the reviewer), review, at most 3 rounds.
- Void delivers messages to the same consumer in Miniflare under vp dev as on Cloudflare
  (Void's guide/queues.md, "Local development", checked 2026-11-16). A queue is a file in the
  app's queues/ folder: the app's `queues/translate.ts` hands it to the package (void-fbtee init
  writes it; the example's is that file), its consumer options literal there, as Void reads
  them. The queue's batches and retries do the pacing, replacing translate.ts's per-minute
  counter.
- What only the developer's machine can do, run Claude Code and edit source files, the consumer
  asks of vp dev's own process through a dev-only route.

### When the reviewer finds it wrong

- Dev time: the reviewer changes the source code, that string's `<fbt>` in the developer's file
  (its description, or its wording where that misleads); the change is in the developer's git
  diff. vp dev's own prepare (catalogs.ts prepared(), fbtee's prepare-translations) drops the
  old entry from every catalog and adds the new one, in every language (checked 2026-11-16), and
  vp dev puts a message on the queue for each language.
- Runtime: the reviewer fixes the data the translation is made from, kept beside the person's
  post, which is still shown as they wrote it; only that language goes on the queue again.
- At most 3 rounds. Still wrong: at dev time the string is left untranslated, said in the log,
  and vp build fails on it, as on anything untranslated; at runtime the post is shown in the
  language it was written in, with its note, as for any post not yet translated.

### Order of work

1. The queue path: the package's consumer, `queues/translate.ts` in the example and from
   void-fbtee init, vp dev putting the app's new strings on it; the translator test through it.
2. The review loop with Claude Code on the machine (needs nothing more), measured by the
   translator test on the 23 strings in 12 languages: how many of the 13 wrong are right
   within 3 rounds, and that the right ones stay right. Claude Code, the test's judge, records
   the verdicts, so the reviewer doesn't mark its own work.
3. Claude Haiku 5.5 through AI Gateway as the reviewer, once credits are loaded: the same
   measurement.
4. The runtime review in the queue, for posts.
5. The two skills and the example's Strings and Translating pages, to match.
6. The grammar checks stay as the free first look, or go if the reviewer catches the same alone.

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
