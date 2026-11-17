// Once a day: everyone booked on an event that starts in the next 24 hours gets a reminder email,
// each in their own language (the one they booked in) with the title as they read it, linking to
// the event on the site they booked on. A job has no request and no page language: the email is
// written with inLocale() (src/events/emails.ts). The window is the 24 hours after the run's own
// scheduledTime, so daily runs cover every start once and no event is reminded twice. A booker
// who ticked the box when booking gets their PDF ticket attached again. The same run deletes the
// PDF tickets of events that started a week before, and queues again each upcoming event still
// missing one of the app's languages (requeueUntranslated).
//
// Cloudflare runs it on its Cron Trigger; in dev, Void's trigger runs it on demand
// (`POST /__void/scheduled`, guide/jobs.md), as e2e/dev/jobs.test.ts does.
import { bookings, event_texts, events } from "@schema";
import { defineScheduled } from "void";
import { and, db, eq, gte, inArray, lt, sql } from "void/db";
import { queues } from "void/queues";
import { appLocales } from "void-fbtee/server";
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

/**
 * Each upcoming event still missing one of the app's languages, back on the translate queue
 * (queues/translate.ts). Posting queues it once; when that fails for good (after the queue's retries
 * Cloudflare drops the message, and Void's queues have no dead-letter queue: Void's
 * guide/queues.md), as it does while the account's AI Gateway credits are used up, this picks it
 * up again. Only events posted over an hour before, so a fresh post's own message isn't doubled,
 * and only those still to come: a past event's page isn't worth paying for. Here, not a job of its
 * own: Cloudflare's free plan allows 5 Cron Triggers an account.
 */
async function requeueUntranslated(from: number) {
  const upcoming = await db
    .select({ id: events.id, locale: events.locale })
    .from(events)
    .where(
      and(
        gte(events.starts_at_utc, utc(from)),
        // created_at is SQLite's datetime('now'): "YYYY-MM-DD HH:MM:SS", UTC.
        lt(events.createdAt, sql`datetime(${Math.floor(from / 1000) - 3600}, 'unixepoch')`),
      ),
    );
  if (!upcoming.length) return;
  const texts = await db
    .select({ event_id: event_texts.event_id, locale: event_texts.locale })
    .from(event_texts)
    .where(
      inArray(
        event_texts.event_id,
        upcoming.map((e) => e.id),
      ),
    );
  const locales = appLocales();
  for (const e of upcoming) {
    const has = (l: string) =>
      l === e.locale || texts.some((t) => t.event_id === e.id && t.locale === l);
    if (!locales.every(has)) await queues.translate.send({ eventId: e.id });
  }
}

export default defineScheduled(async (controller, env) => {
  const from = controller.scheduledTime;
  await deleteOldTickets(from);
  await requeueUntranslated(from);
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
