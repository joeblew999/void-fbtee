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

The package now generates plain Drizzle into the app's own `db/schema/` (`void-fbtee gen translations events title description`), once, like `void gen model`, and the app owns it. Its package functions are typed by the schema the app hands them (`import * as schema from "@schema"`, as `defineSeed` does). That works, and `void db generate` treats the table as the app's own.

What it costs: the package can't update the table's shape later the way Void updates Better Auth's (a new column means each app regenerates or edits by hand), and every app carries a file it didn't write.

## What would help, if it fits Void's design

Any one of these:

1. A documented way for a package to add generated schema files to `additionalSchemas`, as auth does, for example from its Vite plugin or a field in `void.config.ts`.
2. `void gen` generators that packages can provide.
3. Or a word that the intended way is app-owned generated files, as we do now, so packages stop looking for another way in.

Void 1.8.0 (1.10.0's `additionalSchemas` callers checked the same way).
