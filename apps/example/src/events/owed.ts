// What the app owes each booker, kept in the database rather than only in a queue message
// (plans/reliable-work.md): their confirmation (bookings.confirmed_at), a change email when the
// event no longer matches what they were told (bookings.told_*), and a cancellation while their
// event is cancelled (events.cancelled_at). The actions and queues use these to decide; the sweep
// (crons/owed.ts) uses them to find what a crash or a lost message left undone.
//
// Each takes the database session of the handler calling it (primaryDb from src/db.ts), so its reads
// are of the main copy and agree with that handler's own. The SQL is store.ts's.
import type { Db } from "@/db";
import { queues } from "void/queues";
import { bookingsOf, eventOn, type Booking, type Event } from "./store";

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
  const event = await eventOn(db, eventId);
  if (!event) return;
  const owed = (await bookingsOf(db, eventId, locales)).filter(
    (b) => b.confirmed_at && isBehind(b, event),
  );
  await Promise.all(owed.map((b) => queues.change.send({ bookingId: b.id })));
}
