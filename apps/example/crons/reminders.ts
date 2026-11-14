// Once a day: everyone booked on an event that starts in the next 24 hours gets a reminder email,
// each in their own language (the one they booked in) with the title as they read it, linking to
// the event on the site they booked on. A job has no request and no page language: the email is
// written with inLocale() (src/events/emails.ts). The window is the 24 hours after the run's own
// scheduledTime, so daily runs cover every start once and no event is reminded twice. A booker
// who ticked the box when booking gets their PDF ticket attached again. The same run deletes the
// PDF tickets of events that started a week before.
//
// Cloudflare runs it on its Cron Trigger; in dev, Void's trigger runs it on demand
// (`POST /__void/scheduled`, guide/jobs.md), as e2e/dev/jobs.test.ts does.
import { bookings, events } from "@schema";
import { defineScheduled } from "void";
import { and, db, eq, gte, inArray, lt } from "void/db";
import { Temporal } from "temporal-polyfill";
import type { AppLocale } from "void-fbtee/locales";
import { sendReminderEmail } from "@/events/emails";
import { KEEP_TICKETS_MS, ticketKey, ticketPdf } from "@/events/tickets";
import { storage } from "void/storage";
import { originOr } from "@/site";
import { textsFor, titleFor } from "@/events/translations";

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
async function deleteOldTickets(from: number) {
  const done = await db
    .select({ id: bookings.id })
    .from(bookings)
    .innerJoin(events, eq(events.id, bookings.event_id))
    .where(
      and(
        gte(events.starts_at_utc, utc(from - KEEP_TICKETS_MS - DAY_MS)),
        lt(events.starts_at_utc, utc(from - KEEP_TICKETS_MS)),
      ),
    );
  // R2 deletes up to 1,000 keys a call (Cloudflare's R2 Workers API reference, checked 2026-11-14).
  for (let i = 0; i < done.length; i += 1000)
    await storage.delete(done.slice(i, i + 1000).map((b) => ticketKey(b.id)));
}

export default defineScheduled(async (controller, env) => {
  const from = controller.scheduledTime;
  await deleteOldTickets(from);
  const soon = await db
    .select()
    .from(events)
    .where(
      and(
        gte(events.starts_at_utc, utc(from)),
        lt(events.starts_at_utc, utc(from + 24 * 60 * 60 * 1000)),
      ),
    );
  if (!soon.length) return;
  const ids = soon.map((e) => e.id);
  const [booked, texts] = await Promise.all([
    db.select().from(bookings).where(inArray(bookings.event_id, ids)),
    textsFor(ids),
  ]);
  for (const b of booked) {
    const event = soon.find((e) => e.id === b.event_id)!;
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
      locale: b.locale as AppLocale,
      name: b.name,
      id: event.id,
      title: text.title,
      titleLocale: text.locale,
      startsAt: event.starts_at,
      // Bookings from before the origin was kept: the live site.
      origin: originOr(b.origin),
      ticket,
    });
  }
});
