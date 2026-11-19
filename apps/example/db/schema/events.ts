// Events people post and book seats on. Made by `void gen model events …`; then: a UUID id, and
// the start and end stored the way an event happens: on the clock where it takes place.
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
  // When it ends, the same way, on the same clock (an event happens in one place); after the start.
  // Required: the forms ask for it (newEventSchema, changeEventSchema). The empty default is only
  // so the columns could be added to the rows already stored, which their migration then fills
  // (db/migrations, "ends"): D1 can't add a NOT NULL column without one.
  ends_at: text("ends_at").notNull().default(""),
  ends_at_utc: text("ends_at_utc").notNull().default(""),
  seats: integer("seats").notNull(),
  // Where it happens, in the organiser's words ("Riverside Park, by the bandstand"); optional.
  venue: text("venue"),
  // The language the organiser wrote the title and description in.
  locale: text("locale").notNull(),
  // The SHA-256 (hex) of the key in the poster's private delete link, never the key itself
  // (src/events/delete-key.ts). None on the sample events, so nobody can delete them.
  delete_key_hash: text("delete_key_hash"),
  // When its organiser deleted it (plans/reliable-work.md). From then its pages say it's cancelled
  // and it can't be booked, changed or listed; it stays until every booker's cancellation email has
  // gone (queues/cancel.ts deletes each booking after its email, and the event with its last), so
  // the database itself says who still needs telling. Null while it's on.
  cancelled_at: text("cancelled_at"),
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

/** The fields an event's organiser fills in, posting it or changing it. */
const eventFields = createInsertSchema(events, {
  title: (s) => s.trim().min(1).max(120),
  description: (s) => s.trim().min(1).max(2000),
  seats: (s) => s.int().min(1).max(10_000),
  venue: (s) => s.trim().max(200),
})
  .pick({ title: true, description: true, seats: true, venue: true })
  .extend({
    // When it starts and ends, as the organiser's clock shows them where the event is
    // (datetime-local values, "2026-12-01T19:00"), and that place's time zone.
    local: z.string().refine(isLocalTime),
    local_end: z.string().refine(isLocalTime),
    time_zone: z.string().refine(isZone),
  });

/** The end comes after the start: told on the end's field. */
const endsAfterStart = (
  f: { local: string; local_end: string },
  ctx: { addIssue: (issue: { code: "custom"; path: Array<string>; message: string }) => void },
) => {
  if (!isLocalTime(f.local) || !isLocalTime(f.local_end)) {
    return;
  }
  if (Temporal.PlainDateTime.compare(f.local_end, f.local) <= 0) {
    ctx.addIssue({ code: "custom", path: ["local_end"], message: "ends before it starts" });
  }
};

/**
 * The "post an event" form: the event's fields, and where to email the poster's private link.
 * The page shows its own, translated, message for each field that fails.
 */
export const newEventSchema = eventFields
  .extend({
    // Optional: where to email the poster's private link. Only used to send it, never stored.
    email: z
      .string()
      .trim()
      .pipe(z.union([z.literal(""), z.email()]))
      .optional(),
  })
  .superRefine(endsAfterStart);

/**
 * The "change your event" form: the same fields, and the key from the poster's private link
 * (src/events/delete-key.ts), which only the poster has.
 */
export const changeEventSchema = eventFields
  .extend({ key: z.string().min(1) })
  .superRefine(endsAfterStart);

/**
 * The row's start and end: each on the event's own clock, in its zone, and the same moment in UTC.
 */
export function when(local: string, localEnd: string, timeZone: string) {
  const start = Temporal.PlainDateTime.from(local).toZonedDateTime(timeZone);
  const end = Temporal.PlainDateTime.from(localEnd).toZonedDateTime(timeZone);
  return {
    starts_at: start.toString(),
    starts_at_utc: start.toInstant().toString(),
    ends_at: end.toString(),
    ends_at_utc: end.toInstant().toString(),
  };
}
