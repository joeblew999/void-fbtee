# plans/types-from-schema.md: void-fbtee fits Void like a library, and every type comes from the app

Status: 2026-11-19, written; waits for the user's approval in the conversation. Nothing built yet.

## Why

Types get lost wherever the app's facts reach the package as strings or hand-written types, instead
of from the app's own source, its Drizzle schema, or the types Void generates:

- **Content tables are string config.** `voidFbtee({ content: { events: ["title", "description"] } })`
  in `apps/example/vite.config.ts` goes through the plugin to `virtual:void-fbtee/config`, typed by
  hand in `packages/void-fbtee/src/virtual.d.ts` as `Record<string, { fields: string[] }>`. So
  `translateSoon("evnets", id)` compiles, and the queries in `src/db/translations.ts` build their
  tables by name (`contentTable(name, fields)`) with no types from the app's schema.
- **The package owns database code that belongs to the app.** `void-fbtee/db/schema`
  (`translationsOf`), `void-fbtee/db` (`primaryDb`, with a cast to reach `env.DB`), and
  migration-snapshot checks, all to make up for not being inside the app's schema.
- **The pages are a hand-written type** (`` `/[lang]${string}`[] ``), while Void already
  generates the exact list.

Pushing Void to open up (`void gen` and `additionalSchemas` for packages) goes against how Void is
built. `voidPlugin()` takes only `persistTo` and `auxiliaryWorkers` (`reference/api/plugin.md`,
Void 1.8.0). Its integrations, such as Hono (`integrations/hono.md`), are libraries that the app
imports in its own Void files. So the package changes direction and fits Void the way those do.

## The rule: what lives where

void-fbtee works at dev time and at run time, and that decides where each piece goes:

- **Dev and build time (the Vite plugin, the CLI)** can read the app's files and what Void
  generates in `.void/`. That covers compiling `<fbt>`, building catalogs, translating, and checks.
- **Run time (Worker and browser)** only has what the app's code imports, plus what the build
  carried over. Package functions there are typed by what the app hands them: its schema, its
  settings, or Void's generated types.
- **Nothing reaches run time typed by hand.** If a value has to be carried from build to run, its
  type is the app's own (`typeof` an app file, or Void's generated type).

## The changes

### 1. The app's settings: one file, typed by itself

- `apps/example/src/i18n.ts` (replaces `src/locales.ts`) holds `export default defineI18n({ sourceLocale,
  locales, site, common, fallbackLocale?, redirectHome? } as const)` and
  `declare global { interface VoidFbteeRegister { i18n: typeof i18n } }`. This is the same register
  pattern already used for `locales`, and Void's own `RoutePathMap` works the same way.
- `voidFbtee()` in `vite.config.ts` takes no app settings. It reads `src/i18n.ts`, as Void reads
  `void.config.ts`. `virtual:void-fbtee/config` becomes one line that re-exports that file, and its
  type in `virtual.d.ts` is `VoidFbteeRegister["i18n"]`, so the app's own type comes through.
- `RuntimeConfig` in `src/runtime.ts` (`locales: string`, `content?: Record<string, …>`) goes.

### 2. Translated content: generated plain Drizzle, owned by the app

- `void-fbtee gen translations <table> <field…>` (the CLI, like `void gen model`) writes, once, and
  never overwrites:
  - `db/schema/<table>_translations.ts`: plain Drizzle (`sqliteTable` from `void/schema-d1`),
    with `fields` typed from the source table:
    `.$type<Pick<typeof events.$inferSelect, "title" | "description">>()`. The field list is one
    `as const` export in the same file, which the type is built from. Void's `void db generate` sees
    an ordinary table ("No schema changes" for the existing one: proven 2026-11-19).
  - `queues/translate.ts`, `crons/translations.ts`, `middleware/99.i18n.ts`: each hands the
    package `import * as schema from "@schema"`, as `defineSeed` does.
- Package functions are typed by the schema they're given, and find the translations tables by
  their columns (`source_id`, `fields`, `translated_from`, read with `getTableConfig` from
  `void/schema-d1`):
  - `translateSoon(events, id)` takes the table, not `"events"`;
  - `translationsFor(db, events_translations, ids, locale)` returns
    `typeof events_translations.$inferSelect[]`.

  A wrong table or field doesn't compile (proven 2026-11-19).

- The queries use a typed join (Void exports no `relations()`) and `db.batch` on the handler's one
  `first-primary` session (proven 2026-11-19).
- `env.DB` from `cloudflare:workers` is typed in the app, so the cast in `primaryDb` goes.

### 3. Pages: from Void's generated types

- Everything typed (links, the sitemap's `exclude`, hreflang) uses `PagePath` and `PagePathMap`
  from `void/routes`, filtered to pages whose only parameter is `[lang]`. Proven 2026-11-19:
  - the package's built types point at `void/routes`;
  - the example got exactly its 13 pages;
  - a missing page and `/tickets/[id]` failed to compile;
  - a new page came through after Void regenerated.
- The run-time list still comes from Void's generated `.void/routes.d.ts`, because Void has no
  run-time page list (no export, no sitemap). `langPages` in `src/dev/plugin.ts` stops with an
  error when the file or its `PagePathMap` block is missing, instead of returning `[]`, which today
  silently empties the sitemap. Its type is the filtered `PagePath`.

### 4. The virtual modules after this

| Module                  | After                                                                            |
| ----------------------- | -------------------------------------------------------------------------------- |
| `config`                | re-exports `src/i18n.ts`, typed `VoidFbteeRegister["i18n"]`                      |
| `content-ask`           | gone: the app passes tables                                                      |
| `pages`                 | stays (no run-time list in Void), typed by `PagePath`, fails loudly              |
| `catalogs`, `catalog/*` | stay: built from catalog files at build time; keyed by the app's locales type    |
| `texts`, `dev`          | stay: dev only                                                                   |
| `md-pages`              | stays: `@void/md`'s own list                                                     |
| `zod`                   | stays: depends on whether the app has Zod 4                                      |
| `hono-route`            | stays (it must be Void's own Hono); typed from `hono/route`'s types, not by hand |

### 5. Removed in the same change

- `content` in `voidFbtee()`, and the plugin's other app-setting options (moved to `src/i18n.ts`)
- the exports `void-fbtee/db/schema` and `void-fbtee/db`
- `packages/void-fbtee/src/db/` in its current form: `contentTable`, the table-by-name queries,
  `primaryDb`'s cast
- `src/dev/content-files.ts` writing re-export stubs (replaced by `gen translations`)
- the migration-snapshot checks that existed only because the package owned a table
- `apps/example/src/locales.ts`
- the docs that describe any of the above: README, `packages/void-fbtee/skills/void-fbtee/SKILL.md`,
  the example's docs pages

## Not proven yet (proven before building, or reported plainly)

- Inside the package's generic functions, one internal line needed a loose type: Drizzle can't
  type "any table of this shape". The public inputs and outputs are exact. I'll try constraining
  the column types; if Drizzle won't allow it, it stays one internal line, said in a comment.
- Pairing a translations table with its field list at run time: by the `as const` export in the
  same file. To be checked against how `import * as schema` hands it over.
- The re-exporting `config` module reaching the browser build with the app's types (the same
  mechanism as `md-pages`, so expected to work).

## Checks

- `vp check`, then `vp run test:unit`, `test:dev` and `test:preview`, each run once at the end.
- In the app: a wrong table, field, locale or page fails to compile (kept as `@ts-expect-error`
  lines in the unit tests, so it stays true).
- A fresh `void init` app plus `void-fbtee init` plus `gen translations` builds and translates.
- `void db generate` in the example: "No schema changes".

## For Void (filed only with the user's OK)

Asked as a question, not a demand: whether packages can bring tables into an app the way Better Auth's
are (`plans/void-package-schema-issue.md`, drafted). The build doesn't wait on it.

Kept, or added:

- a run-time page list (today only the `PagePathMap` type exists);
- no replica bookmarks across requests;
- cache clear isn't global;
- KV build-up (#856, with numbers);
- `relations()` not exported;
- the schema-helper import loop (#472 covers only files inside `db/schema/`).

For Drizzle: an insert-select type that lets defaulted columns be left out, while the run time
needs every column.
