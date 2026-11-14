# plans/void-1.9.md: Void 1.8.0 to 1.9.1, before building more on 1.8.0

Status: proposed 2026-11-14, waiting for the user's OK. Can't start before 2026-11-15 03:27 UTC: pnpm
installs a release only once it's 24 hours old (it held back react-email 6.11.12 the same way on
2026-11-13), and 1.9.1 was published 2026-11-14 03:27 UTC. Its place in the order: `plans/README.md`.
Moved here from `plans/quiet-harbor-atlas.md`, "Still open".

## Why before the language plan

The language plan and everything after it are built on Void's routing, middleware and pages. Void 1.9.0 came out on 2026-11-14 at 00:11 UTC and
1.9.1 at 03:27 (`npm view void time`), and the repo is on 1.8.0. Upgrading after building would
mean checking all of it twice.

## What it changes

1. **Upgrade:** `void`, `@void/react` and `@void/md` to 1.9.1 (the example's `package.json`, and the
   package's peer range), then `vp install`.
2. **Read the docs that changed.** Compare 1.8.0's docs (`node_modules/void/docs/`) with 1.9.1's,
   file by file. Anything this repo relies on that changed gets checked or followed: Void's
   wording, comments that quote it, the skill. Several pages were already seen to change in
   wording, among them `guide/pages-routing/actions-and-forms.md` and `guide/ai.md`.
3. **#810, the `#` kept through an action's redirect** (fixed on Void's main in `ae024fb`, after 1.8.0):
   - check whether 1.9.1 has it, by posting an event and seeing whether a redirect to `#key=…`
     keeps the `#`;
   - if it does, posting redirects to `#key=…` itself, and the short-lived key cookie goes:
     `keyCookie`, `noKeyCookie` and their comments (`apps/example/src/events/delete-key.ts`, the
     event page, `pages/[lang]/events/new.server.ts`);
   - actions that update the page in place still drop the `#`, so the browser's copy of the key
     stays.
4. **Still the same:** 1.9.1's React `Form` still sets `action: form[method]` (`@void/react` 1.9.1,
   `dist/index.mjs`), so `plans/void-form-without-javascript.md` stands as it is.
5. **The plans:** the Void facts the other plans quote from 1.8.0's docs (`islands.md`'s "static
   only" layouts, `head.md`'s script, `revalidation.md`'s `Vary` rule, `rewrites.md`) are checked
   again in 1.9.1, and corrected where they changed.

## How we'll know it's right

- `vp check`, `test:unit`, `test:dev`, `test:preview` and `i18n:check`, all on 1.9.1.
- The fresh-app test (`e2e/fresh/`), because new apps get the latest Void.
- #810: the preview test that posts an event finds the key in the address right after posting,
  with no cookie set. Or, if 1.9.1 doesn't have the fix, that's written down, and the cookie stays.

Committed locally, and pushed when the user says.
