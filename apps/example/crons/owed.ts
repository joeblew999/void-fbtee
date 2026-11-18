// Every 15 minutes: whatever the app still owes a booker, untouched for 15 minutes, is queued again
// (plans/reliable-work.md). It finds nothing unless something was lost: a Worker that died between
// saving and queueing, or a message whose tries ran out (the queues have no dead-letter queue;
// Void's guide/queues.md). What's owed is in the database (src/events/owed.ts):
//
// - a confirmation: a booking with no confirmed_at (queues/ticket.ts);
// - a change email: a confirmed booking whose told_* no longer matches its event (queues/change.ts);
// - a cancellation: a booking of a cancelled event (queues/cancel.ts); a cancelled event with no
//   bookings left goes.
//
// The 15 minutes is how long a step may still be running: a job at work and a dead one look the
// same from outside, so work is taken over only once nobody can still be doing it. Each queue
// checks again before it sends, so a step queued twice does it once. Read from the database's main
// copy (void-fbtee/db).
import { bookings, events } from "@schema";
import { defineScheduled } from "void";
import { and, eq, isNotNull, isNull, lt, or, sql } from "void/db";
import { primaryDb } from "void-fbtee/db";
import { queues } from "void/queues";
import { endCancelled } from "../src/events/owed";

export const cron = "*/15 * * * *";

/** SQLite's datetime('now') form, 15 minutes ago: what created_at, updated_at and cancelled_at hold. */
const settled = sql`datetime('now', '-15 minutes')`;

export default defineScheduled(async () => {
  const db = primaryDb();
  // Where a background job's reads are answered, and how fast: the session's first query, which
  // primaryDb sends to the main copy (D1's served_by_primary and served_by_region; absent locally).
  // One line a run, in the Worker's logs (plans/reliable-work.md).
  const t = performance.now();
  const probe = (await db.run(sql`SELECT 1`)) as unknown as {
    meta: { served_by_primary?: boolean; served_by_region?: string };
  };
  console.log(
    `owed: database first read ${Math.round(performance.now() - t)} ms, primary=${probe.meta.served_by_primary ?? "?"}, region=${probe.meta.served_by_region ?? "?"}`,
  );

  const unconfirmed = await db
    .select({ id: bookings.id })
    .from(bookings)
    .innerJoin(events, eq(events.id, bookings.event_id))
    .where(
      and(
        isNull(bookings.confirmed_at),
        isNull(events.cancelled_at),
        lt(bookings.createdAt, settled),
      ),
    );

  const behind = await db
    .select({ id: bookings.id })
    .from(bookings)
    .innerJoin(events, eq(events.id, bookings.event_id))
    .where(
      and(
        isNotNull(bookings.confirmed_at),
        isNull(events.cancelled_at),
        lt(events.updatedAt, settled),
        or(
          sql`${bookings.told_title} IS NOT ${events.title}`,
          sql`${bookings.told_starts_at} IS NOT ${events.starts_at}`,
          sql`${bookings.told_ends_at} IS NOT ${events.ends_at}`,
          sql`${bookings.told_venue} IS NOT ${events.venue}`,
        ),
      ),
    );

  const cancelled = await db
    .select({ booking: bookings.id, event: events.id })
    .from(events)
    .leftJoin(bookings, eq(bookings.event_id, events.id))
    .where(and(isNotNull(events.cancelled_at), lt(events.cancelled_at, settled)));

  await Promise.all([
    ...unconfirmed.map((b) => queues.ticket.send({ bookingId: b.id })),
    ...behind.map((b) => queues.change.send({ bookingId: b.id })),
    ...cancelled.flatMap((r) => (r.booking ? [queues.cancel.send({ bookingId: r.booking })] : [])),
  ]);
  for (const id of new Set(cancelled.filter((r) => !r.booking).map((r) => r.event)))
    await endCancelled(db, id);

  const found = unconfirmed.length + behind.length + cancelled.length;
  if (found)
    console.warn(
      `owed: queued again ${unconfirmed.length} confirmations, ${behind.length} change emails, ` +
        `${cancelled.filter((r) => r.booking).length} cancellations (a step was lost)`,
    );
});
