// What people write in events (title, description), in the app's other languages, with who
// made each translation.
// Written by `void-fbtee gen translations events title description`: the app's own now.
// void-fbtee finds it by its name and the list of fields beside it (src/content.ts hands it the
// schema). Deleting a row of events deletes its translations.
import { sql } from "void/db";
import { sqliteTable, text, uniqueIndex } from "void/schema-d1";
import { events } from "./events";

/** The columns of events that are translated. */
export const events_translations_fields = ["title", "description"] as const;

export const events_translations = sqliteTable(
  "events_translations",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    source_id: text("source_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    locale: text("locale").notNull(),
    // The translated fields, as JSON, typed from events's own columns.
    fields: text("fields", { mode: "json" })
      .$type<Pick<typeof events.$inferSelect, (typeof events_translations_fields)[number]>>()
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
      .default(sql`(datetime('now'))`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => [uniqueIndex("events_translations_source_locale").on(t.source_id, t.locale)],
);
