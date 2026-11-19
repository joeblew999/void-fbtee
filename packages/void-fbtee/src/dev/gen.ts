// `void-fbtee gen translations <table> <field…>` (plans/types-from-schema.md): the app's files for
// translating what people write in one of its tables, written once, like `void gen model`, and the
// app's own from then on. Void finds tables, queues, jobs and middleware only by reading the app's
// folders, and types each from its file, so these are ordinary files at Void's places:
//
// - db/schema/<table>_translations.ts: plain Drizzle, its `fields` typed from the table's own
//   columns, and the list of them beside it (db/schema.ts, contentEntries, finds both);
// - src/content.ts: the app's schema and database handed to the package (content.ts);
// - queues/translate.ts, crons/translations.ts: the package's queue and daily job, with the app's
//   content;
// - middleware/99.i18n.ts: given the content, when it's still init's plain re-export.
//
// Never over a file that's there: what it can't write, it says.
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { MIDDLEWARE } from "./app-files";

const SCHEMA_INDEX = "db/schema.ts";
const MIDDLEWARE_FILE = "middleware/99.i18n.ts";

/** The file in db/schema/ that defines `table`, the name it exports it as, and its source. */
function sourceTable(
  root: string,
  table: string,
): { name: string; from: string; text: string } | undefined {
  const dir = join(root, "db/schema");
  if (!existsSync(dir)) return;
  const pattern = new RegExp(
    `export\\s+const\\s+(\\w+)\\s*=\\s*sqliteTable\\(\\s*["'\`]${table}["'\`]`,
  );
  for (const f of readdirSync(dir).filter((f) => /\.m?ts$/.test(f) && !f.endsWith(".d.ts"))) {
    const text = readFileSync(join(dir, f), "utf8");
    const found = pattern.exec(text);
    if (found) return { name: found[1]!, from: f.replace(/\.m?ts$/, ""), text };
  }
}

const schemaFile = (table: string, name: string, from: string, fields: string[]) => {
  const t = `${table}_translations`;
  return `// What people write in ${table} (${fields.join(", ")}), in the app's other languages, with who
// made each translation.
// Written by \`void-fbtee gen translations ${table} ${fields.join(" ")}\`: the app's own now.
// void-fbtee finds it by its name and the list of fields beside it (src/content.ts hands it the
// schema). Deleting a row of ${table} deletes its translations.
import { sql } from "void/db";
import { sqliteTable, text, uniqueIndex } from "void/schema-d1";
import { ${name} } from "./${from}";

/** The columns of ${table} that are translated. */
export const ${t}_fields = [${fields.map((f) => JSON.stringify(f)).join(", ")}] as const;

export const ${t} = sqliteTable(
  "${t}",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    source_id: text("source_id")
      .notNull()
      .references(() => ${name}.id, { onDelete: "cascade" }),
    locale: text("locale").notNull(),
    // The translated fields, as JSON, typed from ${table}'s own columns.
    fields: text("fields", { mode: "json" })
      .$type<Pick<typeof ${name}.$inferSelect, (typeof ${t}_fields)[number]>>()
      .notNull(),
    // Who made it, never empty: a model's id, "claude", a person, or "unknown" for code that didn't
    // say; "unknown" is translated again. "queued" while it's only asked for.
    translatedBy: text("translated_by").notNull().default("unknown"),
    translatedAt: text("translated_at"),
    // The AI Gateway log of the request that made it.
    gatewayLogId: text("gateway_log_id"),
    // What it cost: the request's tokens and the US$ they came to that day.
    usage: text("usage", { mode: "json" }).$type<{
      in: number;
      out: number;
      thinking: number;
      usd: number;
    }>(),
    // The fingerprint of the row's fields it was made from: once the row is changed it no longer
    // matches, and the row is translated again.
    translatedFrom: text("translated_from"),
    createdAt: text("created_at")
      .notNull()
      .default(sql\`(datetime('now'))\`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql\`(datetime('now'))\`),
  },
  (t) => [uniqueIndex("${t}_source_locale").on(t.source_id, t.locale)],
);
`;
};

const CONTENT = `// What people write in the app's tables, translated into its languages (void-fbtee/content): the
// schema and the database handed to the package once, so everything it gives is typed from them.
// Written by \`void-fbtee gen translations\`: the app's own now.
import * as schema from "@schema";
import { env } from "cloudflare:workers";
import { createDb } from "void/db";
import { translatedContent } from "void-fbtee/content";

/** A database session that starts on D1's main copy, so what it reads is never behind a write. */
const primaryDb = () => createDb(env.DB, { session: "first-primary" });

export const content = translatedContent(schema, primaryDb);
`;

const QUEUE = `// What people write, translated into the app's other languages by void-fbtee
// (void-fbtee/queues/translate). Void reads this file: its AI is connected because the app's own
// files import it, and the retries are read from here, as numbers.
import "void/ai";
import { translationQueue } from "void-fbtee/queues/translate";
import { content } from "../src/content";

export const maxRetries = 5;
export const retryDelay = 300;

export default translationQueue(content);
`;

const CRON = `// Once a day: what people write kept in the app's languages, both ways
// (void-fbtee/crons/translations). A backstop: a row read in a language it lacks is asked for then.
// Void reads the schedule from here; each job is a Cloudflare Cron Trigger.
import { translationsCron } from "void-fbtee/crons/translations";
import { content } from "../src/content";

export const cron = "17 4 * * *";
export default translationsCron(content);
`;

const MIDDLEWARE_WITH_CONTENT = `// Locale from the URL, fbtee's per-request state, <html lang dir>; and a page that showed what
// someone wrote, not yet in the reader's language, asks for its translation. 99 so Void runs it
// after the app's own middleware: it adds to the shared and head data they set.
import { i18nMiddleware } from "void-fbtee/middleware";
import { content } from "../src/content";

export default i18nMiddleware({ content });
`;

/** Writes the files for translating `fields` of `table`. What was written, and what's left to do. */
export function genTranslations(
  root: string,
  table: string,
  fields: string[],
): { done: string[]; todo: string[] } {
  const done: string[] = [];
  const todo: string[] = [];
  if (!fields.length)
    throw new Error("name the fields to translate: gen translations events title description");
  const source = sourceTable(root, table);
  if (!source)
    throw new Error(
      `no db/schema/ file exports sqliteTable("${table}", …): void-fbtee translates a table of the app's schema`,
    );
  for (const column of ["id", "locale", ...fields]) {
    const def = new RegExp(`\\b${column}\\s*:\\s*(\\w+)\\(`).exec(source.text);
    if (!def) throw new Error(`${table} has no "${column}" column`);
    if (def[1] !== "text") throw new Error(`${table}.${column} is ${def[1]}, not text`);
  }
  const write = (rel: string, text: string) => {
    const file = join(root, rel);
    if (existsSync(file)) return false;
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, text);
    done.push(`${rel}: written`);
    return true;
  };
  const t = `${table}_translations`;
  if (!write(`db/schema/${t}.ts`, schemaFile(table, source.name, source.from, fields)))
    todo.push(`db/schema/${t}.ts is there already: left as it is`);
  // Void's layout: the folder's files re-exported by db/schema.ts.
  const index = join(root, SCHEMA_INDEX);
  if (existsSync(index)) {
    const line = `export * from "./schema/${t}";`;
    const text = readFileSync(index, "utf8");
    if (!text.includes(line)) {
      writeFileSync(index, text.replace(/\n*$/, "\n") + line + "\n");
      done.push(`${SCHEMA_INDEX}: re-exports ${t}`);
    }
  }
  // Each file written, or else checked that it does what the written one would.
  const own = (rel: string, text: string, needs: string, what: string) => {
    if (write(rel, text)) return;
    if (!readFileSync(join(root, rel), "utf8").includes(needs))
      todo.push(`${rel} is the app's own: ${what}`);
  };
  own(
    "src/content.ts",
    CONTENT,
    "translatedContent(",
    'export const content = translatedContent(schema, primaryDb) from "void-fbtee/content"',
  );
  own(
    "queues/translate.ts",
    QUEUE,
    "translationQueue(content",
    'export default translationQueue(content) from "void-fbtee/queues/translate"',
  );
  own(
    "crons/translations.ts",
    CRON,
    "translationsCron(content",
    'export default translationsCron(content) from "void-fbtee/crons/translations"',
  );
  const middleware = join(root, MIDDLEWARE_FILE);
  if (!existsSync(middleware)) write(MIDDLEWARE_FILE, MIDDLEWARE_WITH_CONTENT);
  else if (readFileSync(middleware, "utf8") === MIDDLEWARE) {
    writeFileSync(middleware, MIDDLEWARE_WITH_CONTENT);
    done.push(`${MIDDLEWARE_FILE}: given the content`);
  } else if (!readFileSync(middleware, "utf8").includes("i18nMiddleware({ content")) {
    todo.push(
      `${MIDDLEWARE_FILE} is the app's own: export default i18nMiddleware({ content }) (from "void-fbtee/middleware" and "../src/content"), so a page asks for what it shows untranslated`,
    );
  }
  todo.push("then the table's migration: vp exec void db generate (in a terminal: it may ask)");
  return { done, todo };
}
