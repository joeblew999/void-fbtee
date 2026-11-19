// The app's files for translating what people write in one of its tables
// (plans/types-from-schema.md, plans/like-better-auth.md). Void finds tables, queues, jobs and
// middleware only by reading the app's folders, and types each from its file, so these are ordinary
// files at Void's places:
//
// - db/schema/<table>_translations.ts: kept by void-fbtee, as Void keeps Better Auth's tables. The
//   app's part is its one list of fields; the rest is the package's translations table, which
//   `vp dev` rewrites whenever it isn't what the package writes for that list (keepTranslations),
//   and `vp build` refuses (check.ts). Its `fields` are typed from the table's own columns, through
//   the list, so a column the table hasn't fails to compile.
// - src/content.ts, queues/translate.ts, crons/translations.ts, middleware/99.i18n.ts: the app's,
//   as `auth.ts` is (they hold its own hooks): `void-fbtee gen translations` writes them once, and
//   `vp build` fails while one is missing or not wired to the content (wiringProblems).
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { group } from "../guards";
import { MIDDLEWARE } from "./app-files";

const SCHEMA_INDEX = "db/schema.ts";
const MIDDLEWARE_FILE = "middleware/99.i18n.ts";

/** The file in db/schema/ that defines `table`, the name it exports it as, and its source. */
function sourceTable(
  root: string,
  table: string,
): { name: string; from: string; text: string } | undefined {
  const dir = join(root, "db/schema");
  if (!existsSync(dir)) {
    return;
  }
  const pattern = new RegExp(
    `export\\s+const\\s+(\\w+)\\s*=\\s*sqliteTable\\(\\s*["'\`]${table}["'\`]`,
  );
  for (const f of readdirSync(dir).filter((f) => /\.m?ts$/.test(f) && !f.endsWith(".d.ts"))) {
    const text = readFileSync(join(dir, f), "utf8");
    const found = pattern.exec(text);
    if (found) {
      return { name: group(found, 1), from: f.replace(/\.m?ts$/, ""), text };
    }
  }
}

/** The first line of a translations table void-fbtee keeps: how it knows the file is its own. */
export const KEPT = "// Kept by void-fbtee:";

/** The columns of `table` the list names that aren't there, or aren't text; and `id`, `locale`. */
function columnProblems(source: { text: string }, table: string, fields: ReadonlyArray<string>) {
  const problems: Array<string> = [];
  for (const column of ["id", "locale", ...fields]) {
    const def = new RegExp(`\\b${column}\\s*:\\s*(\\w+)\\(`).exec(source.text);
    if (!def) {
      problems.push(`${table} has no "${column}" column`);
    } else if (def[1] !== "text") {
      problems.push(`${table}.${column} is ${def[1]}, not text`);
    }
  }
  return problems;
}

const schemaFile = (table: string, name: string, from: string, fields: ReadonlyArray<string>) => {
  const t = `${table}_translations`;
  return `${KEPT} the list of fields is the app's; the rest is void-fbtee's translations table,
// rewritten by \`vp dev\` to the one the package writes for that list, as Void keeps Better Auth's
// tables (plans/like-better-auth.md in void-fbtee). To translate other columns of ${table}, change
// the list; \`vp build\` fails while the rest isn't what void-fbtee writes. Deleting a row of
// ${table} deletes its translations.
import { sql } from "void/db";
import { sqliteTable, text, uniqueIndex } from "void/schema-d1";
import { ${name} } from "./${from}";

/** The columns of ${table} that are translated: the app's to change. */
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
import { queues } from "void/queues";
import { translatedContent, type TranslateQueue } from "void-fbtee/content";

/** A database session that starts on D1's main copy, so what it reads is never behind a write. */
const primaryDb = () => createDb(env.DB, { session: "first-primary" });

export const content = translatedContent(schema, {
  db: primaryDb,
  // Typed by Void from queues/translate.ts. Annotated: that file uses \`content\`, so without it the
  // two types would depend on each other.
  queue: (): TranslateQueue => queues.translate,
});
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

/**
 * The same code, whatever the app's formatter made of its layout: whitespace, quote marks,
 * semicolons, trailing commas and a lone arrow parameter's brackets aside. So an app's own
 * formatter (Prettier with single quotes, no semicolons) never makes a kept file "out of date", nor `vp dev` rewrite it back after each format.
 */
export const sameCode = (a: string, b: string) => {
  const plain = (code: string) =>
    code
      .replace(/['`]/g, '"')
      .replace(/[;\s]/g, "")
      .replace(/,([)\]}])/g, "$1")
      .replace(/\((\w+)\)=>/g, "$1=>");
  return plain(a) === plain(b);
};

/** The app's list of fields in a kept translations file, and the table it translates. */
function parseKept(text: string): { table: string; fields: Array<string> } | undefined {
  if (!text.startsWith(KEPT)) {
    return;
  }
  const found = /export\s+const\s+(\w+)_translations_fields\s*=\s*\[([^\]]*)\]\s*as\s+const/.exec(
    text,
  );
  if (!found) {
    return;
  }
  return {
    table: group(found, 1),
    fields: [...group(found, 2).matchAll(/["'`]([^"'`]+)["'`]/g)].map((m) => group(m, 1)),
  };
}

/** The translations files void-fbtee keeps in the app's db/schema/, by their first line. */
function keptFiles(root: string): Array<string> {
  const dir = join(root, "db/schema");
  if (!existsSync(dir)) {
    return [];
  }
  return readdirSync(dir)
    .filter((f) => /\.m?ts$/.test(f) && !f.endsWith(".d.ts"))
    .map((f) => `db/schema/${f}`)
    .filter((rel) => readFileSync(join(root, rel), "utf8").startsWith(KEPT));
}

/**
 * Each translations file void-fbtee keeps, made what the package writes for its list of fields
 * (the rest of the file is the package's): rewritten where it differs when `write` (`vp dev`), else
 * named as out of date (`vp build`, which never writes). As Void rewrites its Better Auth tables
 * only when they change. A list or table that can't be kept is a problem either way.
 */
export function keepTranslations(
  root: string,
  write: boolean,
): { rewritten: Array<string>; problems: Array<string> } {
  const rewritten: Array<string> = [];
  const problems: Array<string> = [];
  for (const rel of keptFiles(root)) {
    const text = readFileSync(join(root, rel), "utf8");
    const kept = parseKept(text);
    if (!kept || !kept.fields.length) {
      problems.push(
        `content: ${rel} has no list of fields void-fbtee can read: export const <table>_translations_fields = ["title", …] as const;`,
      );
      continue;
    }
    const source = sourceTable(root, kept.table);
    if (!source) {
      problems.push(
        `content: ${rel} translates "${kept.table}", which no db/schema/ file defines with sqliteTable("${kept.table}", …)`,
      );
      continue;
    }
    const wrong = columnProblems(source, kept.table, kept.fields);
    if (wrong.length) {
      problems.push(...wrong.map((w) => `content: ${rel}: ${w}`));
      continue;
    }
    const wanted = schemaFile(kept.table, source.name, source.from, kept.fields);
    if (sameCode(text, wanted)) {
      continue;
    }
    if (write) {
      writeFileSync(join(root, rel), wanted);
      rewritten.push(rel);
    } else {
      problems.push(
        `content: ${rel} isn't void-fbtee's current translations table: vp dev rewrites it (then vp exec void db generate if its columns changed)`,
      );
    }
  }
  return { rewritten, problems };
}

const read = (root: string, rel: string) => {
  const file = join(root, rel);
  return existsSync(file) ? readFileSync(file, "utf8") : "";
};

/** Whether a file in `dir` (Void's convention files: .ts, .mts, .js, .mjs, none starting "_") has `needs`. */
const anyFileHas = (root: string, dir: string, needs: string) =>
  existsSync(join(root, dir)) &&
  readdirSync(join(root, dir), { recursive: true, encoding: "utf8" })
    .filter((f) => /\.m?[jt]s$/.test(f) && !f.endsWith(".d.ts") && !/(^|\/)_/.test(f))
    .some((f) => read(root, join(dir, f)).includes(needs));

/**
 * What the app's own files lack for the tables void-fbtee keeps, one line each, saying what to
 * add: the content (src/content.ts), its queue with Void's AI, its daily job and the middleware
 * given it. None when the app translates no table.
 */
export function wiringProblems(root: string): Array<string> {
  if (!keptFiles(root).length) {
    return [];
  }
  const problems: Array<string> = [];
  if (!read(root, "src/content.ts").includes("translatedContent(")) {
    problems.push(
      `content: src/content.ts doesn't hand void-fbtee the schema: export const content = translatedContent(schema, { db, queue }) from "void-fbtee/content"`,
    );
  }
  const queue = read(root, "queues/translate.ts");
  if (!queue.includes("translationQueue(content")) {
    problems.push(
      `content: queues/translate.ts doesn't run void-fbtee's queue: export default translationQueue(content) from "void-fbtee/queues/translate"`,
    );
  } else if (!/["']void\/ai["']/.test(queue)) {
    problems.push(
      `content: queues/translate.ts doesn't import "void/ai", so Void doesn't connect its AI: add import "void/ai";`,
    );
  }
  if (!anyFileHas(root, "crons", "translationsCron(content")) {
    problems.push(
      `content: no job in crons/ runs void-fbtee's: crons/translations.ts, export const cron = "17 4 * * *"; export default translationsCron(content) from "void-fbtee/crons/translations"`,
    );
  }
  if (!anyFileHas(root, "middleware", "i18nMiddleware({ content")) {
    problems.push(
      `content: the middleware isn't given the content, so a page doesn't ask for what it shows untranslated: export default i18nMiddleware({ content }) from "void-fbtee/middleware"`,
    );
  }
  return problems;
}

/**
 * `void-fbtee gen translations <table> <field…>`: the kept translations file for `fields` of
 * `table` (written, or its list set to these), re-exported from db/schema.ts; and the app's own
 * files where they're missing (never over one that's there). What was written, and what's left.
 */
export function genTranslations(
  root: string,
  table: string,
  fields: Array<string>,
): { done: Array<string>; todo: Array<string> } {
  const done: Array<string> = [];
  const todo: Array<string> = [];
  if (!fields.length) {
    throw new Error("name the fields to translate: gen translations events title description");
  }
  const source = sourceTable(root, table);
  if (!source) {
    throw new Error(
      `no db/schema/ file exports sqliteTable("${table}", …): void-fbtee translates a table of the app's schema`,
    );
  }
  const wrong = columnProblems(source, table, fields);
  if (wrong.length) {
    throw new Error(wrong.join("; "));
  }
  const write = (rel: string, text: string) => {
    const file = join(root, rel);
    if (existsSync(file)) {
      return false;
    }
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, text);
    done.push(`${rel}: written`);
    return true;
  };
  const t = `${table}_translations`;
  const rel = `db/schema/${t}.ts`;
  const wanted = schemaFile(table, source.name, source.from, fields);
  if (!write(rel, wanted)) {
    const there = read(root, rel);
    if (!there.startsWith(KEPT)) {
      todo.push(
        `${rel} is the app's own, not kept by void-fbtee: left as it is (delete it to have it kept)`,
      );
    } else if (!sameCode(there, wanted)) {
      writeFileSync(join(root, rel), wanted);
      done.push(`${rel}: rewritten for ${fields.join(", ")}`);
    }
  }
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
  write("src/content.ts", CONTENT);
  write("queues/translate.ts", QUEUE);
  write("crons/translations.ts", CRON);
  const middleware = join(root, MIDDLEWARE_FILE);
  if (!existsSync(middleware)) {
    write(MIDDLEWARE_FILE, MIDDLEWARE_WITH_CONTENT);
  } else if (readFileSync(middleware, "utf8") === MIDDLEWARE) {
    writeFileSync(middleware, MIDDLEWARE_WITH_CONTENT);
    done.push(`${MIDDLEWARE_FILE}: given the content`);
  }
  // What the app's own files still lack, as the build will say it.
  todo.push(...wiringProblems(root).map((p) => p.replace(/^content: /, "")));
  todo.push("then the table's migration: vp exec void db generate (in a terminal: it may ask)");
  return { done, todo };
}
