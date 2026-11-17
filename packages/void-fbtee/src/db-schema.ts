// `void-fbtee/db/schema`: the table that holds translations of what people write in one of the app's
// tables (plans/translated-content.md). The app's schema has it in one line, at Void's own place:
//
//   // db/schema/events_translations.ts
//   import { translationsOf } from "void-fbtee/db/schema";
//   import { events } from "./events";
//   export const events_translations = translationsOf(events);
//
// One shape for every app, so the package's runtime (void-fbtee/queues/translate,
// void-fbtee/crons/translations, the read helpers in void-fbtee/content) reaches it by name: the
// source row's id, the language, the translated fields as JSON (which fields: voidFbtee({ content })),
// and who made it (plans/translation-provenance.md).
//
// Only void/schema-d1 and void/db (for `sql`), as an app's own schema files: `void db generate` (drizzle-kit) loads the schema with require(), and a
// module that also imports Void's main entry can't be loaded there (plans/translated-content.md).
import {
  getTableConfig,
  sqliteTable,
  text,
  uniqueIndex,
  type SQLiteColumn,
  type SQLiteTableWithColumns,
} from "void/schema-d1";
import { sql } from "void/db";

/** What `translated_by` holds when nothing says who made a translation. */
export const UNKNOWN = "unknown";

/** What `translated_by` holds while a translation is only asked for (content.ts translateSoon). */
export const QUEUED = "queued";

// The app's schema calls translationsOf() as it loads, and loading it can come in the middle of
// loading this module: void/db, imported here for `sql`, imports the app's schema, which imports
// this (Void's plugin wires void/db to the app's schema). So translationsOf() uses nothing of this
// module's but function declarations, which JavaScript has ready before any of the module runs,
// and literal values: a `const` here could still be unset then (seen in a production build,
// 2026-11-17: "translationsTableName is not a function").

/** The translations table's name for a table of content: `<table>_translations`. */
export function translationsTableName(table: string): string {
  return `${table}_translations`;
}

/**
 * The table of translations for one of the app's tables of content. Deleting a row deletes its
 * translations (the foreign key's `ON DELETE CASCADE`, which D1 enforces).
 */
export function translationsOf<
  T extends SQLiteTableWithColumns<{
    name: string;
    schema: undefined;
    dialect: "sqlite";
    columns: { id: SQLiteColumn };
  }>,
>(source: T) {
  const name = translationsTableName(getTableConfig(source).name);
  return sqliteTable(
    name,
    {
      id: text("id")
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),
      source_id: text("source_id")
        .notNull()
        .references(() => source.id, { onDelete: "cascade" }),
      locale: text("locale").notNull(),
      // The translated fields, as JSON: { "title": "…", "description": "…" }.
      fields: text("fields", { mode: "json" }).$type<Record<string, string>>().notNull(),
      // Who made it, never empty: a model's id, "claude", a person, or "unknown" for code that
      // didn't say (an older deploy after a rollback); "unknown" is translated again.
      translatedBy: text("translated_by").notNull().default("unknown"),
      translatedAt: text("translated_at"),
      // The AI Gateway log of the request that made it (its model, tokens, cost).
      gatewayLogId: text("gateway_log_id"),
      createdAt: text("created_at")
        .notNull()
        .default(sql`(datetime('now'))`),
      updatedAt: text("updated_at")
        .notNull()
        .default(sql`(datetime('now'))`),
    },
    (t) => [uniqueIndex(`${name}_source_locale`).on(t.source_id, t.locale)],
  );
}
