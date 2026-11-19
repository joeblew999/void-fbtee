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
import { defineScheduled } from "void";
import { primaryDb } from "void-fbtee/db";
import { queues } from "void/queues";
import { behind, cancelledLeft, deleteIfDone, timedRead, unconfirmed } from "../src/events/store";

export const cron = "*/15 * * * *";

export default defineScheduled(async () => {
  const db = primaryDb();
  // Where a background job's reads are answered, and how fast: the session's first query, which
  // primaryDb sends to the main copy (D1's served_by_primary and served_by_region; absent locally).
  // One line a run, in the Worker's logs (plans/reliable-work.md).
  const first = await timedRead(db);
  console.log(
    `owed: database first read ${first.ms} ms, primary=${first.primary ?? "?"}, region=${first.region ?? "?"}`,
  );

  const unconfirmedIds = await unconfirmed(db);
  const behindIds = await behind(db);
  const cancelled = await cancelledLeft(db);

  await Promise.all([
    ...unconfirmedIds.map((id) => queues.ticket.send({ bookingId: id })),
    ...behindIds.map((id) => queues.change.send({ bookingId: id })),
    ...cancelled.flatMap((r) => (r.booking ? [queues.cancel.send({ bookingId: r.booking })] : [])),
  ]);
  for (const id of new Set(cancelled.filter((r) => !r.booking).map((r) => r.event)))
    await deleteIfDone(db, id);

  const found = unconfirmedIds.length + behindIds.length + cancelled.length;
  if (found)
    console.warn(
      `owed: queued again ${unconfirmedIds.length} confirmations, ${behindIds.length} change emails, ` +
        `${cancelled.filter((r) => r.booking).length} cancellations (a step was lost)`,
    );
});
