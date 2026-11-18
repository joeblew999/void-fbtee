# plans/void-upgrade.md: Void 1.8.0 to 1.10.0 and Vite+ 1.6.0 to 1.7.0, together

Status: waiting on Void (2026-11-18). Before, this was "Void 1.8.0 to 1.9.1", left on 2026-11-16,
the user's call: it bought little. Now two upstream breaks make it worth doing (README "Reported to
Void"), and it waits for the second to be fixed in a Void release. Its place: `plans/README.md`,
"Waiting on others".

## Why now

- **The Cloudflare plugin (looks fixed in Void 1.10.0):** Void 1.8.0's range for
  `@cloudflare/vite-plugin` takes `2.0.0-rc.0`, whose build output Void 1.8.0 can't read. Void
  1.10.0 (2026-11-17 02:29 UTC) asks for `^2.0.0-rc.0` itself (`npm view void@1.10.0
  dependencies`). This upgrade checks it builds.
- **Vite+ 1.7.0 (not fixed yet):** `void init` writes `"vite-plus": "^1.6.0"` and `"vite":
  "npm:@voidzero-dev/vite-plus-core@^1.6.0"`, still in Void 1.10.0 (`dist/init-*.mjs`,
  `SCAFFOLD_VITE_PLUS_DEV_DEPENDENCIES`). Vite+ 1.7.0 needs its core at `8.3.8000`, so new apps
  fail to build. Reported to Void on 2026-11-18 (the issue, filed by the user: its link goes in
  README "Reported to Void"). Done when a Void release writes a pair that matches.

## When it's done, also

- `export const maxConcurrency` (new in 1.10.0, `guide/queues.md`) on the example's
  `queues/translate.ts`, so a burst of posts can't flood Gemini (`plans/reliable-work.md`).

- Vite+ to 1.7.0 in the catalog (`pnpm-workspace.yaml`: `vite` and `vite-plus`), by `vp migrate`
  as Vite+ says, then `vp install`.
- The two overrides in `pnpm-workspace.yaml` (`@cloudflare/vite-plugin`, `cf`) go, if the new Void
  builds with the versions it asks for.
- `pinUpstream` in `e2e/fresh/check.ts` goes, both pins, if the fresh apps build without it; and
  the two entries in README "Reported to Void" with it.

## What checks it

Void 1.9.0 came out on 2026-11-14 at 00:11 UTC, 1.9.1 at 03:27 and 1.10.0 on 2026-11-17 at 02:29
(`npm view void time`), and the repo is on 1.8.0. The language redirect on `"/"` (built 2026-11-14) relies on Void's routing,
middleware and pages, all checked on 1.8.0, with tests for each of them. This upgrade runs those tests on the new version: that's the check.

## What it changes

1. **Upgrade:** `void`, `@void/react` and `@void/md` to the new version (the example's `package.json`, and the
   package's peer range), then `vp install`.
2. **Read the docs that changed.** Compare 1.8.0's docs (`node_modules/void/docs/`) with the new version's,
   file by file. Anything this repo relies on that changed gets checked or followed: Void's
   wording, comments that quote it, the skill. Several pages were already seen to change in
   wording, among them `guide/pages-routing/actions-and-forms.md` and `guide/ai.md`.
3. **#810, the `#` kept through an action's redirect** (fixed on Void's main in `ae024fb`, after 1.8.0):
   - check whether the new version has it, by posting an event and seeing whether a redirect to `#key=…`
     keeps the `#`;
   - if it does, posting redirects to `#key=…` itself, and the short-lived key cookie goes:
     `keyCookie`, `noKeyCookie` and their comments (`apps/example/src/events/delete-key.ts`, the
     event page, `pages/[lang]/events/new.server.ts`);
   - actions that update the page in place still drop the `#`, so the browser's copy of the key
     stays.
4. **Still the same (checked on 1.9.1; check again):** 1.9.1's React `Form` still sets `action: form[method]` (`@void/react` 1.9.1,
   `dist/index.mjs`), so `plans/void-form-without-javascript.md` stands as it is.
5. **The plans:** the Void facts the other plans quote from 1.8.0's docs (`islands.md`'s "static
   only" layouts, `head.md`'s script, `revalidation.md`'s `Vary` rule, `rewrites.md`) are checked
   again in the new version, and corrected where they changed.
6. **What the language redirect relies on in Void's behaviour** (checked on 1.8.0, 2026-11-14): the middleware seeing `"/"`, and Void leaving the middleware's own `Cache-Control: no-store` on
   its 302. Its preview and
   live tests cover both; a change shows up there, and is fixed in this plan.

## How we'll know it's right

- `vp check`, `test:unit`, `test:dev`, `test:preview` and `i18n:check`, all on the new version.
- The fresh-app test (`e2e/fresh/`), because new apps get the latest Void.
- #810: the preview test that posts an event finds the key in the address right after posting,
  with no cookie set. Or, if the new version doesn't have the fix, that's written down, and the cookie stays.

Committed locally, and pushed when the user says.
