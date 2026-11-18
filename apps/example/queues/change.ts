// Tells everyone who booked an event that its organiser changed what matters to them (its title,
// when it is, where), each in their own language (the language they booked in). The change action
// (pages/[lang]/events/[id].server.ts) sends one message per booking, with what it was before, so
// the change answers at once however many booked, and a failed email is retried on its own (Void's
// guide/queues.md).
//
// The title as each booker reads it: a changed event is translated again (void-fbtee's queue), so
// this waits, a minute at a time, until the translation into the booker's language is made from
// what the event says now (void-fbtee/content untranslated); on the last try it goes with the title
// as the organiser wrote it, marked with its language, as the event's page shows it meanwhile.
import { bookings, events } from "@schema";
import { defineQueue } from "void";
import { db, eq } from "void/db";
import { untranslated } from "void-fbtee/content";
import type { AppLocale } from "void-fbtee/locales";
import { sendChangeEmail } from "../src/events/emails";
import { textsFor, titleFor } from "../src/events/translations";

type Message = {
  bookingId: string;
  eventId: string;
  /** What changed, as it was: only the parts that changed. */
  was: { startsAt?: string; endsAt?: string; venue?: string | null };
  /** Where the change was made (dev, a Worker Preview, live): the email links back there. */
  origin: string;
};

/** Tries: the first and five retries, a minute apart, for its translation to land. */
export const maxRetries = 5;
const TRIES = maxRetries + 1;

export default defineQueue<Message>(async (batch) => {
  for (const message of batch.messages) {
    const { bookingId, eventId, was, origin } = message.body;
    const [row] = await db
      .select({ booking: bookings, event: events })
      .from(bookings)
      .innerJoin(events, eq(events.id, bookings.event_id))
      .where(eq(bookings.id, bookingId));
    // Deleted since (the event, or the booking with it): its cancellation has gone instead.
    if (!row || row.event.id !== eventId) {
      message.ack();
      continue;
    }
    const { booking, event } = row;
    const locale = booking.locale as AppLocale;
    const waiting = (await untranslated("events", event.id))?.missing.includes(locale) ?? false;
    if (waiting && message.attempts < TRIES) {
      message.retry({ delaySeconds: 60 });
      continue;
    }
    // Still not translated on the last try: the title as written, never an old translation.
    const text = waiting
      ? { title: event.title, locale: event.locale }
      : titleFor(event, await textsFor([event.id], locale), locale);
    const sent = await sendChangeEmail(booking.email, {
      locale,
      name: booking.name,
      id: event.id,
      origin,
      title: text.title,
      titleLocale: text.locale,
      startsAt: event.starts_at,
      endsAt: event.ends_at,
      venue: event.venue,
      was,
    });
    if (sent) message.ack();
    else message.retry({ delaySeconds: 60 });
  }
});
