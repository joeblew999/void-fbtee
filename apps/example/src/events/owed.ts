// What the app owes each booker, kept in the database rather than only in a queue message
// (plans/reliable-work.md): their confirmation (bookings.confirmed_at), a change email when the
// event no longer matches what they were told (bookings.told_*), and a cancellation while their
// event is cancelled (events.cancelled_at). The actions and queues use these to decide; the sweep
// (crons/owed.ts) uses them to find what a crash or a lost message left undone.
//
// Each takes the database session of the handler calling it (void-fbtee/db primaryDb), so its reads
// are of the main copy and agree with that handler's own.
import { bookings, events } from "@schema";
import { and, eq, inArray, isNotNull } from "void/db";
import type { primaryDb } from "void-fbtee/db";
import { queues } from "void/queues";

type Db = ReturnType<typeof primaryDb>;
type Event = typeof events.$inferSelect;
type Booking = typeof bookings.$inferSelect;

/** What a booker is told about an event: its title, start, end and place, as its organiser wrote them. */
export const toldOf = (event: Pick<Event, "title" | "starts_at" | "ends_at" | "venue">) => ({
  told_title: event.title,
  told_starts_at: event.starts_at,
  told_ends_at: event.ends_at,
  told_venue: event.venue,
});

/** Whether the event no longer matches what this booker was last told: they're owed a change email. */
export const isBehind = (booking: Booking, event: Event) =>
  booking.told_title !== event.title ||
  booking.told_starts_at !== event.starts_at ||
  booking.told_ends_at !== event.ends_at ||
  (booking.told_venue ?? null) !== (event.venue ?? null);

/**
 * Queues a change email (queues/change.ts) for each booker of the event who is behind on it, in
 * `locales` only when given (those whose translation just landed or failed). Their confirmation
 * covers bookers not yet confirmed; the cancellation covers a cancelled event. Asking twice is
 * harmless: the queue checks again before it sends.
 */
export async function tellBookers(db: Db, eventId: string, locales?: readonly string[]) {
  const [event] = await db.select().from(events).where(eq(events.id, eventId));
  if (!event || event.cancelled_at) return;
  const rows = await db
    .select()
    .from(bookings)
    .where(
      and(
        eq(bookings.event_id, eventId),
        locales ? inArray(bookings.locale, [...locales]) : undefined,
      ),
    );
  const owed = rows.filter((b) => b.confirmed_at && isBehind(b, event));
  await Promise.all(owed.map((b) => queues.change.send({ bookingId: b.id })));
}

/** A cancelled event whose every booker has been told goes, with its translations (they cascade). */
export async function endCancelled(db: Db, eventId: string) {
  const [left] = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(eq(bookings.event_id, eventId))
    .limit(1);
  if (left) return;
  await db.delete(events).where(and(eq(events.id, eventId), isNotNull(events.cancelled_at)));
}
