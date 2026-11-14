// A seat booked on an event. Made by `void gen model bookings …`; then: a UUID id, the link to its
// event, and an index for counting an event's bookings. Seats left = the event's seats minus its
// bookings: one source of truth, no counter to keep in step.
import { sql } from "void/db";
import { createInsertSchema } from "void/drizzle-zod";
import { index, integer, sqliteTable, text } from "void/schema-d1";
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
    // The site the booking was made on (dev, a Worker Preview, or live), for its reminder's link:
    // a cron has no request to take it from. Empty for bookings made before it was kept.
    origin: text("origin"),
    // Whether the booker asked for their PDF ticket again with the day-before reminder.
    ticket_in_reminder: integer("ticket_in_reminder", { mode: "boolean" }).notNull().default(false),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => [index("bookings_event_id").on(t.event_id)],
);

/**
 * The "book a seat" form. The page shows its own, translated, message for each field that fails.
 * The booking's id comes from the form, a random UUID the browser made: so the page knows the
 * booking's PDF ticket's address (/tickets/<id>) as soon as it's booked, and only it does. One
 * that's taken already fails to go in, like any id.
 */
export const bookSchema = createInsertSchema(bookings, {
  id: () => z.uuid(),
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
})
  .pick({ id: true, name: true, email: true, time_zone: true })
  // A checkbox: left out when it isn't ticked (a form posted without it, as the tests do).
  .extend({ ticket_in_reminder: z.boolean().optional() });
