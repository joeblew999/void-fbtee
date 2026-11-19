// Tells a booker that their event is cancelled, in the language they booked in, then deletes their
// booking and its PDF ticket; the event and its translations go with its last booking
// (plans/reliable-work.md). The delete action marks the event cancelled and queues one message per
// booking, so it answers at once however many booked; the sweep queues any booking of a cancelled
// event left over (crons/owed.ts). Until its email has gone, the booking itself is what says this
// booker is owed it. Read from the database's main copy (src/db.ts).
import { defineQueue } from "void";
import { primaryDb } from "@/db";
import type { AppLocale } from "void-fbtee/locales";
import { storage } from "void/storage";
import { sendCancellationEmail } from "../src/events/emails";
import { bookingWithEvent, deleteBooking, deleteIfDone } from "../src/events/store";
import { ticketKey } from "../src/events/tickets";
import { textsFor, titleFor } from "../src/events/translations";
import { originOr } from "../src/site";

type Message = { bookingId: string };

/** A failed email is tried again a minute later, five times (Void's guide/queues.md); after that
 * the booking is still there, and the sweep queues it again. */
export const maxRetries = 5;
export const retryDelay = 60;

export default defineQueue<Message>(async (batch) => {
  for (const message of batch.messages) {
    const db = primaryDb();
    const row = await bookingWithEvent(db, message.body.bookingId);
    // Told already (the booking is gone), or the event isn't cancelled: nothing owed.
    if (!row || !row.event.cancelled_at) {
      message.ack();
      continue;
    }
    const { booking, event } = row;
    // The language they booked in: one of the app's, as booking stores it. The title as they
    // read it: its translations go only with the event's last booking.
    const locale = booking.locale as AppLocale;
    const text = titleFor(event, await textsFor([event.id], locale, db), locale);
    const sent = await sendCancellationEmail(booking.email, {
      locale,
      name: booking.name,
      title: text.title,
      titleLocale: text.locale,
      startsAt: event.starts_at,
      endsAt: event.ends_at,
      origin: originOr(booking.origin),
    });
    if (!sent) {
      message.retry();
      continue;
    }
    // Told: their booking and its ticket (it has their name on it) go, and the event with its last.
    await deleteBooking(db, booking.id);
    await storage.delete(ticketKey(booking.id));
    await deleteIfDone(db, event.id);
    message.ack();
  }
});
