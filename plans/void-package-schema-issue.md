# plans/void-package-schema-issue.md: a question for Void, drafted

To file, from the repo's root (the issue's text is everything under "Issue body" below):

```sh
gh issue create -R voidzero-dev/void \
  --title "Could the way Void brings Better Auth's tables into an app be open to other packages?" \
  --body "$(sed -n '/^## Issue body$/,$p' plans/void-package-schema-issue.md | tail -n +3)"
```

Checked 2026-11-19: no issue like it in voidzero-dev/void (the Better Auth ones, #677, #756, #858,
#872, are about the generated tables themselves). Filing from the cloud session failed: the GitHub
connector gets 403 on voidzero-dev/void, and the session's `gh` token is invalid. Once filed, this
file goes and README "Reported to Void" names the issue.

## Issue body

## The question

Void brings Better Auth's tables into an app's schema without the app writing them: it generates `.void/better-auth-schema.ts` from `auth.ts`, and hands that file to drizzle-kit beside the app's own schema. Could a package that isn't Better Auth do the same?

## Why we ask

[void-fbtee](https://github.com/joeblew999/void-fbtee) is an i18n package for Void apps. Among other things, it translates what people post (an event's title and description) into the app's languages, through a queue and a cron. That needs one table per translated table (`events_translations`) in the app's database, with the app's own types: `fields` is typed from the source table's columns.

Today a package can't put a table into an app's schema the way Void does for Better Auth:

- **The extra schema is fixed to Better Auth's file.** In Void 1.8.0, every caller of `writeDrizzleConfig` passes `additionalSchemas: [join(root, ".void", "better-auth-schema.ts")]` and nothing else (`dist/db-*.mjs` `runGenerate`, `dist/gen-*.mjs`, `dist/deploy-managed-static-*.mjs`). `writeDrizzleConfig` itself takes a list (`dist/config-*.mjs`), so the mechanism is general, but only auth reaches it.
- **`voidPlugin()` takes only `persistTo` and `auxiliaryWorkers`** (`reference/api/plugin.md`), so there's no way for a package to add generated files or schema there either.
- **`void gen` is closed to packages:** it can't be extended with a package's own generator.
- **A package's helper inside a schema file can loop.** A helper like `translationsOf(events)` that a schema file calls, which imports `void/db` (for `sql` defaults), creates an import cycle, because `void/db` imports the app's schema. #472 / #526 made `void/db` schema-free only for files inside `db/schema/`, not for a package those files import. We saw it in a production build as "translationsTableName is not a function" (2026-11-17).

## What we do meanwhile

As close to Better Auth's as a package can get today ([plans/like-better-auth.md](https://github.com/joeblew999/void-fbtee/blob/main/plans/like-better-auth.md)):

- `void-fbtee gen translations events title description` writes plain Drizzle into the app's own `db/schema/events_translations.ts`. Its first line marks it as kept by the package. The app's part is one line, the list of fields; the table's `fields` type is built from that list and the source table's own columns.
- The package's Vite plugin rewrites the rest of the file whenever it isn't the package's current table: as `vp dev` starts, and on each save in `db/schema/`. That's the job Void's `prepareProject` does for `.void/better-auth-schema.ts`, only where the file differs. `vp build` never writes: it fails while the file isn't current. The app's formatter is allowed (quotes, semicolons, commas don't count).
- The app's own files (`src/content.ts`, which hands the package `import * as schema from "@schema"`, its session and its queue, as `defineSeed` takes the schema; `queues/translate.ts`; `crons/translations.ts`; the middleware) are written once and checked by `vp build`, which names the line missing.
- `void db generate` treats the table as the app's own ("No schema changes" on our example after the switch). Every package function is typed from the schema; a table without translations, or a field it doesn't translate, fails to compile.

What it still costs, and only Void can change:

- **The file has to be in the app's `db/schema/` and in git**, not in `.void/`: `void db generate`, `void prepare` and a fresh clone's type check run none of the package's code, so nothing would write it for them. And a file outside `db/schema/` that imports `void/db` loops (#472).
- **Void's own commands don't refresh it.** After upgrading the package, it's `vp dev` (or the build failing) that brings the new table, where Void's `prepareProject` refreshes Better Auth's in every command.
- **Void doesn't wire the package's queue, job and middleware**, as it wires Better Auth's routes. The app holds those files, and the build checks them.

## What would help, if it fits Void's design

Any one of these:

1. A documented way for a package to add generated schema files to `additionalSchemas`, as auth does, for example from its Vite plugin or a field in `void.config.ts`.
2. `void gen` generators that packages can provide.
3. Or a word that the intended way is app-owned generated files, as we do now, so packages stop looking for another way in.

Void 1.8.0 (1.10.0's `additionalSchemas` callers checked the same way).
