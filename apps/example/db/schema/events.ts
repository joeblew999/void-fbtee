// Events people post and book seats on. Made by `void gen model events …`; then: a UUID id, and
// the start stored the way an event happens: on the clock where it takes place.
import { sql } from "void/db";
import { createInsertSchema } from "void/drizzle-zod";
import { integer, sqliteTable, text } from "void/schema-d1";
import { Temporal } from "temporal-polyfill";
import { z } from "zod";

export const events = sqliteTable("events", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  title: text("title").notNull(),
  description: text("description").notNull(),
  // Temporal's text form of the start where the event is, e.g.
  // "2026-12-01T19:00:00+07:00[Asia/Bangkok]" (RFC 9557): Temporal.ZonedDateTime.from() reads it.
  starts_at: text("starts_at").notNull(),
  // The same moment in UTC ("…Z"), for sorting and for "upcoming".
  starts_at_utc: text("starts_at_utc").notNull(),
  seats: integer("seats").notNull(),
  // Where it happens, in the organiser's words ("Riverside Park, by the bandstand"); optional.
  venue: text("venue"),
  // The language the organiser wrote the title and description in.
  locale: text("locale").notNull(),
  // The SHA-256 (hex) of the key in the poster's private delete link, never the key itself
  // (src/events/delete-key.ts). None on the sample events, so nobody can delete them.
  delete_key_hash: text("delete_key_hash"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

/** Whether `zone` is a time zone Temporal knows (an IANA name such as "Asia/Bangkok"). */
export const isZone = (zone: string) => {
  try {
    return Temporal.Now.zonedDateTimeISO(zone) !== undefined;
  } catch {
    return false;
  }
};
const isLocalTime = (text: string) => {
  try {
    return Temporal.PlainDateTime.from(text) !== undefined;
  } catch {
    return false;
  }
};

/**
 * The "post an event" form: the event's fields, its start as the organiser's clock shows it
 * where the event is (a datetime-local value, "2026-12-01T19:00"), and that place's time zone.
 * The page shows its own, translated, message for each field that fails.
 */
export const newEventSchema = createInsertSchema(events, {
  title: (s) => s.trim().min(1).max(120),
  description: (s) => s.trim().min(1).max(2000),
  seats: (s) => s.int().min(1).max(10_000),
  venue: (s) => s.trim().max(200),
})
  .pick({ title: true, description: true, seats: true, venue: true })
  .extend({
    local: z.string().refine(isLocalTime),
    time_zone: z.string().refine(isZone),
    // Optional: where to email the poster's private link. Only used to send it, never stored.
    email: z
      .string()
      .trim()
      .pipe(z.union([z.literal(""), z.email()]))
      .optional(),
  });

/** The row for a new event: its start in its own zone, and the same moment in UTC. */
export function startsAt(local: string, timeZone: string) {
  const start = Temporal.PlainDateTime.from(local).toZonedDateTime(timeZone);
  return { starts_at: start.toString(), starts_at_utc: start.toInstant().toString() };
}
