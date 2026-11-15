# vp dev translates with Void's AI first

The user's decision, 2026-11-15: `vp dev` translates with Void's AI when it can, and with
Claude Code otherwise. There's no setting: it picks the engine itself.

## Which engine

1. **Void's AI**, when the app uses `void/ai`. Void then turns on a remote Workers AI binding in
   dev, on the Cloudflare account from `void connect` (Void 1.8.0 docs, guide/ai.md, "Local
   Development"; read 2026-11-15). Usage is billed in neurons on that account (guide/ai.md,
   "Usage Limits").
2. **Claude Code** otherwise: the session the dev server runs in, or `claude -p`.
3. **Neither**: vp dev reports what's left, as it does in tests and CI now.

## How

- Workers AI only runs inside the Worker, so the plugin can't call it from Node. The plan is a
  dev-only route served by void-fbtee's middleware (only under `vp dev`, never in a build),
  for example `POST /__void-fbtee/translate`. It takes one catalog entry or page and returns
  the translation from `ai.run`. The plugin posts what's new to its own dev server and writes
  the answers.
- The same rules as the skill: the entry's description, placeholders kept exactly, one line per
  plural form, markdown pages with their parts kept (`keptParts`, `missingHead`). After that,
  the same check runs, and a wrong answer is reported, not shipped: `vp build` still fails.
- The model: open. The app's own queue uses `@cf/meta/llama-3.3-70b-instruct-fp8-fast`, and
  guide/ai.md also lists Gateway models (`google/gemini-2.5-flash`, `openai/gpt-4.1-mini`).
  Pick the one that passes the example's catalogs and pages (Arabic plurals, Thai) in a trial.

## One translator, used in every place Void runs app code

Found 2026-11-13 (plans/quiet-harbor-atlas.md, step 7b): Void's AI is there wherever Void runs the
app's code. That's dev, the preview and Cloudflare, in a route, a queue or a job, always through
the same `ai` from `void/ai`. So there's one translator, not two:

- `translate(text, { from, to })` moves into the package. It's plans/primitives.md item 6, now
  built first, here. It's the model and prompt queues/translate.ts measured, extended for
  catalog entries: the description, placeholders, plural forms.
- The example's queue (posted events, at runtime) calls it, and so does the dev route
  (catalogs and pages, under `vp dev`). Both use one model and one measure.

## Proven already

Void's AI answers during `vp dev` in a Claude cloud session, with the keyring sign-in and no
API key: e2e/dev/events.test.ts ("a new post is translated by Workers AI, live") passed on
2026-11-15. It posts an event, and queues/translate.ts translates it with `ai.run` in the dev
server's Worker.

## Decided (2026-11-15)

- **The signal is "the app uses `void/ai`".** That's what makes Void connect dev to
  Cloudflare, so an app without AI never needs a Cloudflare sign-in just to run `vp dev`.
- **The route exists only under `vp dev`.** The plugin adds it only when it serves, never in a
  build, and it answers only requests that carry a token the plugin made at start.
- **The model is picked by measurement**, as queues/translate.ts's was (2026-11-13). Start from
  its model, Llama 3.3 70B. Run it on the example's catalogs and pages, with the Claude-written
  translations as the reference. A model that breaks a placeholder, a plural form or a page's
  kept parts fails, whatever its score.
- **The docs follow in the same change:** the skill, the READMEs, the Translating page and the
  home page then say "vp dev translates, with Void's AI or Claude Code".

## Found while building it (2026-11-15), to follow up

- Stopping the dev server with `fuser -k 5173/tcp` leaves its workerd processes running: 46 had
  piled up, holding about 5 GB, and `vp check` was killed for lack of memory. Stop the whole
  process group instead (what e2e/dev/setup.ts does for a server it started), and say so in the
  README's "Testing".
- Arabic with Llama 3.3 (test/translator/scores.json, chrF 65): an English word left in a line,
  "coding agent" as "terminal", the zero form of a count written as "{number} seats". Next cycle:
  try the models Cloudflare recommends for Arabic and for frontier quality (models.ts), on the
  test strings.
- The test strings' references are Claude Code's, not reviewed by a native speaker.
- The translator test runs through the example's dev server (e2e/translator/). Move it into the
  package with an app of its own (packages/void-fbtee/test/translator/app/: voidFbtee() and one
  file importing void/ai), started and stopped by the test (its whole process group), run as
  `vp run void-fbtee#test:translator`. Later, the user's call (2026-11-15).
- The test strings are all English source. An app written in another language (the Thai-source
  fresh app) is never tested: add source strings in another language, with references.

## Decided: what's cached (2026-11-15)

Only answers that passed the checks are kept, and they're kept where the app keeps its text: the
catalog (vp dev never sends an accepted string again), a translated page with its recorded
original, a stored post's translation (event_texts). AI Gateway's cache is never used for
translating (ai.ts: `skipCache`): the loop asks again when an answer is wrong, and a cached wrong
first answer would come back every time. Temperature 0 and a fixed seed make the same request give
the same answer, so test runs compare without a cache.
Checked 2026-11-15 (e2e/translator/cache.test.ts, `vp test run --project translator
e2e/translator/cache.test.ts --silent=false`): with the cache allowed, the same request at a high
temperature gave two different answers, twice, so AI Gateway isn't caching Void's AI requests in
dev on a direct Cloudflare account. `skipCache` stays: a team platform or a gateway with caching
turned on would cache, and then it matters.
