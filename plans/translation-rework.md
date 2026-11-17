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
- **Where Claude runs, and how.**
  - On a Mac with `claude` signed in: the dev server starts `claude -p` itself, in the
    background, after each translation (`translate.ts` `hasClaude()`, `runClaude()`).
  - In a Claude cloud session: `claude` is there but not signed in for the commands it runs
    (`claude auth status` gives `"loggedIn": false`, checked 2026-11-17, as `hasClaude()`'s comment
    says), so the dev server can't start it. It prints the review prompt instead, and the session's
    own Claude does the review with the same files and commands, as any developer's coding agent
    would. So in the cloud a review happens when the session runs it, not by itself.
  - Either way the verdicts land in the same review log, in the same shape.
  - Void's AI (Gemini) in a cloud session needs Void's Cloudflare sign-in there, kept in the
    session's keyring (`.claude/hooks/cloud-session.sh`). Checked in step 1.
- **A rejection is a fix to make.** Each verdict goes in a review log in the repo. A mechanical one
  (English left in, a form missing, a placeholder broken) becomes a rule in `judge.ts`; one about
  meaning or tone becomes a change to the translating skill. Both go in this plan's "Found" list
  until done.

## Steps

1. **Check the facts it rests on.**
   - Does the account have Unified Billing credits? (Cloudflare API, through the connector.)
   - Can this cloud session reach Void's AI: `vp` set up (`.claude/hooks/cloud-session.sh` runs
     at session start, so a repo added mid-session hasn't had it) and Void signed in to Cloudflare?
   - Does fbtee's `prepareTranslationsBatchSync` keep an extra field in a catalog entry? Decides
     where step 4's record lives.
   - What do the five Arabic counts without a "one" line show for a count of 1? A unit test that
     renders them.
2. **Measure before changing.** `vp run translations:measure` (`scripts/translations-measure.ts`,
   made 2026-11-17, checked here as far as a cloud session can: it builds the sample and stops at
   the missing dev server) runs Gemma 4 (today) and Gemini 3.5 Flash
   over the example's catalogs with the same checks, and Claude reviews both (in a cloud session, the
   session's Claude, from the printed prompt). Prints, per language
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

## Step 1's results (2026-11-17, in a Claude cloud session)

- **Credits: none yet.** AI Gateway's credit balance is 0, a card is on file, no top-up has ever
  been made (`GET /accounts/{id}/ai-gateway/billing/credit-balance`, through the Cloudflare
  connector). Gemini can't run until credits are loaded.
- **fbtee keeps extra fields.** `prepareTranslationsBatchSync` kept a made-up field on an entry and
  on a line of `th-TH.json` unchanged. So step 4's record goes in the catalog entry itself, not a
  side file (`addVariants` to be covered by step 4's tests).
- **Arabic for a count of 1 is right.** A `<fbt:plural>` makes two entries: the counted one (no
  "one" line, as `pluralCategories()` intends) and its own entry for exactly 1, which is translated:
  "1 seat left" → "تبقّى مقعد واحد", "You booked 1 night" → "حجزت ليلة واحدة". Nothing to fix.
- **This cloud session can't run the translator.** Void isn't signed in to Cloudflare here
  (`void cloudflare status`: "Not signed in"), and `vp run login` (`void connect --platform
  cloudflare`) needs an interactive terminal or a `CLOUDFLARE_API_TOKEN`, which we don't put in
  Claude. The Cloudflare connector refuses third-party models by design ("This server only runs
  Workers AI models") and answered a Workers AI call with 401. So:
  - Anything that calls a model runs where Void is signed in: `vp dev` on the Mac, or on
    Cloudflare itself (a Worker Preview, `test:deployed`).
  - A cloud session does the code, the checks (no AI in them), the reviews of what a Mac run wrote
    to the catalogs and the review log, and the data fixes.
  - Step 2's measurement is a `vp run` task the Mac runs; its results are committed, and the
    session reviews them. The Mac's agent and this session coordinate through comments on the
    work's PR.

## Spending, while it's being proven

- US$10 of AI Gateway credits loaded 2026-11-17 (balance 1000 cents, checked through the
  Cloudflare connector, `GET …/ai-gateway/billing/credit-balance`). No auto top-up.
- The gateway's totals before this work (dashboard, 2026-11-17): 11.66k requests, 6.58M tokens,
  US$1.62, all Workers AI, mostly `vp dev`'s one-string-per-request translating. The same tokens
  at Gemini 3.5 Flash's prices would be roughly US$15–35: Gemini only pays with batching.
- Until the whole thing is proven, every run that calls Gemini is small and capped:
  - step 2 measures a sample, 25 entries in each of `ar-EG` and `th-TH` (plurals, genders and plain
    strings included), not whole catalogs;
  - the measuring task adds up each answer's tokens (the response's `usage`) at the catalog's
    prices and stops at US$0.50 a run, printing what it spent;
  - the credit balance is read before and after each run and written in this plan.
- Whole catalogs, or dev with Gemini switched on for everything, only after the user has seen the
  sample's numbers and said so.

## Step 2's results (2026-11-17, run in a Claude cloud session)

Void signed in to Cloudflare here with `void cloudflare login` (a device-code login: works from a
cloud session when run in a terminal; `vp run login` failed only because it had none). Then
`vp run dev` and `vp run translations:measure`: 25 strings each in `ar-EG` and `th-TH`, counts and
genders first. Raw answers: `plans/translation-rework-measure.json`.

|                          | Gemma 4 (today)                                    | Gemini 3.5 Flash |
| ------------------------ | -------------------------------------------------- | ---------------- |
| ar-EG, passed the checks | 21 of 25                                           | 24 of 25         |
| th-TH, passed the checks | 23 of 25                                           | 24 of 25         |
| Requests for 50 strings  | 92                                                 | 4                |
| Tokens in / out          | 316,125 / 4,935                                    | 16,808 / 3,190   |
| Cost                     | Workers AI allowance (ran out twice: "UsageLimit") | US$0.054         |

- Gemini answers in about 8 s for 25 strings; Gemma took 80–97 s.
- Gemini put right the three Arabic Temporal counts that are English in the catalog, every form.
- Credits: US$10.00 → US$9.67 over the whole day's trying, including two 25-string requests
  that failed before Gemini's own request shape and thinking off were in place, and two probes.
  About US$0.001 a string a language once working.
- Getting there: in the Chat Completions shape Gemini thought until it ran out of tokens; in its
  own shape with `thinkingBudget: 0` it doesn't (68 tokens out for one string). Asked only for
  "JSON" it made up its own shape; given the schema it answers in ours.

Claude's review of the answers (what the checks didn't catch), each now a fix to make:

1. **A file name cut short, by both models in both languages:** `void.config.ts` came back as
   `config.ts`. `judge.ts` `keptTerms()` takes `[\w-]+\.ts`, so only `config.ts` is kept and the
   change passes. Fix: dotted file names whole.
2. **Arabic switched register:** one of Gemini's Arabic answers is Egyptian colloquial ("بيفشل…
   لسه مش مترجمة") among Modern Standard Arabic. Fix: the translating skill says Modern Standard
   Arabic for every `ar-*`, and `grammar.json` flags colloquial markers (بيـ, لسه, مش, كمان).
3. **Words drift without the app's own:** Gemini wrote งานกิจกรรม where the app says กิจกรรม,
   ผู้ใช้ ("user") for the reader, البرمجية الوسيطة for "middleware". The glossary (the app's
   one-word entries and common strings) is cheap in a batch: keep it, drop only the per-entry
   examples.
4. **False alarms:** "fbt" and "lint" flagged as English left in. Fix: kept terms.
5. **Workers AI's allowance ran out mid-run** ("AI is temporarily unavailable because its usage
   limit was reached"): today's translator isn't dependable in dev either.

## Steps 3 to 5 and 8, done (2026-11-17)

- Gemini 3.5 Flash is the one translator (`models.ts`), batched as wuchale does (50 a request, 4 at
  once), for `vp dev` and for posts. `models.json`, the rate limiter, the per-string examples and
  the Chat Completions path are gone; the glossary stays.
- Entries record `translatedBy`/`translatedAt`; `event_texts` has `translated_by`/`translated_at`
  (migration `20261117103319_dark_roulette.sql`, which plans/translation-provenance.md made
  required, with `gateway_log_id`).
- `vp build` runs `problemsWith()` on every finished entry against its source lines. Its first run
  on the example's catalogs found 118 problems; 80 were the checker's own false alarms, each fixed
  as a rule (lines of only placeholders or names, developer words, glosses in brackets, only known
  hyphenated names); the other 38 were real (English left in, the Arabic Temporal counts) and were
  translated again by `vp dev`. Now: "all translated, nothing to fix".
- `vp run translations:measure` through the new code: 25 of 25 in each of ar-EG and th-TH passed
  the checks, US$0.050 for the 50 (ar-EG 58 s, th-TH 7 s).
- Credits: US$10.00 → US$9.44 for the whole of today, including a run on a stale build (below).

Claude's review of today's Gemini answers, and what came of each:

1. Product names translated ("ذكاء Void الاصطناعي", "AI ของ Void" for Void's AI): now kept terms
   (`grammar.json` keptTerms.products), and the entries translated again.
2. The Temporal counts were ambiguous: which number the plural forms are for. Gemma and Gemini
   each guessed differently. Fixed at the source: their descriptions now say the forms are for
   {total}; translated again.
3. "polyfill" written as "ملف التعويض" ("compensation file"), then "ملف الـ polyfill" ("the polyfill
   file"): corrected by hand to "الـ polyfill", marked `translatedBy: "claude"`.
4. Still open, not caught by any rule: in the sample, "لم تحجز أي ليالٍ" (after أي, the singular:
   أي ليلة) and "يتطابق صف صفر" ("row zero matches") for a count of zero; "مؤجل" where the catalog
   says "لاحقًا" for "Deferred". To go in the translating skill's Arabic counts and the glossary.

## Steps 6 and 7, done (2026-11-17)

- After translating, `vp dev` asks Claude Code to review what an AI wrote (`translate.ts`
  reviewApp): `claude -p` where it's signed in, else the prompt in its log. The void-fbtee skill's
  "Reviewing" says how: the verdict goes in the entry (`review`: ok, or wrong with `of`, `note`
  and `was`, the correction being the entry's lines), and a translation done again loses its old
  review. `vp dev` and `vp build` say how many wait.
- `vp run translations:reviews`: per language and translator, reviewed, right, waiting, and what
  was wrong.
- First review, by this cloud session's Claude from the printed prompt: Gemini 3.5 Flash right on
  8 of 9 in ar-EG (89%) and 12 of 14 in th-TH (86%). Wrong: a literal "ship" (شحن); two Thai
  additions the source doesn't have; two Thai words that differ from the app's own (the
  repository, the queue's consumer). None is a rule; the last is the glossary's limit (it only
  takes one-word entries), noted for later.
- Not done: reviewing event translations in the local database. They're the example's own table,
  which the package's dev server can't read; it needs a route in the example, like the translate
  route. Left for later, with the review of posts in production out of scope (no Claude there).

## What paying for the model changed (2026-11-17)

Moving from Workers AI to Gemini on credits changed more than the model. Fixed:

- **Credits used up or a limit reached** (AI Gateway: 402, codes 2052/2021; 429, a spend limit or
  code 2018; Cloudflare's "Troubleshooting" page, checked 2026-11-17): `models.ts paymentProblem()`
  tells these from a bad answer. `vp dev` says once what to do and stops asking (the dev route
  answers 402/429; translate.ts `routeCall`), instead of asking again entry by entry. Unit-tested on
  Cloudflare's own messages; not yet seen live (it needs the credits run out).
- **The post queue paid twice:** it stored every language at the end, so a retry translated all of
  them again. Each is now stored as it's done. It retried 3 times at once (Void's default) and then
  Cloudflare dropped the message for good (no dead-letter queue), so a post made while the credits
  were out was never translated: now 5 retries 5 minutes apart, an hour apart when the account isn't
  paying, and the daily job (`crons/reminders.ts requeueUntranslated`) queues every upcoming event
  still missing a language. In the daily job, not its own: the free plan allows 5 Cron Triggers.
  Proven in dev: an Arabic text deleted, the job run through `/__void/scheduled`, the queue stored a
  new one by Gemini.
- **Docs:** the package README's `vp dev` row still said Claude Code goes first; it now says Void's
  AI does, and Claude reviews. It, the SKILL and the root README now say what translating costs
  (about US$0.001 a string per language) and that the text goes to Google (not Zero Data Retention,
  `zdr: false` on the gateway; AI Gateway also logs every request, `collect_logs: true`).
- `plans/video-conferencing.md` still said posts are translated with Llama.

Then, also fixed:

- **Upgrading apps:** `vp build` now checks every finished translation, so a catalog from 0.6.0 can
  fail it (this repo's did, 118 times), and nothing translated those again: `vp dev` only translates
  new entries. Now `vp dev` sends each finished translation that fails back to new
  (`check.ts reopenFailing`), logged with what was wrong. Version 0.7.0 (options removed), the
  package README's install line (it still said v0.5.0) and an upgrade note in the SKILL.
- **The live check after each deploy** posts an event and waits for its Thai title: with the credits
  used up it timed out with nothing saying why; it now says where to look.

Open: event translations already on the live site were made by the old models and have no
`translated_by` (null): a review of posts in production (the next plan) can't tell them apart.

Done 2026-11-17: a spend limit on the `default` gateway, `gemini-daily`: US$2 a sliding 24 hours on
`google/gemini-3.5-flash` (AI Gateway "Spend limits"), set through the Cloudflare connector; dev and the
live site share it. Its other settings (authentication, Unified Billing, logs) were kept.

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

- `apps/example/void.lock.json` was behind `void.config.ts` after `397a1d4` (Workers Logs on):
  `vp install` added `observability` and `browser` to it. Committed on its own.
- In a cloud session `vp run dev` doesn't start at all, not only its AI: the remote bindings (AI,
  Browser Run) need Cloudflare's sign-in, and without it the Cloudflare Vite plugin stops the
  server ("In a non-interactive environment, it's necessary to set a CLOUDFLARE_API_TOKEN",
  2026-11-17). The tailscale task's note says a cloud session runs the dev server: true only once
  Void is signed in there. To settle when step 6 (reviews) is built.
- `vp run login` (`void connect --platform cloudflare`) fails with no terminal; `void cloudflare
  login` in one works from a cloud session (device code). `.claude/hooks/cloud-session.sh` now
  also installs `secret-tool`, which Cloudflare's `cf` needs to keep the sign-in in the keyring.
  Settled: `vp run login` works in a cloud session when it runs in a terminal (checked
  2026-11-17: "Connected to Cloudflare"); the README says so. Claude runs it in one.
- Fixed: `vp run dev` builds the package first (`vite.config.ts` dev: `vp run void-fbtee#build`,
  then the rest; `dependsOn` ran the build a second time alongside, under `--parallel`).
  Was: `vp run dev` could start on a stale build of the package: it runs `vp pack --watch` and the app's
  `vp dev` side by side, and the app may load `dist/` before the rebuild lands. The first dev run
  after this change translated 22 strings with the code from before it, one string a request
  (37 requests, US$0.15, AI Gateway's logs 09:35 UTC). To fix: the app's dev waits for the
  package's first build.
- The Cloudflare connector's Workers AI call returned 401 ("Reconnect to sign in again"): it may
  lack the Workers AI permission. Only matters if a session is to call Workers AI through it.
