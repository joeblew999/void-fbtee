# plans/like-better-auth.md: the translations table kept by the package, as Void keeps Better Auth's

Status: 2026-11-19, approved by the user in the conversation; built, committed locally. Then the
issue in `plans/void-package-schema-issue.md` is filed (by the user), showing how close a package
can get; its "What we do meanwhile" says what was built.

## How Void keeps Better Auth's tables (Void 1.8.0, `dist/prepare-*.mjs`, read 2026-11-19)

- The app owns one file of settings: the root `auth.ts`.
- Void owns the tables made from it: `.void/better-auth-schema.ts`, which git ignores.
- Void rewrites them in `prepareProject`, only when they changed. That runs in `vp dev` (and on
  saving `auth.ts`), in builds, and in `void db generate`, `void gen` and `void prepare`, so a fresh
  clone and a Void upgrade get the current tables without anyone touching them.
- Void hands the file to drizzle-kit (`additionalSchemas`) and wires the routes itself.

## Where void-fbtee is today (`plans/types-from-schema.md`)

`void-fbtee gen translations events title description` writes `db/schema/events_translations.ts`
once, and the app owns all of it. Changing the fields already works by editing its one list (the
`fields` type is built from it). But if a new void-fbtee changed the table (a new column, an index),
nothing would change it in an app: each would have to regenerate it or edit it by hand.

## The change: the package keeps the table, the app keeps its choice of fields

- **The same file, with two owners:** `db/schema/events_translations.ts`.
  - The app's: the one line naming the fields,
    `export const events_translations_fields = ["title", "description"] as const;`.
  - void-fbtee's: everything else (the table, its columns, its index), marked at the top:
    "kept by void-fbtee: only the list of fields is yours; the rest is rewritten to the package's
    current table".
- **Rewritten as Void rewrites its own:**
  - `vp dev` rewrites the file as it starts, and whenever the file is saved, only when it differs
    from what the package writes for that list (the way Void's `writeFileIfChanged` does). It says
    so in the log, with the next step when the table changed: `vp exec void db generate`.
  - `vp build` doesn't write. It fails while the file isn't what the package writes ("out of date:
    vp dev rewrites it"), so CI and `void deploy` never build a table the package wouldn't make.
    Void's own deploy then refuses a schema without its migration, as it already does.
  - `void-fbtee gen translations` writes the file the same way, from the list given.
- **The rest checked, not owned:** `src/content.ts`, `queues/translate.ts`, `crons/translations.ts`
  and `middleware/99.i18n.ts` stay the app's (they hold the app's own hooks, like `auth.ts`). Once
  the schema has a translations table, `vp build` fails while one is missing or not wired to
  `content`, saying the line to add, as it did before `plans/types-from-schema.md` removed the old
  checks.

## Why not further (what only Void can do: the issue)

- **The file has to be in the app's `db/schema/`, and in git:**
  - `void db generate`, `void prepare` and a fresh clone's type check run none of void-fbtee's
    code, so a file kept out of git wouldn't be there for them;
  - and a file outside `db/schema/` that imports `void/db` loops (#472 covers only files inside
    `db/schema/`).

  Better Auth's lives in `.void/`, rewritten by those same commands.

- **`void db generate` doesn't refresh it:** after upgrading void-fbtee, `vp dev` (or the build
  failing) is what brings the new table, not Void's commands.
- **Void doesn't wire the queue, the job and the middleware**, as it wires Better Auth's routes: the
  app holds those files, and the build checks them.

## As built (2026-11-19)

- `src/dev/gen.ts`: `keepTranslations(root, write)` (the kept files found by their first line,
  `// Kept by void-fbtee:`), `wiringProblems(root)`, `genTranslations`. `vp dev` keeps the tables as
  it starts and on each save in `db/schema/` (`src/dev/plugin.ts`); `check()` (so `vp build`)
  reports both without writing.
- Changing the list needs no rewrite: nothing else in the file names the fields (the `fields` type
  is built from the list), so the app's one-line change is the whole change.
- Kept files are compared by their code, not their layout (`sameCode`): an app formatted by
  Prettier with single quotes, no semicolons, no trailing commas or `t =>` arrows is still
  current, and `vp dev` doesn't rewrite it back after each format.
- A translations file without the first line (an app's own, or one from before) is left alone:
  `gen translations` says so ("delete it to have it kept").

## Checks

- Unit: the file's own table rewritten from its list; the list kept; a hand edit to the table
  undone in dev and failing the build; an older table (a column missing) brought up to date.
- `void db generate` in the example: "No schema changes" after the rewrite.
- `vp check`, `test:unit`, `test:dev`, `test:preview`, `test:fresh` (a fresh app: gen, then a
  build that passes; the queue file removed, the build fails naming it).
- README, SKILL.md, the example's docs page and the issue's "What we do meanwhile" updated.
