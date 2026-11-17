// The app's files for translating what people write (plans/translated-content.md), each a few
// lines at Void's own place: Void finds queues, jobs and tables only by reading the app's folders,
// and reads a queue's options and a job's schedule from the file itself. `vp dev` and
// `void-fbtee init` write the ones missing (never over the app's own); `vp build` fails on what's
// still missing, saying what to do (check.ts).
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Project } from "./catalogs";

export const QUEUE_FILE = "queues/translate.ts";
export const CRON_FILE = "crons/translations.ts";
const SCHEMA_INDEX = "db/schema.ts";
const schemaFile = (table: string) => `db/schema/${table}_translations.ts`;

const QUEUE = `// What people write, translated into the app's other languages by void-fbtee
// (void-fbtee/queues/translate). Void reads this file: its AI and database are connected because the
// app's own files import them, and the retries are read from here, as numbers.
import "void/ai";
import "void/db";

export const maxRetries = 5;
export const retryDelay = 300;

export { default } from "void-fbtee/queues/translate";
`;

const CRON = `// Every hour: what people write kept in the app's languages, both ways
// (void-fbtee/crons/translations). Void reads the schedule from here.
export const cron = "17 * * * *";
export { default } from "void-fbtee/crons/translations";
`;

const schema = (
  table: string,
) => `// ${table}'s translations into the app's languages, with who made each: void-fbtee's table.
// Deleting a row of ${table} deletes its translations.
import { translationsOf } from "void-fbtee/db/schema";
import { ${table} } from "./${table}";

export const ${table}_translations = translationsOf(${table});
`;

/** Where the app's schema is a folder of files re-exported by db/schema.ts (Void's layout). */
const schemaFolder = (root: string) =>
  existsSync(join(root, SCHEMA_INDEX)) && existsSync(join(root, "db/schema"));

/**
 * Writes the app's files that are missing, for voidFbtee({ content }): the queue, the job, and each
 * table's translations table (re-exported from db/schema.ts). Never over a file that's there.
 * Returns the files written.
 */
export function writeContentFiles(p: Project): string[] {
  const tables = Object.keys(p.content ?? {});
  if (!tables.length) return [];
  const written: string[] = [];
  const write = (rel: string, text: string) => {
    const file = join(p.root, rel);
    if (existsSync(file)) return;
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, text);
    written.push(rel);
  };
  if (!hasQueue(p.root)) write(QUEUE_FILE, QUEUE);
  if (!hasCron(p.root)) write(CRON_FILE, CRON);
  // A table's translations: only where the app's schema is Void's folder layout and the table has
  // its own file there (db/schema/<table>.ts); otherwise the build says what to add.
  if (schemaFolder(p.root)) {
    const index = join(p.root, SCHEMA_INDEX);
    for (const table of tables) {
      if (!existsSync(join(p.root, `db/schema/${table}.ts`))) continue;
      write(schemaFile(table), schema(table));
      const line = `export * from "./schema/${table}_translations";`;
      const text = readFileSync(index, "utf8");
      if (!text.includes(line)) {
        writeFileSync(index, text.replace(/\n*$/, "\n") + line + "\n");
        written.push(SCHEMA_INDEX);
      }
    }
  }
  return written;
}

const read = (root: string, rel: string) => {
  const file = join(root, rel);
  return existsSync(file) ? readFileSync(file, "utf8") : "";
};

/** The app's queues/translate.ts: void-fbtee's consumer, with void/ai imported. */
function hasQueue(root: string): boolean {
  return /["']void-fbtee\/queues\/translate["']/.test(read(root, QUEUE_FILE));
}

/** A job in crons/ that runs void-fbtee's. */
function hasCron(root: string): boolean {
  const dir = join(root, "crons");
  if (!existsSync(dir)) return false;
  return readdirSync(dir, { recursive: true, encoding: "utf8" })
    .filter((f) => /\.[cm]?[jt]s$/.test(f))
    .some((f) => /["']void-fbtee\/crons\/translations["']/.test(read(root, join("crons", f))));
}

/** The tables of the app's latest migration snapshot (drizzle's own, db/migrations/meta/). */
function snapshotTables(root: string): Map<string, Set<string>> | undefined {
  const meta = join(root, "db/migrations/meta");
  const journal = read(root, "db/migrations/meta/_journal.json");
  if (!journal) return;
  const last = (JSON.parse(journal) as { entries: { tag: string }[] }).entries.at(-1);
  const prefix = last?.tag.split("_")[0];
  const file =
    prefix && readdirSync(meta).find((f) => f.startsWith(prefix) && f.endsWith("_snapshot.json"));
  if (!file) return;
  const snap = JSON.parse(readFileSync(join(meta, file), "utf8")) as {
    tables: Record<string, { name: string; columns: Record<string, unknown> }>;
  };
  return new Map(Object.values(snap.tables).map((t) => [t.name, new Set(Object.keys(t.columns))]));
}

/** What's missing for voidFbtee({ content }), one line each, saying what to do. */
export function contentProblems(p: Project): string[] {
  const content = p.content ?? {};
  const tables = Object.keys(content);
  if (!tables.length) return [];
  const problems: string[] = [];
  if (!hasQueue(p.root))
    problems.push(
      `content: no ${QUEUE_FILE} with void-fbtee's queue: run vp dev, which writes it, or write it: import "void/ai"; export const maxRetries = 5; export const retryDelay = 300; export { default } from "void-fbtee/queues/translate";`,
    );
  else if (!/["']void\/ai["']/.test(read(p.root, QUEUE_FILE)))
    problems.push(
      `content: ${QUEUE_FILE} doesn't import "void/ai", so Void doesn't connect its AI: add import "void/ai";`,
    );
  if (!hasCron(p.root))
    problems.push(
      `content: no job in crons/ runs void-fbtee's: run vp dev, which writes ${CRON_FILE}, or write it: export const cron = "17 * * * *"; export { default } from "void-fbtee/crons/translations";`,
    );
  const snapshot = snapshotTables(p.root);
  for (const table of tables) {
    const t = `${table}_translations`;
    const columns = snapshot?.get(table);
    if (snapshot && !columns) {
      problems.push(
        `content: voidFbtee({ content }) names "${table}", which isn't a table in the app's schema`,
      );
      continue;
    }
    for (const column of ["id", "locale", ...content[table]!.fields])
      if (columns && !columns.has(column))
        problems.push(
          `content: ${table} has no "${column}" column, which voidFbtee({ content }) needs`,
        );
    if (!snapshot?.has(t))
      problems.push(
        `content: ${t} has no migration: add it to the schema (${schemaFile(table)}: export const ${t} = translationsOf(${table}) from "void-fbtee/db/schema", re-exported from ${SCHEMA_INDEX}), then run vp exec void db generate in a terminal (it asks whether ${t} is a new table; without a terminal it writes nothing and still says it's done)`,
      );
  }
  return problems;
}
