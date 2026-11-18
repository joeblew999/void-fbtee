// One event, by its id, with its seats left (the loader); booking a seat (the page's action); and,
// for whoever posted it, changing it and deleting it (with the key from their private link).
import { bookings, bookSchema, changeEventSchema, events, when } from "@schema";
import { defineHandler, defineHead, type InferProps } from "void";
import { count, db, eq, sql } from "void/db";
import { queues } from "void/queues";
import { storage } from "void/storage";
import { z } from "zod";
import type { Event as SchemaEvent, WithContext } from "schema-dts";
import { Temporal } from "temporal-polyfill";
import { jsonLd, pageHead } from "void-fbtee/head";
import type { AppLocale } from "void-fbtee/locales";
import { routeUrl } from "void-fbtee/routes";
import { revalidate as clearCache, siteOrigin } from "void-fbtee/server";
import { deleteKeyMatches } from "../../../src/events/delete-key";
import { ticketKey } from "../../../src/events/tickets";
import { eventTopic, live } from "../../../src/events/live";
import { eventPages, textFor, textsFor, titleFor } from "../../../src/events/translations";
import { translateSoon } from "void-fbtee/content";

export type Props = InferProps<typeof loader>;

// Void's page cache keeps each event's page until the next deploy (a year, the longest it
// allows): only a booking changes it, and booking clears it at once, in every language (the
// action). Open pages get the new seats-left count live as well (src/events/live.ts). A page in a
// language the event isn't translated into yet isn't cached, and its translation is queued
// (void-fbtee's middleware, from textFor in the loader).
export const revalidate = 31_536_000;

// The page's URL parameter: /<lang>/events/<id>. Whether it's an event is the database's answer:
// an id that isn't one gets the not-found page (the loader) or a 404 (booking).
const params = z.object({ id: z.string() });

const booked = (id: string) =>
  db
    .select({ n: count() })
    .from(bookings)
    .where(eq(bookings.event_id, id))
    .then(([row]) => row.n);

// The event, its title and description in the page's language where a translation is stored (else
// its fallbacks', else as its organiser wrote it: textFor), seats left,
// and whether it can be deleted (a posted event, not a sample). Never its delete key's hash: the
// page and its data are public, and cached.
export const loader = defineHandler.withValidator({ params })(async (c, { params: { id } }) => {
  const { locale } = c.get("i18n");
  const [row] = await db.select().from(events).where(eq(events.id, id));
  if (!row) return c.notFound();
  const { delete_key_hash, ...event } = row;
  const text = textFor(event, await textsFor([id], locale), locale);
  return { event, text, left: event.seats - (await booked(id)), deletable: !!delete_key_hash };
});

/** Booking a seat: the page's own action (a POST to the page). */
const book = defineHandler.withValidator({ params, body: bookSchema })(async (
  c,
  { params: { id }, body },
) => {
  const { locale } = c.get("i18n");
  // Where this booking is being made (dev, a Worker Preview, live): its emails link back here.
  const origin = new URL(c.req.url).origin;
  // The booking's id comes from the form (bookSchema): one that's taken is refused, not a crash.
  const [taken] = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(eq(bookings.id, body.id));
  if (taken) return c.json({ message: "booking id taken" }, 400);
  // One statement, so two people can't take the last seat: the row goes in only while the event
  // has fewer bookings than seats. D1 runs each statement on the primary, one at a time.
  const result = await db.run(sql`
    INSERT INTO ${bookings} (id, event_id, name, email, locale, time_zone, origin, ticket_in_reminder)
    SELECT ${body.id}, ${id}, ${body.name}, ${body.email}, ${locale}, ${body.time_zone}, ${origin},
      ${body.ticket_in_reminder ? 1 : 0}
    WHERE (SELECT COUNT(*) FROM ${bookings} WHERE event_id = ${id})
        < (SELECT seats FROM ${events} WHERE id = ${id})`);
  if (!result.meta.changes) {
    // Nothing went in: the event is full, or there's no such event (the seats compared with nothing).
    const [found] = await db.select({ id: events.id }).from(events).where(eq(events.id, id));
    return found ? c.json({ message: "sold out" }, 409) : c.notFound();
  }
  const [event] = await db.select().from(events).where(eq(events.id, id));
  const left = event.seats - (await booked(id));
  // This event's page, in every language (the list shows each event's seats, not what's left).
  await clearCache({ paths: [`/[lang]/events/${id}`] });
  await live.publish(eventTopic(id), { left }, { type: "seats" });
  // The confirmation, in the booker's language, with its PDF ticket, after this answers
  // (queues/ticket.ts): printing takes up to a second.
  await queues.ticket.send({ bookingId: body.id });
  // No return: Void reruns the loader, so the page shows the new count.
});

/**
 * Deleting the event, with the key from the poster's private link (src/events/delete-key.ts): first
 * everyone who booked is sent a cancellation, each in their own language with the title as they read
 * it (queues/cancel.ts, so this answers at once however many booked); then its bookings,
 * translations and itself go, together, and the bookings' PDF tickets; its pages leave the cache in every language, with the list
 * and the sitemap; pages open on it hear "deleted" (src/events/live.ts) and say it's cancelled; and
 * the browser goes to the list. A wrong key is a 403.
 */
const remove = defineHandler.withValidator({ params, body: z.object({ key: z.string().min(1) }) })(
  async (c, { params: { id }, body }) => {
    const [event] = await db.select().from(events).where(eq(events.id, id));
    if (!event) return c.notFound();
    if (!(await deleteKeyMatches(body.key, event.delete_key_hash)))
      return c.json({ message: "wrong key" }, 403);
    const [booked, texts] = await Promise.all([
      db.select().from(bookings).where(eq(bookings.event_id, id)),
      textsFor([id]),
    ]);
    // Where the delete is made: the cancellations link back to the events list there.
    const origin = new URL(c.req.url).origin;
    await Promise.all(
      booked.map((b) => {
        const text = titleFor(event, texts, b.locale);
        return queues.cancel.send({
          to: b.email,
          name: b.name,
          // The language they booked in: one of the app's, as booking stores it (book, above).
          locale: b.locale as AppLocale,
          title: text.title,
          titleLocale: text.locale,
          startsAt: event.starts_at,
          endsAt: event.ends_at,
          origin,
        });
      }),
    );
    await db.batch([
      db.delete(bookings).where(eq(bookings.event_id, id)),
      db.delete(events).where(eq(events.id, id)),
    ]);
    // Their PDF tickets too: each has its booker's name on it.
    if (booked.length) await storage.delete(booked.map((b) => ticketKey(b.id)));
    await clearCache({ paths: eventPages(id) });
    await live.publish(eventTopic(id), {}, { type: "deleted" });
    return c.redirect(routeUrl("/[lang]/events"));
  },
);

/**
 * Changing the event, with the key from the poster's private link: its title, description, place,
 * start and end, and seats (never fewer than are booked: a 409). Its language stays the one it was
 * written in. Then, in order: it's translated again (void-fbtee's translateSoon: its translations
 * no longer match what it says); when its title, start, end or place changed, everyone who booked
 * is told, each in their own language (queues/change.ts), and their stored PDF tickets, which show
 * those, go, so the next download prints the new ones; its pages leave the cache in every language,
 * with the list and the sitemap; and pages open on it hear "changed" and load it again. No return:
 * Void reruns the loader, so the page shows the change. A wrong key is a 403.
 */
const change = defineHandler.withValidator({ params, body: changeEventSchema })(async (
  c,
  { params: { id }, body },
) => {
  const [event] = await db.select().from(events).where(eq(events.id, id));
  if (!event) return c.notFound();
  if (!(await deleteKeyMatches(body.key, event.delete_key_hash)))
    return c.json({ message: "wrong key" }, 403);
  const taken = await booked(id);
  if (body.seats < taken) return c.json({ message: "fewer seats than are booked", taken }, 409);
  const times = when(body.local, body.local_end, body.time_zone);
  const venue = body.venue?.trim() || null;
  await db
    .update(events)
    .set({
      title: body.title,
      description: body.description,
      venue,
      seats: body.seats,
      ...times,
      updatedAt: sql`(datetime('now'))`,
    })
    .where(eq(events.id, id));
  await translateSoon("events", id);
  // What someone with a seat must know: what's on their ticket, and what gets them there.
  const was = {
    ...(event.starts_at !== times.starts_at ? { startsAt: event.starts_at } : {}),
    ...(event.ends_at !== times.ends_at ? { endsAt: event.ends_at } : {}),
    ...(event.venue !== venue ? { venue: event.venue } : {}),
  };
  if (Object.keys(was).length || event.title !== body.title) {
    const booked = await db.select().from(bookings).where(eq(bookings.event_id, id));
    // Where the change is made: the emails link back to the event's page there.
    const origin = new URL(c.req.url).origin;
    await Promise.all(
      booked.map((b) => queues.change.send({ bookingId: b.id, eventId: id, was, origin })),
    );
    if (booked.length) await storage.delete(booked.map((b) => ticketKey(b.id)));
  }
  await clearCache({ paths: eventPages(id) });
  await live.publish(eventTopic(id), {}, { type: "changed" });
});

// Void's named actions: booking on the page itself, changing on "?change", deleting on "?delete".
export const actions = { default: book, change, delete: remove };

// The event's own title and description, in the page's language where translated, and the event
// described for search engines (schema.org's Event, which Google shows as an event in results). Its
// start with its UTC offset and no zone name (schema.org's DateTime is ISO 8601), as Temporal
// writes it with timeZoneName "never". The text in the language it's shown in.
export const head = defineHead<Props>((c, { event, text }) => {
  const { locale, lang } = c.get("i18n");
  const shown = text ?? event;
  const data: WithContext<SchemaEvent> = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: shown.title,
    description: shown.description,
    startDate: Temporal.ZonedDateTime.from(event.starts_at).toString({ timeZoneName: "never" }),
    endDate: Temporal.ZonedDateTime.from(event.ends_at).toString({ timeZoneName: "never" }),
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    inLanguage: text ? locale : event.locale,
    url: `${siteOrigin(c)}/${lang}/events/${event.id}`,
    // Where it is, when the organiser said: the venue as they wrote it.
    ...(event.venue
      ? { location: { "@type": "Place", name: event.venue, address: event.venue } }
      : {}),
  };
  return {
    ...pageHead({ title: shown.title, description: shown.description }),
    script: [jsonLd(data)],
  };
});
