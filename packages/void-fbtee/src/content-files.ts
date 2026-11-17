// The app's files for translating what people write (plans/translated-content.md), each a few
// lines at Void's own place: Void finds queues, jobs and tables only by reading the app's folders,
// and reads a queue's options and a job's schedule from the file itself. `vp dev` writes the ones
// missing (never over the app's own); `vp build` fails on what's still missing, saying what to do
// (check.ts).
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

const CRON = `// Once a day: what people write kept in the app's languages, both ways
// (void-fbtee/crons/translations). A backstop: a row read in a language it lacks is asked for then.
// Void reads the schedule from here; each job is a Cloudflare Cron Trigger (5 an account on the
// free plan).
export const cron = "17 4 * * *";
export { default } from "void-fbtee/crons/translations";
`;

const schema = (table: string, name: string, from: string) =>
  `// ${table}'s translations into the app's languages, with who made each: void-fbtee's table.
// Deleting a row of ${table} deletes its translations.
import { translationsOf } from "void-fbtee/db/schema";
import { ${name} } from "./${from}";

export const ${table}_translations = translationsOf(${name});
`;

/** Where the app's schema is a folder of files re-exported by db/schema.ts (Void's layout). */
const schemaFolder = (root: string) =>
  existsSync(join(root, SCHEMA_INDEX)) && existsSync(join(root, "db/schema"));

/** The file in db/schema/ that defines `table`, and the name it exports it as. */
function sourceTableFile(root: string, table: string): { name: string; from: string } | undefined {
  const dir = join(root, "db/schema");
  if (!existsSync(dir)) return;
  const pattern = new RegExp(
    `export\\s+const\\s+(\\w+)\\s*=\\s*sqliteTable\\(\\s*["'\`]${table}["'\`]`,
  );
  for (const f of readdirSync(dir).filter((f) => /\.m?ts$/.test(f) && !f.endsWith(".d.ts"))) {
    const found = pattern.exec(readFileSync(join(dir, f), "utf8"));
    if (found) return { name: found[1]!, from: f.replace(/\.m?ts$/, "") };
  }
}

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
  // A table's translations: only where the app's schema is Void's folder layout and the table is
  // defined in a file there; otherwise the build says what to add.
  if (schemaFolder(p.root)) {
    const index = join(p.root, SCHEMA_INDEX);
    for (const table of tables) {
      const source = sourceTableFile(p.root, table);
      if (!source) continue;
      write(schemaFile(table), schema(table, source.name, source.from));
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

/** The app's queues/translate.ts: void-fbtee's consumer. */
function hasQueue(root: string): boolean {
  return /["']void-fbtee\/queues\/translate["']/.test(read(root, QUEUE_FILE));
}

/** A job in crons/ that runs void-fbtee's. */
function hasCron(root: string): boolean {
  const dir = join(root, "crons");
  if (!existsSync(dir)) return false;
  // As Void lists a job folder's files (its listConventionFiles): .ts, .mts, .js, .mjs, none under
  // a name starting with "_".
  return readdirSync(dir, { recursive: true, encoding: "utf8" })
    .filter((f) => /\.m?[jt]s$/.test(f) && !f.endsWith(".d.ts") && !/(^|\/)_/.test(f))
    .some((f) => /["']void-fbtee\/crons\/translations["']/.test(read(root, join("crons", f))));
}

/** Each table of the app's latest migration snapshot (drizzle's, db/migrations/meta/), with its columns' types. */
function snapshotTables(root: string): Map<string, Map<string, string>> | undefined {
  const meta = join(root, "db/migrations/meta");
  const journal = read(root, "db/migrations/meta/_journal.json");
  if (!journal) return;
  const last = (JSON.parse(journal) as { entries: { tag: string }[] }).entries.at(-1);
  const prefix = last?.tag.split("_")[0];
  const file =
    prefix && readdirSync(meta).find((f) => f.startsWith(prefix) && f.endsWith("_snapshot.json"));
  if (!file) return;
  const snap = JSON.parse(readFileSync(join(meta, file), "utf8")) as {
    tables: Record<string, { name: string; columns: Record<string, { type?: string }> }>;
  };
  return new Map(
    Object.values(snap.tables).map((t) => [
      t.name,
      new Map(Object.entries(t.columns).map(([k, c]) => [k, String(c.type ?? "")])),
    ]),
  );
}

/** What's missing for voidFbtee({ content }), one line each, saying what to do. */
export function contentProblems(p: Project): string[] {
  const content = p.content ?? {};
  const tables = Object.keys(content);
  if (!tables.length) return [];
  const problems: string[] = [];
  if (!hasQueue(p.root))
    problems.push(
      `content: no ${QUEUE_FILE} with void-fbtee's queue: run vp dev, which writes it, or write it: import "void/ai"; import "void/db"; export const maxRetries = 5; export const retryDelay = 300; export { default } from "void-fbtee/queues/translate";`,
    );
  else if (!/["']void\/ai["']/.test(read(p.root, QUEUE_FILE)))
    problems.push(
      `content: ${QUEUE_FILE} doesn't import "void/ai", so Void doesn't connect its AI: add import "void/ai";`,
    );
  if (!hasCron(p.root))
    problems.push(
      `content: no job in crons/ runs void-fbtee's: run vp dev, which writes ${CRON_FILE}, or write it: export const cron = "17 4 * * *"; export { default } from "void-fbtee/crons/translations";`,
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
    for (const column of ["id", "locale", ...content[table]!.fields]) {
      const type = columns?.get(column);
      if (columns && type === undefined)
        problems.push(
          `content: ${table} has no "${column}" column, which voidFbtee({ content }) needs`,
        );
      else if (type !== undefined && type.toLowerCase() !== "text")
        problems.push(
          `content: ${table}.${column} is ${type}, not text, which voidFbtee({ content }) needs`,
        );
    }
    if (!snapshot?.has(t))
      problems.push(
        `content: ${t} has no migration: add it to the schema (${schemaFile(table)}: export const ${t} = translationsOf(${table}) from "void-fbtee/db/schema", re-exported from ${SCHEMA_INDEX}), then run vp exec void db generate in a terminal (it may ask whether ${t} is a new table; without a terminal it writes nothing and still says it's done)`,
      );
  }
  return problems;
}
