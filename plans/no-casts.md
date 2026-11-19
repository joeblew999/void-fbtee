# plans/no-casts.md: no casts in the package

Status: 2026-11-19, approved by the user in the conversation; built, committed locally.

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

## As built (2026-11-19)

- **The lint rules, for `packages/void-fbtee/src/**`** (the root `vite.config.ts`, `lint.overrides`):
  `typescript/consistent-type-assertions` set to `never` (no `as`, `as const` aside), and
  `no-explicit-any` with the five `no-unsafe-*` rules, since a value used as `any` (from
  `JSON.parse`, `require()`, a loosely typed library) loses its type as surely as a cast. They
  found 56 casts and 41 uses of `any`; none are left.
- **Checks instead (`src/guards.ts`):** `isRecord`, `field`, `textField`, `textRecord`,
  `parseJson` (JSON as `unknown`). Shapes checked where they're read: catalogs
  (`src/dev/catalog-file.ts`, `readCatalog`: every entry, `usage` and `review`, against the real
  catalogs), Gemini's answers and the dev route's requests (`isGeminiAnswer`, `isEntry`,
  `isDevRequest`), the page's `<meta>` data (`sharedI18n`), package.json and tsconfig.json in
  `init`, fbtee's collected phrases, magicast's config proxies (`configObject`, `child`).
- **Real bugs the casts hid, now fixed:**
  - a locale written in another spelling than its canonical one (`en-us`) got a segment the app's
    types don't have: `resolveLocales` now says to write it as `en-US`;
  - Cloudflare's D1 types weren't loaded in the package's own build, so every D1 result
    (`D1Result`) was silently untyped (TypeScript skips library files here): the package now has
    `@cloudflare/workers-types` (the version Void uses) in its dev dependencies and types;
  - magicast's lists don't hand their callbacks plain values, so a check written with `.some`
    never matched and `init` would have replaced an app's `compatibility_flags` with its own
    (caught by the unit tests): lists are read through a spread (`plainList`).
- **Typed views instead of casts**, which TypeScript checks: Void's `ai.run` (typed only for
  Cloudflare's own models, not Gemini through AI Gateway) and Void's `revalidate` (typed by the
  app's routes), each assigned to a plain function type.
- **Two casts left, each with a lint exception saying why:** `untypedRouteUrl` in `src/routes.ts`
  and `untypedUseForm` in `src/react.tsx`. Void's `routeUrl` and `useForm` are typed only by the
  app's own routes and actions (its generated `.void/routes.d.ts`), which a package built without
  an app never has; Void exports no untyped builder, and copying its URL encoding would be worse.

## For Void (filed only with the user's OK)

- An untyped `routeUrl` (and `useForm`) for a library that builds a route known only at run time:
  the two casts left.
- `ai.run` typed for a model reached through AI Gateway (`google/gemini-…`), not only Workers AI's.

## Done when

- No `as` in `packages/void-fbtee/src` but `as const`; a lint rule keeps it so
  (`typescript/no-unsafe-type-assertion` or the closest rule Oxlint has, checked first).
- `vp check`, `test:unit`, `test:dev`, `test:preview` and `test:fresh` pass.
