// Tells a booker that the organiser changed what matters to them (the event's title, start, end or
// place), in the language they booked in. Queued, one message per booking, by the step before it
// (plans/reliable-work.md): the change action for bookers whose language needs no new translation,
// the translation queue when their language's translation is stored or fails
// (src/events/translations.ts), and the sweep for any message lost (crons/owed.ts). Nothing here
// waits for anything.
//
// What's owed is in the database, not in the message: the booking's told_* (what they were last
// told) against the event as it is now (src/events/owed.ts). Different: the email, saying what it
// was; then told_* is the event as emailed. The same: nothing, so a message twice, a change undone
// or two changes in a row (one email, of where it ended) need nothing else. Read from the
// database's main copy (src/db.ts), so a change made a second ago is seen.
import { defineQueue } from "void";
import { primaryDb } from "@/db";
import { appLocaleOf } from "void-fbtee/server";
import { sendChangeEmail } from "../src/events/emails";
import { isBehind, toldOf } from "../src/events/owed";
import { bookingWithEvent, told } from "../src/events/store";
import { textsFor, titleFor } from "../src/events/translations";
import { originOr } from "../src/site";

type Message = { bookingId: string };

/** A failed email is tried again a minute later, five times (Void's guide/queues.md); after that
 * the booking is still behind, and the sweep queues it again. */
export const maxRetries = 5;
export const retryDelay = 60;

export default defineQueue<Message>(async (batch) => {
  for (const message of batch.messages) {
    const db = primaryDb();
    const row = await bookingWithEvent(db, message.body.bookingId);
    // Gone, cancelled (its cancellation says it), not yet confirmed (the confirmation will say it
    // as it is), or told already: nothing owed.
    if (
      !row ||
      row.event.cancelled_at ||
      !row.booking.confirmed_at ||
      !isBehind(row.booking, row.event)
    ) {
      message.ack();
      continue;
    }
    const { booking, event } = row;
    const locale = appLocaleOf(booking.locale);
    // The title in their language where its translation is of the event as it is now, else as
    // written, marked with its language (titleFor: a translation of what it said before is never used).
    const text = titleFor(event, await textsFor([event.id], locale, db), locale);
    const was = {
      ...(booking.told_starts_at !== null && booking.told_starts_at !== event.starts_at
        ? { startsAt: booking.told_starts_at }
        : {}),
      ...(booking.told_ends_at !== null && booking.told_ends_at !== event.ends_at
        ? { endsAt: booking.told_ends_at }
        : {}),
      ...((booking.told_venue ?? null) !== (event.venue ?? null)
        ? { venue: booking.told_venue }
        : {}),
    };
    const sent = await sendChangeEmail(booking.email, {
      locale,
      name: booking.name,
      id: event.id,
      origin: originOr(booking.origin),
      title: text.title,
      titleLocale: text.locale,
      startsAt: event.starts_at,
      endsAt: event.ends_at,
      venue: event.venue,
      was,
    });
    if (!sent) {
      message.retry();
      continue;
    }
    await told(db, booking.id, toldOf(event));
    message.ack();
  }
});
