// An event's title and description in another language: the sample events' stored translations
// (db/migrations), and a new event's, from Void's AI (src/events/translations.ts).
// Made by `void gen model event_texts …`; then: a UUID id, the link to its event, and one row per
// event and language. The event row keeps the original, in the language it was written in.
import { sql } from "void/db";
import { sqliteTable, text, uniqueIndex } from "void/schema-d1";
import { events } from "./events";

export const event_texts = sqliteTable(
  "event_texts",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    event_id: text("event_id")
      .notNull()
      .references(() => events.id),
    locale: text("locale").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    // Who translated it, never empty (plans/translation-provenance.md): the model's id (models.ts),
    // "claude" (the sample events' own, from their migration), or "unknown" when nothing says (rows
    // from before this was recorded, or written by code that doesn't say: an older deploy after a
    // rollback). The app translates an "unknown" one again (src/events/translations.ts).
    translatedBy: text("translated_by").notNull().default("unknown"),
    // When, YYYY-MM-DD.
    translatedAt: text("translated_at"),
    // The AI Gateway log of the request that made it: the exact request, answer and cost, in the
    // account's gateway logs. Empty when no AI made it.
    gatewayLogId: text("gateway_log_id"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => [uniqueIndex("event_texts_event_locale").on(t.event_id, t.locale)],
);
