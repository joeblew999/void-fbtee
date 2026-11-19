// One event, by its id, with its seats left (the loader); booking a seat (the page's action); and,
// for whoever posted it, changing it and deleting it (with the key from their private link).
import { bookSchema, changeEventSchema, when } from "@schema";
import { defineHandler, defineHead, type InferProps } from "void";
import { queues } from "void/queues";
import { storage } from "void/storage";
import { z } from "zod";
import type { Event as SchemaEvent, WithContext } from "schema-dts";
import { Temporal } from "temporal-polyfill";
import { jsonLd, pageHead } from "void-fbtee/head";
import { routeUrl } from "void-fbtee/routes";
import { revalidate as clearCache, siteOrigin } from "void-fbtee/server";
import { deleteKeyMatches } from "../../../src/events/delete-key";
import { ticketKey } from "../../../src/events/tickets";
import { eventTopic, live } from "../../../src/events/live";
import { eventPages, textFor, textsFor } from "../../../src/events/translations";
import { translateSoon, untranslated } from "void-fbtee/content";
import { primaryDb } from "void-fbtee/db";
import { tellBookers } from "../../../src/events/owed";
import {
  bookerLocales,
  bookingExists,
  bookingsOf,
  bookSeat,
  cancelEvent,
  deleteIfDone,
  eventById,
  eventOn,
  seatsTaken,
  updateEvent,
} from "../../../src/events/store";

export type Props = InferProps<typeof loader>;

// Void's page cache keeps each event's page for a minute. A booking, a change or a delete clears it
// at once, in every language (the actions), and open pages hear of it live (src/events/live.ts).
// Not longer: on the app's own Cloudflare account Void's clear reaches KV (other places see the old
// page for 60 s or more) and only the data centre that clears it, and a page being built when the
// event changed can be written back after the clear (void/isr and @void/isr, Void 1.8.0 and 1.10.0;
// plans/reliable-work.md). A minute bounds whatever the cache keeps by mistake. A page in a language
// the event isn't translated into yet isn't cached, and its translation is queued (void-fbtee's
// middleware, from textFor in the loader).
export const revalidate = 60;

// The page's URL parameter: /<lang>/events/<id>. Whether it's an event is the database's answer:
// an id that isn't one gets the not-found page (the loader) or a 404 (booking).
const params = z.object({ id: z.string() });

// The event, its title and description in the page's language where a translation is stored (else
// its fallbacks', else as its organiser wrote it: textFor), seats left,
// and whether it can be deleted (a posted event, not a sample). Never its delete key's hash: the
// page and its data are public, and cached. Read from the database's main copy (void-fbtee/db), as
// the cache keeps what this returns; one session for all its reads (plans/layout.md). A cancelled
// event is gone to its readers: the not-found page.
export const loader = defineHandler.withValidator({ params })(async (c, { params: { id } }) => {
  const { locale } = c.get("i18n");
  const db = primaryDb();
  const row = await eventOn(db, id);
  if (!row) return c.notFound();
  const { delete_key_hash, ...event } = row;
  const text = textFor(event, await textsFor([id], locale, db), locale);
  return {
    event,
    text,
    left: event.seats - (await seatsTaken(db, id)),
    deletable: !!delete_key_hash,
  };
});

/** Booking a seat: the page's own action (a POST to the page). */
const book = defineHandler.withValidator({ params, body: bookSchema })(async (
  c,
  { params: { id }, body },
) => {
  const { locale } = c.get("i18n");
  // Where this booking is being made (dev, a Worker Preview, live): its emails link back here.
  const origin = new URL(c.req.url).origin;
  const db = primaryDb();
  // The booking's id comes from the form (bookSchema): one that's taken is refused, not a crash.
  if (await bookingExists(db, body.id)) return c.json({ message: "booking id taken" }, 400);
  // Only while the event is on and has a seat left, in one statement (bookSeat); what the booker
  // is told (told_*) is the event as it is then: their confirmation says it (src/events/owed.ts).
  const booked = await bookSeat(db, {
    id: body.id,
    event_id: id,
    name: body.name,
    email: body.email,
    locale,
    time_zone: body.time_zone,
    origin,
    ticket_in_reminder: !!body.ticket_in_reminder,
  });
  // Nothing went in: the event is full, or there's no such event (or it's cancelled).
  if (!booked) return (await eventOn(db, id)) ? c.json({ message: "sold out" }, 409) : c.notFound();
  const event = (await eventById(db, id))!;
  const left = event.seats - (await seatsTaken(db, id));
  // This event's page, in every language (the list shows each event's seats, not what's left).
  await clearCache({ paths: [`/[lang]/events/${id}`] });
  await live.publish(eventTopic(id), { left }, { type: "seats" });
  // The confirmation, in the booker's language, with its PDF ticket, after this answers
  // (queues/ticket.ts): printing takes up to a second. Owed until it's sent (confirmed_at): a lost
  // message is found by the sweep (crons/owed.ts).
  await queues.ticket.send({ bookingId: body.id });
  // No return: Void reruns the loader, so the page shows the new count.
});

/**
 * Deleting the event, with the key from the poster's private link (src/events/delete-key.ts). It's
 * marked cancelled (events.cancelled_at), so from now its pages are gone and it can't be booked or
 * changed; each booker is sent a cancellation in their own language (queues/cancel.ts, so this
 * answers at once however many booked), which then deletes their booking and its PDF ticket; the
 * event and its translations go with the last (at once when nobody booked). Until then the database
 * itself says who still needs telling (plans/reliable-work.md). Its pages leave the cache in every
 * language, with the list and the sitemap; pages open on it hear "deleted" (src/events/live.ts) and
 * say it's cancelled; and the browser goes to the list. A wrong key is a 403.
 */
const remove = defineHandler.withValidator({ params, body: z.object({ key: z.string().min(1) }) })(
  async (c, { params: { id }, body }) => {
    const db = primaryDb();
    const event = await eventOn(db, id);
    if (!event) return c.notFound();
    if (!(await deleteKeyMatches(body.key, event.delete_key_hash)))
      return c.json({ message: "wrong key" }, 403);
    await cancelEvent(db, id);
    // Everyone who booked, read after the event is marked: a booking can't go in once it is
    // (bookSeat), so none is missed.
    const booked = await bookingsOf(db, id);
    await Promise.all(booked.map((b) => queues.cancel.send({ bookingId: b.id })));
    await deleteIfDone(db, id);
    await clearCache({ paths: eventPages(id) });
    await live.publish(eventTopic(id), {}, { type: "deleted" });
    return c.redirect(routeUrl("/[lang]/events"));
  },
);

/**
 * Changing the event, with the key from the poster's private link: its title, description, place,
 * start and end, and seats (never fewer than are booked: a 409). Its language stays the one it was
 * written in. Then, one step starting the next (plans/reliable-work.md): it's translated again
 * (void-fbtee's translateSoon: its translations no longer match what it says); bookers whose
 * language needs no new translation (the event's own, or a change of time or place only) are sent
 * their change email now, and the others when their language's translation is stored or fails
 * (src/events/translations.ts onTranslated, onTranslationFailed), so their email has the new title
 * in their language (queues/change.ts, which also lets their PDF ticket be printed again). Its
 * pages leave the cache in every language, with the list and the sitemap; and pages open on it hear
 * "changed" and load it again. No return: Void reruns the loader, so the page shows the change. A
 * wrong key is a 403.
 */
const change = defineHandler.withValidator({ params, body: changeEventSchema })(async (
  c,
  { params: { id }, body },
) => {
  const db = primaryDb();
  const event = await eventOn(db, id);
  if (!event) return c.notFound();
  if (!(await deleteKeyMatches(body.key, event.delete_key_hash)))
    return c.json({ message: "wrong key" }, 403);
  const taken = await seatsTaken(db, id);
  if (body.seats < taken) return c.json({ message: "fewer seats than are booked", taken }, 409);
  const times = when(body.local, body.local_end, body.time_zone);
  const venue = body.venue?.trim() || null;
  await updateEvent(db, id, {
    title: body.title,
    description: body.description,
    venue,
    seats: body.seats,
    ...times,
  });
  await translateSoon("events", id, { changed: true }, db);
  // Stored PDF tickets show the title, start, end and place: when one changed they go, so the next
  // download prints the new ones.
  if (
    event.title !== body.title ||
    event.starts_at !== times.starts_at ||
    event.ends_at !== times.ends_at ||
    event.venue !== venue
  ) {
    const ids = await bookingsOf(db, id);
    if (ids.length) await storage.delete(ids.map((b) => ticketKey(b.id)));
  }
  // Languages still waiting for their translation are told when it lands (or fails); the rest now.
  const waiting = (await untranslated("events", id, db))?.missing ?? [];
  const now = [...new Set(await bookerLocales(db, id))].filter((l) => !waiting.includes(l));
  if (now.length) await tellBookers(db, id, now);
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
