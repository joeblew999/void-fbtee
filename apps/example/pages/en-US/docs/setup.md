---
title: "Setting up void-fbtee in a Void app"
description: "What void-fbtee init adds to a Void app, piece by piece, for when void-fbtee check reports a setup problem."
---

# Setting up void-fbtee in a Void app

`void-fbtee init` does all of this and only adds what's missing, so it's safe to run again. Where
it can't safely edit a file, it prints the line to add. These are the pieces, for when
`void-fbtee check` reports a `setup:` problem.

- **Vite plugin:** `voidFbtee({ sourceLocale, locales })` from `void-fbtee/vite`, first in
  `plugins` in `vite.config.ts` (before `voidPlugin()`).
- **Middleware:** `middleware/99.i18n.ts` with `export { default } from "void-fbtee/middleware";`.
  It reads the locale from the URL and sets `<html lang dir>`.
- **Layout:** `pages/layout.tsx` wraps its children in `<I18nProvider>` from `void-fbtee/react`.
- **Temporal:** `worker: { compatibility_flags: ["temporal"] }` in `void.config.ts`, for
  Cloudflare's native Temporal.
- **TypeScript:** `"fbtee/ReactTypes"` in `compilerOptions.types`, and `"lib"` with `ES2025`,
  `DOM` and `DOM.Iterable`.
- **Lint (Vite+):** in the `vite.config.ts` at the workspace root, `lint.jsPlugins` with
  `@nkzw/eslint-plugin-fbtee` and `void-fbtee/lint`, and their rules (`init` prints them).
- **Scripts:** `i18n:prepare`, `i18n:check` and `i18n:translate` in `package.json`.
- **Agents:** a void-fbtee section in `AGENTS.md`, and this skill linked into `.claude/skills/`
  (or `.agents/skills/`) when the app has that folder.
