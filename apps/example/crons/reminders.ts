// Once a day: everyone booked on an event that starts in the next 24 hours gets a reminder email,
// each in their own language (the one they booked in) with the title as they read it, linking to
// the event on the site they booked on. A job has no request and no page language: the email is
// written with inLocale() (src/events/emails.ts). The window is the 24 hours after the run's own
// scheduledTime, so daily runs cover every start once and no event is reminded twice.
//
// Cloudflare runs it on its Cron Trigger; in dev, Void's trigger runs it on demand
// (`POST /__void/scheduled`, guide/jobs.md), as e2e/dev/jobs.test.ts does.
import { bookings, event_texts, events } from "@schema";
import { defineScheduled } from "void";
import { and, db, gte, inArray, lt } from "void/db";
import { Temporal } from "temporal-polyfill";
import type { AppLocale } from "void-fbtee/locales";
import { pickText } from "void-fbtee/server";
import { sendReminderEmail } from "@/events/emails";
import { SITE } from "@/site";

// 06:00 UTC every day: early morning in Bangkok, late evening before in the Americas.
export const cron = "0 6 * * *";

/** An instant as the database stores starts_at_utc: whole seconds, then Z. */
const utc = (ms: number) =>
  Temporal.Instant.fromEpochMilliseconds(ms).toString({ smallestUnit: "second" });

export default defineScheduled(async (controller) => {
  const from = controller.scheduledTime;
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
    db.select().from(event_texts).where(inArray(event_texts.event_id, ids)),
  ]);
  for (const b of booked) {
    const event = soon.find((e) => e.id === b.event_id)!;
    const text = pickText(
      texts.filter((t) => t.event_id === event.id),
      b.locale,
    );
    await sendReminderEmail(b.email, {
      // The language they booked in: one of the app's, as booking stores it.
      locale: b.locale as AppLocale,
      name: b.name,
      id: event.id,
      title: text?.title ?? event.title,
      titleLocale: text?.locale ?? event.locale,
      startsAt: event.starts_at,
      // Bookings from before the origin was kept: the live site.
      origin: b.origin ?? SITE,
    });
  }
});
