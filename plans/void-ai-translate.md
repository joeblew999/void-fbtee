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
