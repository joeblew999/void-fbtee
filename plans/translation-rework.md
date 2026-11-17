# plans/translation-rework.md: one translator on Cloudflare, Claude reviewing it at dev time

## Why

AI translation in void-fbtee works, but it has gone wrong in ways the checks don't catch, and the
code around it has grown to make up for weak models. What was found on 2026-11-17, at commit
`397a1d4`:

- **English shipped in Arabic.** Three Temporal-page counts in
  `apps/example/i18n/translations/ar-EG.json` are Arabic only in their zero form; the other five
  forms are the English source ("The polyfill on the Worker: {same} of {total} the same.", and the
  two after it).
- **`vp build` checks less than `vp dev`.** `vp dev` checks every AI answer with
  `judge.ts` `problemsWith()` (script, English left in, placeholders, grammar). `vp build` runs
  `check.ts` `check()`, which only runs `grammarProblems()` on finished entries, so the entries
  above pass the build. The header of `judge.ts` says the build checks every entry with it: it
  doesn't.
- **Scaffolding for weak models.** `models.json` names 7 Workers AI models and 45 languages, 43 of
  them "not yet measured". `translate.ts` sends one entry per request (Llama 3.3 mixed up lines when
  sent 3), picks examples (`examplesFor`) and glossary terms (`glossaryFor`), and rate-limits per
  model (`underLimit`). Its own measurement: Gemma 4 right on 263 of 276 strings (models.json,
  measured 2026-11-15), about 1 in 20 wrong.
- **No record of who translated what.** Every entry says `"status": "translated"`, whoever wrote it.

A correction to what was said in the conversation: five Arabic counts (seats left, seats booked,
three about nights) have no "one" line. That is by design, not a bug: `plurals.ts`
`pluralCategories()` leaves out a category only exactly 1 reaches, because a `<fbt:plural>` has its
own form for exactly 1 (fbtee's "_1", `IntlVariationResolver.tsx`). Still to check (step 1): what
those strings show in Arabic for a count of 1.

## What we take from wuchale

wuchale (github.com/wuchalejs/wuchale, v0.26.7, last commit 2026-11-07, read 2026-11-17) is another
compile-time i18n tool with AI translation. Its AI part is two files, `src/ai/index.ts` (279 lines)
and `src/ai/gemini.ts` (77 lines). What we take:

- **A translator is one function**, `translate(body, instruction) => Promise<string>`
  (`src/ai/index.ts`, type `AI`). Everything else (batching, checking, retrying) is the same
  whatever model is behind it.
- **Its defaults** (`src/ai/gemini.ts` `gemini()`): model `gemini-3.5-flash`, `batchSize` 50 strings
  per request, `parallel` 4 requests at once, thinking off (`thinkingBudget: 0`). Retries up to 30
  times (`MAX_RETRIES`), sending only the strings that failed.
- **The plural forms come from `Intl.PluralRules`**, in CLDR order, and the prompt says how many
  (`src/plurals.ts` `orderedPluralForms()`, `instruct()`); an answer with the wrong number of forms
  is rejected (`src/validate.ts` `isEquivalent()`).
- **One checker for both**: `isEquivalent()` checks every AI answer and is what `wuchale check` runs
  for CI (`src/cli/check.ts`, exits 1 on any error).
- **Machine translations are marked** (`item.attribs.ai = true`, written to the catalog as
  `#, ai`) until a person has looked at them.

What we keep that wuchale doesn't have: `judge.ts`'s checks for English left in, the wrong script,
gender and grammar.

## Cloudflare: Gemini without a key

Checked 2026-11-17 in Cloudflare's docs:

- The `ai` binding calls third-party models as well as Workers AI ones: `env.AI.run()` takes
  `@cf/…` and `{author}/{model}` ids
  (developers.cloudflare.com/ai-gateway/usage/worker-binding-methods/; changelog 2026-08-07,
  "Workers AI and AI Gateway unify model access and billing").
- `google/gemini-3.5-flash` is in the catalog (developers.cloudflare.com/ai/models/google/gemini-3.5-flash/):
  1,048,576-token context, $1.50 per million input tokens, $9.00 per million output. It is not
  marked "Zero data retention" (Gemini 3 Flash is).
- Third-party models need an AI Gateway and Unified Billing: Cloudflare holds the provider's
  credentials and takes prepaid credits; no API key of ours anywhere. A 5% fee on credits bought
  (developers.cloudflare.com/ai-gateway/features/unified-billing/).
- `ai.ts` `ask()` already sends every request through the account's `default` gateway.

## The design

- **Translator: Gemini 3.5 Flash through Void's AI, everywhere.** The same model, prompt and
  checks translate the app's text while `vp dev` runs (the dev server's route) and what people post
  at runtime (`queues/translate.ts`), in dev and on Cloudflare. That's what makes reviewing it in dev
  worth something: it is what production does.
- **Reviewer: Claude, at dev time only.** `claude -p` where it's signed in (a Mac), otherwise the
  printed prompt, which the session's own Claude or any coding agent follows. Never in a build, CI or
  production. It reviews against the same rules Gemini is given
  (`skills/void-fbtee-translate/SKILL.md`), so there is one set of rules.
- **Claude also translates, as the fallback only:** what still fails the checks after the retries,
  or everything when Void's AI isn't reachable (no credits, offline). Its entries are marked as its
  own.
- **A rejection is a fix to make.** Each verdict goes in a review log in the repo. A mechanical one
  (English left in, a form missing, a placeholder broken) becomes a rule in `judge.ts`; one about
  meaning or tone becomes a change to the translating skill. Both go in this plan's "Found" list
  until done.

## Steps

1. **Check the facts it rests on.**
   - Does the account have Unified Billing credits? (Cloudflare API, through the connector.)
   - Does fbtee's `prepareTranslationsBatchSync` keep an extra field in a catalog entry? Decides
     where step 4's record lives.
   - What do the five Arabic counts without a "one" line show for a count of 1? A unit test that
     renders them.
2. **Measure before changing.** A script under `scripts/` runs Gemma 4 (today) and Gemini 3.5 Flash
   over the example's catalogs with the same checks, and Claude reviews both. Prints, per language
   and model: right, wrong, time, cost. Kept for the record, in this plan.
3. **The translator.** In `ai.ts`: `translate(body, instruction)` on `google/gemini-3.5-flash`,
   wuchale's defaults (50 a request, 4 at once, thinking off, temperature 0, 30 retries of only what
   failed). The prompt names each string's plural forms from `Intl.PluralRules` (`plurals.ts`
   `pluralCategories()`) and its gender lines. Used by the dev route and by the post queue.
   **Removed:** `models.json`, `models.ts`, one entry per request, `examplesFor`, `glossaryFor`,
   `underLimit`, the Gemma/Llama/SEA-LION handling in `ask()` (`lineOf`, the no-JSON-Mode path).
4. **Who translated what.** Each entry records its translator (model or `claude`), when, and
   Claude's verdict, cleared to "reviewed" by a person. In the catalog entry if fbtee keeps it,
   otherwise `i18n/reviews/<locale>.json` keyed by hash. Event translations: columns on
   `event_texts` (`translated_by`, `translated_at`), with a migration.
5. **One checker.** `check()` runs the whole of `problemsWith()` on every finished entry, plus the
   plural-form check (each count has exactly `pluralCategories()`'s forms). Every AI answer is
   checked by the same function. Fix the `judge.ts` header to say so.
6. **Claude's review at dev time.** After `vp dev` translates, Claude reviews what's new or
   changed, in the background: the app's entries, and the event translations stored in the local
   `event_texts`. Verdicts, reasons and Claude's corrections go to the review log (corrections are
   applied to the catalog; local events are logged only). Shown in the dev server's log as it
   happens. `vp build` doesn't need a review (no Claude in CI) but says how many entries are
   unreviewed.
7. **The numbers.** One command prints the pass rate per language and model from the review log, so
   every prompt or rule change has a before and after.
8. **Fix the data.** The three Arabic Temporal counts, anything the new checks find in any catalog,
   and step 1's count-of-1 finding if it's wrong.
9. **Docs.** The Translating page (`apps/example/pages/[lang]/docs/translating.tsx`) and its strings,
   the README's "Translations", both skills (`skills/void-fbtee/SKILL.md`,
   `skills/void-fbtee-translate/SKILL.md`), the comments in `plugin.ts`, `translate.ts`, `ai.ts` and
   `queues/translate.ts`. Nothing left that describes the old way.

## Done when

- `vp build` fails on every problem `vp dev` checks for, including a wrong number of plural forms.
- Dev and the post queue translate with Gemini 3.5 Flash; `models.json` and the code listed in step
  3 are gone.
- Claude's verdicts from a full dev run are in the review log, and the pass-rate command shows them,
  next to step 2's numbers.
- No catalog has English in another language's lines.
- `vp check`, `test:unit`, `test:dev` and `test:preview` pass.

## Not doing

- Claude in a build, CI or production.
- Two models (Gemini 3 Flash for posts, for its zero data retention): one model is what makes the
  dev review stand for production, and event listings are public anyway.

## Found (follow-ups)

- (filled in as the work goes)
