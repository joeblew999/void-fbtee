// An event's title and description in another language: the sample events' stored translations
// (db/migrations), and a new event's, from Workers AI on Cloudflare or Claude locally
// (src/events/translations.ts).
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
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => [uniqueIndex("event_texts_event_locale").on(t.event_id, t.locale)],
);
