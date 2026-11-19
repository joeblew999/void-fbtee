// The translations tables as the package's queries see them (plans/types-from-schema.md). The app
// owns them: `void-fbtee gen translations <table> <field…>` writes each, once, as plain Drizzle in
// the app's db/schema/ (dev/gen.ts), and the app's code hands its schema over
// (`translatedContent(schema, …)`, content.ts). Nothing here is a table of the app's.
//
// What's here: the values `translated_by` holds besides a maker's name, the shape every
// translations table has (the columns the queries use, by their names in the app's Drizzle
// table), and finding the app's content tables in its schema by that shape.
import { sql } from "void/db";
import { getTableConfig, sqliteTable, text, type SQLiteTable } from "void/schema-d1";

/** What `translated_by` holds when nothing says who made a translation. */
export const UNKNOWN = "unknown";

/** What `translated_by` holds while a translation is only asked for (content.ts translateSoon). */
export const QUEUED = "queued";

/**
 * The columns every translations table has, as the queries use them. Only for typing the queries:
 * each runs on the app's own table, which the generator writes with these columns (dev/gen.ts).
 */
const shape = sqliteTable("translations", {
  id: text("id").primaryKey(),
  source_id: text("source_id").notNull(),
  locale: text("locale").notNull(),
  fields: text("fields", { mode: "json" }).$type<Record<string, string>>().notNull(),
  translatedBy: text("translated_by").notNull().default("unknown"),
  translatedAt: text("translated_at"),
  gatewayLogId: text("gateway_log_id"),
  usage: text("usage", { mode: "json" }).$type<{
    in: number;
    out: number;
    thinking: number;
    usd: number;
  }>(),
  translatedFrom: text("translated_from"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

/** A translations table, as the queries type it. */
export type TranslationsTable = typeof shape;

/** A table of content, as the queries need it: its id and the language a row was written in. */
export type SourceTable = SQLiteTable & {
  id: TranslationsTable["id"];
  locale: TranslationsTable["locale"];
};

/** One table of content the app translates, found in its schema. */
export interface ContentEntry {
  /** Its name in the database, which the queue's messages carry: "events". */
  name: string;
  source: SourceTable;
  translations: TranslationsTable;
  /** The fields translated, in the order the app's schema lists them. */
  fields: readonly string[];
}

const DRIZZLE_TABLE = Symbol.for("drizzle:IsDrizzleTable");
const isTable = (value: unknown): value is SQLiteTable =>
  typeof value === "object" && value !== null && DRIZZLE_TABLE in value;

/** The keys every translations table has (the shape's), and a table of content's. */
const TRANSLATION_KEYS = Object.keys(shape) as (keyof TranslationsTable)[];

/**
 * The app's tables of content, from its schema (`import * as schema from "@schema"`): each
 * `<table>_translations` with the shape's columns, beside its `<export>_fields` list (both written
 * by the generator), and the table it translates. Anything that doesn't add up stops with an error
 * naming it, rather than leaving a table untranslated.
 */
export function contentEntries(schema: Record<string, unknown>): Map<string, ContentEntry> {
  const tables = new Map<string, SQLiteTable>();
  for (const value of Object.values(schema))
    if (isTable(value)) tables.set(getTableConfig(value).name, value);
  const found = new Map<string, ContentEntry>();
  for (const [key, value] of Object.entries(schema)) {
    if (!isTable(value)) continue;
    const tableName = getTableConfig(value).name;
    const name = /^(.+)_translations$/.exec(tableName)?.[1];
    if (!name) continue;
    const missing = TRANSLATION_KEYS.filter((k) => !(k in value));
    if (missing.length)
      throw new Error(
        `void-fbtee: ${tableName} lacks ${missing.join(", ")} (\`void-fbtee gen translations\` writes it).`,
      );
    const source = tables.get(name);
    if (!source || !("id" in source) || !("locale" in source))
      throw new Error(
        `void-fbtee: ${tableName} translates "${name}", which isn't a table in the schema with \`id\` and \`locale\`.`,
      );
    const fields = schema[`${key}_fields`];
    if (!Array.isArray(fields) || !fields.length || fields.some((f) => !(f in source)))
      throw new Error(
        `void-fbtee: ${tableName} needs \`${key}_fields\` exported beside it: the ${name} columns it translates.`,
      );
    found.set(name, {
      name,
      source: source as SourceTable,
      translations: value as unknown as TranslationsTable,
      fields: fields as string[],
    });
  }
  return found;
}
