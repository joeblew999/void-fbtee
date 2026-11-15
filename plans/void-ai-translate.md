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

## Open questions, before building

- Is "the app imports `void/ai`" the right signal? An app that doesn't use AI shouldn't need a
  Cloudflare sign-in just to run `vp dev`.
- Does the middleware's dev route need a check that only the dev server can call it? It must
  not exist in a build.
- Docs, the skill, the README and the home page then say: vp dev translates, with Void's AI or
  Claude Code.
