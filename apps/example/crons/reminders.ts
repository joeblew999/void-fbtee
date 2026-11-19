// Once a day: everyone booked on an event that starts in the next 24 hours gets a reminder email,
// each in their own language (the one they booked in) with the title as they read it, linking to
// the event on the site they booked on. A job has no request and no page language: the email is
// written with inLocale() (src/events/emails.ts). The window is the 24 hours after the run's own
// scheduledTime, so daily runs cover every start once and no event is reminded twice. A booker
// who ticked the box when booking gets their PDF ticket attached again. The same run deletes the
// PDF tickets of events that started a week before. (Keeping posts in the app's languages is
// crons/translations.ts.)
//
// Cloudflare runs it on its Cron Trigger; in dev, Void's trigger runs it on demand
// (`POST /__void/scheduled`, guide/jobs.md), as e2e/dev/jobs.test.ts does.
import { defineScheduled } from "void";
import { primaryDb } from "@/db";
import { Temporal } from "temporal-polyfill";
import { appLocaleOf } from "void-fbtee/server";
import { sendReminderEmail } from "@/events/emails";
import { KEEP_TICKETS_MS, ticketKey, ticketPdf } from "@/events/tickets";
import { storage } from "void/storage";
import { originOr } from "@/site";
import { textsFor, titleFor } from "@/events/translations";
import { bookingsOfEvents, bookingsStartingBetween, startingBetween } from "@/events/store";
import type { Db } from "@/db";

// 06:00 UTC every day: early morning in Bangkok, late evening before in the Americas.
export const cron = "0 6 * * *";

/** An instant as the database stores starts_at_utc: whole seconds, then Z. */
const utc = (ms: number) =>
  Temporal.Instant.fromEpochMilliseconds(ms).toString({ smallestUnit: "second" });

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The PDF tickets of events that started a week before this run, in the same kind of 24-hour
 * window as the reminders, so each event's are deleted once. A ticket never printed is no matter:
 * R2 deletes what's there.
 */
async function deleteOldTickets(db: Db, from: number) {
  const done = await bookingsStartingBetween(
    db,
    utc(from - KEEP_TICKETS_MS - DAY_MS),
    utc(from - KEEP_TICKETS_MS),
  );
  // R2 deletes up to 1,000 keys a call (Cloudflare's R2 Workers API reference, checked 2026-11-14).
  for (let i = 0; i < done.length; i += 1000) {
    await storage.delete(done.slice(i, i + 1000).map((id) => ticketKey(id)));
  }
}

export default defineScheduled(async (controller, env) => {
  const from = controller.scheduledTime;
  // From the database's main copy (src/db.ts), one session for the run: a booking made a second
  // ago is reminded too.
  const db = primaryDb();
  await deleteOldTickets(db, from);
  // Events that are on: a cancelled event's bookers get its cancellation, not a reminder.
  const soon = await startingBetween(db, utc(from), utc(from + DAY_MS));
  if (!soon.length) {
    return;
  }
  const ids = soon.map((e) => e.id);
  const booked = await bookingsOfEvents(db, ids);
  const texts = await textsFor(ids, undefined, db);
  for (const b of booked) {
    // Every booking read is of one of these events (bookingsOfEvents above).
    const event = soon.find((e) => e.id === b.event_id);
    if (!event) {
      continue;
    }
    const text = titleFor(event, texts, b.locale);
    // Their PDF ticket too, if they asked for it when booking: kept since then, so no printing
    // (src/events/tickets.ts). If it can't be had now, the reminder goes without it.
    const ticket = b.ticket_in_reminder
      ? await ticketPdf(b.id, env.BROWSER).catch((error: unknown) => {
          console.warn("reminder sent without its ticket:", String(error));
          return undefined;
        })
      : undefined;
    await sendReminderEmail(b.email, {
      // The language they booked in: one of the app's, as booking stores it.
      locale: appLocaleOf(b.locale),
      name: b.name,
      id: event.id,
      title: text.title,
      titleLocale: text.locale,
      startsAt: event.starts_at,
      endsAt: event.ends_at,
      // Bookings from before the origin was kept: the live site.
      origin: originOr(b.origin),
      ticket,
    });
  }
});
