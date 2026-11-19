// Every query the app runs on its events and bookings (plans/layout.md): pages, actions, queues,
// crons and routes call these and hold no SQL of their own, so this file is what the app does to
// its database. What they mean (who's owed what, what a reader sees) is theirs; this is the SQL.
//
// Each takes the session it's given (primaryDb() from src/db.ts, opened once per handler), so all of
// a page's or a job's reads share it: one trip to D1's main copy, not one a query. Writes go to the
// main copy either way.
import { bookings, events, events_translations } from "@schema";
import { and, asc, count, eq, gte, inArray, isNotNull, isNull, lt, max, or, sql } from "void/db";
import type { Db } from "@/db";

export type Event = typeof events.$inferSelect;
export type Booking = typeof bookings.$inferSelect;
type Told = Pick<Booking, "told_title" | "told_starts_at" | "told_ends_at" | "told_venue">;

/** SQLite's datetime('now') form, 15 minutes ago: what created_at, updated_at and cancelled_at hold. */
const settled = sql`datetime('now', '-15 minutes')`;

// Events

/** An event that's on (not cancelled). Undefined when there's none. */
export async function eventOn(db: Db, id: string) {
  const [row] = await db
    .select()
    .from(events)
    .where(and(eq(events.id, id), isNull(events.cancelled_at)));
  return row;
}

/** An event, cancelled or not. */
export async function eventById(db: Db, id: string) {
  const [row] = await db.select().from(events).where(eq(events.id, id));
  return row;
}

/** The events from now on that are on, soonest first, each with its seats taken (one query). */
export async function upcoming(db: Db) {
  const taken = db
    .select({ event_id: bookings.event_id, n: count().as("n") })
    .from(bookings)
    .groupBy(bookings.event_id)
    .as("taken");
  const rows = await db
    .select({ event: events, taken: taken.n })
    .from(events)
    .leftJoin(taken, eq(taken.event_id, events.id))
    .where(and(gte(events.starts_at_utc, new Date().toISOString()), isNull(events.cancelled_at)))
    .orderBy(asc(events.starts_at_utc));
  return rows.map((r) => ({ event: r.event, taken: r.taken ?? 0 }));
}

/** The events that are on starting in [from, to) (ISO instants, as starts_at_utc holds them). */
export async function startingBetween(db: Db, from: string, to: string) {
  return db
    .select()
    .from(events)
    .where(
      and(
        gte(events.starts_at_utc, from),
        lt(events.starts_at_utc, to),
        isNull(events.cancelled_at),
      ),
    );
}

/** Each event that's on, with when it last changed: its own row, or its newest translation. */
export async function lastChanged(db: Db) {
  return db
    .select({ id: events.id, at: events.updatedAt, text: max(events_translations.updatedAt) })
    .from(events)
    .leftJoin(events_translations, eq(events_translations.source_id, events.id))
    .where(isNull(events.cancelled_at))
    .groupBy(events.id);
}

/** Stores a new event. Its id. */
export async function createEvent(db: Db, values: typeof events.$inferInsert): Promise<string> {
  const [created] = await db.insert(events).values(values).returning({ id: events.id });
  if (!created) {
    throw new Error("createEvent: the insert gave back no row");
  }
  return created.id;
}

/** Changes an event's title, description, place, seats and times; its updated_at is now. */
export async function updateEvent(
  db: Db,
  id: string,
  values: Pick<
    Event,
    | "title"
    | "description"
    | "venue"
    | "seats"
    | "starts_at"
    | "starts_at_utc"
    | "ends_at"
    | "ends_at_utc"
  >,
): Promise<void> {
  await db
    .update(events)
    .set({ ...values, updatedAt: sql`(datetime('now'))` })
    .where(eq(events.id, id));
}

/** Marks an event cancelled, now. */
export async function cancelEvent(db: Db, id: string): Promise<void> {
  await db
    .update(events)
    .set({ cancelled_at: sql`(datetime('now'))` })
    .where(eq(events.id, id));
}

/** Deletes a cancelled event with no bookings left, its translations with it (they cascade). */
export async function deleteIfDone(db: Db, eventId: string): Promise<void> {
  const [left] = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(eq(bookings.event_id, eventId))
    .limit(1);
  if (left) {
    return;
  }
  await db.delete(events).where(and(eq(events.id, eventId), isNotNull(events.cancelled_at)));
}

// Bookings

/** How many seats of an event are booked. */
export async function seatsTaken(db: Db, eventId: string): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(bookings)
    .where(eq(bookings.event_id, eventId));
  return row?.n ?? 0;
}

/** Whether a booking has this id already. */
export async function bookingExists(db: Db, id: string): Promise<boolean> {
  const [row] = await db.select({ id: bookings.id }).from(bookings).where(eq(bookings.id, id));
  return !!row;
}

/**
 * Books a seat, in one statement so two people can't take the last one: the row goes in only while
 * the event is on and has fewer bookings than seats. What the booker is told (told_*) is the event
 * as it is in that same statement. True when it went in. D1 runs each statement on the primary, one
 * at a time. Drizzle's insert-select: it takes every column of the table, in the table's order,
 * checked only when it runs (drizzle-orm 0.45.4's haveSameKeys). Its type
 * (SQLiteInsertSelectQueryBuilder) lets the columns with defaults be left out, so the type check
 * doesn't catch one missing: a column added to bookings is added here too, or every booking fails
 * (the dev and preview tests book).
 */
export async function bookSeat(
  db: Db,
  b: Pick<
    typeof bookings.$inferInsert,
    "id" | "event_id" | "name" | "email" | "locale" | "time_zone" | "origin" | "ticket_in_reminder"
  >,
): Promise<boolean> {
  const taken = db.select({ n: count() }).from(bookings).where(eq(bookings.event_id, b.event_id));
  const result = await db.insert(bookings).select(
    db
      .select({
        id: sql<string>`${b.id}`.as("id"),
        event_id: events.id,
        name: sql<string>`${b.name}`.as("name"),
        email: sql<string>`${b.email}`.as("email"),
        locale: sql<string>`${b.locale}`.as("locale"),
        time_zone: sql<string>`${b.time_zone}`.as("time_zone"),
        origin: sql<string | null>`${b.origin ?? null}`.as("origin"),
        ticket_in_reminder: sql<boolean>`${b.ticket_in_reminder ? 1 : 0}`.as("ticket_in_reminder"),
        confirmed_at: sql<string | null>`NULL`.as("confirmed_at"),
        told_title: events.title,
        told_starts_at: events.starts_at,
        told_ends_at: events.ends_at,
        told_venue: events.venue,
        createdAt: sql<string>`datetime('now')`.as("created_at"),
        updatedAt: sql<string>`datetime('now')`.as("updated_at"),
      })
      .from(events)
      .where(
        and(
          eq(events.id, b.event_id),
          isNull(events.cancelled_at),
          sql`(${taken}) < ${events.seats}`,
        ),
      ),
  );
  return result.meta.changes > 0;
}

/** A booking with its event, or undefined when there's no such booking. */
export async function bookingWithEvent(db: Db, id: string) {
  const [row] = await db
    .select({ booking: bookings, event: events })
    .from(bookings)
    .innerJoin(events, eq(events.id, bookings.event_id))
    .where(eq(bookings.id, id));
  return row;
}

/** An event's bookings: all, or those made in these languages. */
export async function bookingsOf(db: Db, eventId: string, locales?: ReadonlyArray<string>) {
  return db
    .select()
    .from(bookings)
    .where(
      and(
        eq(bookings.event_id, eventId),
        locales ? inArray(bookings.locale, [...locales]) : undefined,
      ),
    );
}

/** The bookings of these events. */
export async function bookingsOfEvents(db: Db, eventIds: Array<string>) {
  return eventIds.length
    ? db.select().from(bookings).where(inArray(bookings.event_id, eventIds))
    : [];
}

/** The languages an event's bookers booked in. */
export async function bookerLocales(db: Db, eventId: string): Promise<Array<string>> {
  const rows = await db
    .selectDistinct({ locale: bookings.locale })
    .from(bookings)
    .where(eq(bookings.event_id, eventId));
  return rows.map((r) => r.locale);
}

/** The ids of the bookings of events starting in [from, to) (ISO instants), cancelled or not. */
export async function bookingsStartingBetween(
  db: Db,
  from: string,
  to: string,
): Promise<Array<string>> {
  const rows = await db
    .select({ id: bookings.id })
    .from(bookings)
    .innerJoin(events, eq(events.id, bookings.event_id))
    .where(and(gte(events.starts_at_utc, from), lt(events.starts_at_utc, to)));
  return rows.map((r) => r.id);
}

/** Records a booking's confirmation as sent now, with what it told them. */
export async function confirmed(db: Db, id: string, told: Told): Promise<void> {
  await db
    .update(bookings)
    .set({ confirmed_at: sql`(datetime('now'))`, ...told })
    .where(eq(bookings.id, id));
}

/** Records what a booker was told. */
export async function told(db: Db, id: string, value: Told): Promise<void> {
  await db.update(bookings).set(value).where(eq(bookings.id, id));
}

/** Deletes a booking. */
export async function deleteBooking(db: Db, id: string): Promise<void> {
  await db.delete(bookings).where(eq(bookings.id, id));
}

// Where reads are answered

/** One small read, timed, and which of D1's copies answered it (D1's served_by_primary and
 * served_by_region with its result; absent locally, where there's one database). */
export async function timedRead(db: Db) {
  const t = performance.now();
  const result = await db.run(sql`SELECT 1`);
  return {
    ms: Math.round(performance.now() - t),
    primary: result.meta.served_by_primary ?? null,
    region: result.meta.served_by_region ?? null,
  };
}

// What's owed, for the sweep (crons/owed.ts): untouched for 15 minutes.

/** Bookings of events that are on, made over 15 minutes ago, with no confirmation sent. */
export async function unconfirmed(db: Db): Promise<Array<string>> {
  const rows = await db
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
  return rows.map((r) => r.id);
}

/** Confirmed bookings whose event, changed over 15 minutes ago, no longer matches what they were told. */
export async function behind(db: Db): Promise<Array<string>> {
  const rows = await db
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
  return rows.map((r) => r.id);
}

/** Events cancelled over 15 minutes ago, each with a booking still there (none when it has none). */
export async function cancelledLeft(db: Db) {
  return db
    .select({ booking: bookings.id, event: events.id })
    .from(events)
    .leftJoin(bookings, eq(bookings.event_id, events.id))
    .where(and(isNotNull(events.cancelled_at), lt(events.cancelled_at, settled)));
}
