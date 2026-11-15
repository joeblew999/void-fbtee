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
  temperature 0 with a fixed seed. Not the skills' rules: they're for Claude Code (commands, files),
  and were a page of noise around a one-line job (2026-11-15). An answer the judge finds problems in goes back with what was
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

For each language and string, the test sets that string back to "new" (as fbtee's prepare writes a
new one), the rest of the catalog staying translated, and runs vp dev's own translateWithVoidAi on
it: the examples and glossary are the catalog's, as in a real app. The catalog's translation is the
reference. An answer vp dev wouldn't keep (judge problems it couldn't get fixed), or one a person
marked wrong, fails the test; one marked right passes; the rest are listed as unreviewed, lowest
signals first, for a person to read. Every result goes to test/translator/scores.json, committed:
the git diff is what changed. Each cycle changes either data (a model, a reference, a verdict, a
string) or code (how a string is sent, the judge); a change is kept only if no language gets more
wrong answers or lower signals.

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
