# plans/types-from-schema.md: void-fbtee fits Void like a library, and every type comes from the app

Status: 2026-11-19, approved by the user in the conversation; built, committed locally. Part 1 was
not built, after reading the code (said under it).

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

### 1. The app's settings: already one file, typed by itself (not built)

Planned: a new `i18n.ts` holding every setting, read by the plugin. Reading the code showed the
settings already work that way: `apps/example/src/locales.ts` is the one file, `vite.config.ts`
imports it, and it registers its own type (`VoidFbteeRegister`, as Void's `RoutePathMap` is), so
the package's locale types are the app's. The only setting typed by hand was `content`, which
part 2 removes. Moving the rest into a new file would have changed `init`, the docs and the tests
for no type gained.

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
| `config`                | stays: the settings from `vite.config.ts`, locales typed by the app's register   |
| `content-ask`           | gone: the app passes tables                                                      |
| `pages`                 | stays (no run-time list in Void), typed by `PagePath`, fails loudly              |
| `catalogs`, `catalog/*` | stay: built from catalog files at build time; keyed by the app's locales type    |
| `texts`, `dev`          | stay: dev only                                                                   |
| `md-pages`              | stays: `@void/md`'s own list                                                     |
| `zod`                   | stays: depends on whether the app has Zod 4                                      |
| `hono-route`            | stays (it must be Void's own Hono); typed from `hono/route`'s types, not by hand |

### 5. Removed in the same change

- `content` in `voidFbtee()`
- the exports `void-fbtee/db/schema` and `void-fbtee/db`
- `packages/void-fbtee/src/db/` in its current form: `contentTable`, the table-by-name queries,
  `primaryDb`'s cast
- `src/dev/content-files.ts` writing re-export stubs (replaced by `gen translations`)
- the migration-snapshot checks that existed only because the package owned a table
- the docs that describe any of the above: README, `packages/void-fbtee/skills/void-fbtee/SKILL.md`,
  the example's docs pages

## The open points, as they came out

- **Loose types inside the package.** One line puts the app's table under the queries' shape
  (`src/db/schema.ts`, `value as unknown as TranslationsTable`), after checking at run time that it
  has every column of the shape. In `src/content.ts`, five lines hand the generic functions' results
  back as the app's types (`as FieldsOf<S, T>` and alike): Drizzle can't type "any table of this
  shape" or a generic table's rows, so these can't go. What an app passes in and gets back is
  exact, and `apps/example/src/content.types.test.ts` keeps it so (a wrong table or field fails to
  compile; checked by removing a marker, 2026-11-19).
- **A table and its field list at run time:** the generator writes `<table>_translations_fields`
  beside the table; `contentEntries` pairs them by that name in `import * as schema`, and stops with
  an error naming what's wrong. `test:dev` translated, re-translated and cleaned up through it.
- **The `config` module in the browser:** moot, since part 1 wasn't built; it's unchanged.
- **Found on the way:** the middleware's built type spelled out Hono's (`import("hono")`), which isn't
  a dependency of the package: the build failed when `NODE_PATH` reached Hono (as under `vp test`),
  and an app with pnpm's strict layout would have got no type. Now named once through Void's own
  `defineMiddleware` (`VoidMiddleware`); no built type mentions Hono.

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
