// A seat booked on an event. Made by `void gen model bookings …`; then: a UUID id, the link to its
// event, and an index for counting an event's bookings. Seats left = the event's seats minus its
// bookings: one source of truth, no counter to keep in step.
import { sql } from "void/db";
import { createInsertSchema } from "void/drizzle-zod";
import { index, sqliteTable, text } from "void/schema-d1";
import { Temporal } from "temporal-polyfill";
import { z } from "zod";
import { events } from "./events";

export const bookings = sqliteTable(
  "bookings",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    event_id: text("event_id")
      .notNull()
      .references(() => events.id),
    name: text("name").notNull(),
    email: text("email").notNull(),
    // The booker's language and time zone, for their confirmation and reminder.
    locale: text("locale").notNull(),
    time_zone: text("time_zone").notNull(),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => [index("bookings_event_id").on(t.event_id)],
);

/** The "book a seat" form. The page shows its own, translated, message for each field that fails. */
export const bookSchema = createInsertSchema(bookings, {
  name: (s) => s.trim().min(1).max(120),
  email: (s) => s.trim().pipe(z.email()),
  time_zone: (s) =>
    s.refine((zone) => {
      try {
        return Temporal.Now.zonedDateTimeISO(zone) !== undefined;
      } catch {
        return false;
      }
    }),
}).pick({ name: true, email: true, time_zone: true });
