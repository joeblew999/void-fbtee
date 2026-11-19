# plans/no-casts.md: no casts in the package

Status: found 2026-11-19, while taking the casts out of the translated-content code
(`plans/types-from-schema.md`); not started. Waits for the user's OK. Each line is checked against
the code again before it's changed.

## Why

A cast (`as …`) tells TypeScript to believe something it can't check. Where it's wrong, the type is
wrong and nothing says so: types are lost, which `plans/types-from-schema.md` exists to stop. The
translated-content code (`src/content.ts`, `src/db/`, `src/queues/translate.ts`,
`src/crons/translations.ts`) now has none: a value read at run time becomes the app's type only
through a check (`isFields` in `content.ts`, the guards in `db/schema.ts`).

The rest of `packages/void-fbtee/src` still has casts on 53 lines (counted 2026-11-19, comments and
`as const` aside): `dev/translate.ts` 10, `ai.ts` 8, `server.ts` 4, `react.tsx` 4, `locales.ts` 4,
`gemini.ts` 4, `routes.ts` 3, `dev/check.ts` 3, two each in `runtime.ts`, `plurals.ts`,
`middleware/i18n.ts`, `dev/init.ts`, `dev/catalogs.ts`, one each in `head.ts`, `fingerprint.ts`,
`dev/commands.ts`.

## What they are, and the way out of each kind

- **JSON read at run time, trusted as a shape** (`JSON.parse(…) as Catalog`, `res.json() as
  RouteAnswer`, Gemini's answers): catalog files, the dev route's requests and answers, AI
  answers, package.json. The way out: a guard that checks the shape, as `isFields` does, and says
  what's wrong when it isn't. A bad catalog file or AI answer is then an error naming it, not a
  wrong type passed on.
- **Void's own types that don't reach the package** (`routeUrl(… as never)`, `voidRevalidate(…
  paths as RouteUrl[])`, Void's AI call `as never`, Void's `shared` data `as Record<string,
  unknown>`, `SharedContext` in React). In an app these are the app's types (Void's generated
  `.void/` files); in the package's own build they're Void's stubs. The way out: type them from
  Void's generated types, as the pages now are (`LangPage` from `PagePath`), or through what Void
  lets an app add to (`CloudContextVariables` for `shared`). Any that can't be: a Void report.
- **The app's languages from plain strings** (`l.segment as Lang`, `current.locale as AppLocale`):
  the locale table is built at run time from the settings, typed `string`. The way out: build it
  from the registered list's type (`VoidFbteeRegister`), so it's the app's type from the start.
- **What TypeScript's own types lack** (`Intl.Locale`'s `textInfo` and `getTextInfo`, a hash's
  words as `number[]`): a declaration of what the runtime has, once, instead of a cast at each use.

## Done when

- No `as` in `packages/void-fbtee/src` but `as const`; a lint rule keeps it so
  (`typescript/no-unsafe-type-assertion` or the closest rule Oxlint has, checked first).
- `vp check`, `test:unit`, `test:dev`, `test:preview` and `test:fresh` pass.
