// One event, by its id, with its seats left (the loader), and booking a seat (the action).
import { bookings, bookSchema, event_texts, events } from "@schema";
import { defineHandler, defineHead, type InferProps } from "void";
import { and, count, db, eq, inArray, sql } from "void/db";
import { z } from "zod";
import type { Event as SchemaEvent, WithContext } from "schema-dts";
import { Temporal } from "temporal-polyfill";
import { jsonLd, pageHead } from "void-fbtee/head";
import { routeUrl } from "void-fbtee/routes";
import { pickText, revalidate as clearCache, siteOrigin, textLocales } from "void-fbtee/server";
import { sendBookingEmail } from "../../../src/events/booking-email";
import { deleteKeyMatches } from "../../../src/events/delete-key";
import { eventTopic, live } from "../../../src/events/live";

export type Props = InferProps<typeof loader>;

// Void's page cache keeps each event's page until the next deploy (a year, the longest it
// allows): only a booking changes it, and booking clears it at once, in every language (the
// action). Open pages get the new seats-left count live as well (src/events/live.ts).
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
// its fallbacks', else as its organiser wrote it: pickText from void-fbtee/server), seats left,
// and whether it can be deleted (a posted event, not a sample). Never its delete key's hash: the
// page and its data are public, and cached.
export const loader = defineHandler.withValidator({ params })(async (c, { params: { id } }) => {
  const { locale } = c.get("i18n");
  const [row] = await db.select().from(events).where(eq(events.id, id));
  if (!row) return c.notFound();
  const { delete_key_hash, ...event } = row;
  const texts = await db
    .select()
    .from(event_texts)
    .where(and(eq(event_texts.event_id, id), inArray(event_texts.locale, textLocales(locale))));
  const text = pickText(texts, locale) ?? null;
  return { event, text, left: event.seats - (await booked(id)), deletable: !!delete_key_hash };
});

/** Booking a seat: the page's own action (a POST to the page). */
const book = defineHandler.withValidator({ params, body: bookSchema })(async (
  c,
  { params: { id }, body },
) => {
  const { locale } = c.get("i18n");
  // One statement, so two people can't take the last seat: the row goes in only while the event
  // has fewer bookings than seats. D1 runs each statement on the primary, one at a time.
  const result = await db.run(sql`
    INSERT INTO ${bookings} (id, event_id, name, email, locale, time_zone)
    SELECT ${crypto.randomUUID()}, ${id}, ${body.name}, ${body.email}, ${locale}, ${body.time_zone}
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
  // The confirmation, in the booker's language (the one they booked in, kept with the booking),
  // with the event's title as they read it.
  const texts = await db
    .select()
    .from(event_texts)
    .where(and(eq(event_texts.event_id, id), inArray(event_texts.locale, textLocales(locale))));
  const text = pickText(texts, locale);
  await sendBookingEmail(body.email, {
    locale,
    name: body.name,
    title: text?.title ?? event.title,
    titleLocale: text?.locale ?? event.locale,
    startsAt: event.starts_at,
    url: siteOrigin(c) + routeUrl("/[lang]/events/[id]", { params: { id } }),
  });
  // No return: Void reruns the loader, so the page shows the new count.
});

/**
 * Deleting the event, with the key from the poster's private link (src/events/delete-key.ts): its
 * bookings, translations and itself, together, then its pages leave the cache in every language,
 * with the list and the sitemap, and the browser goes to the list. A wrong key is a 403.
 */
const remove = defineHandler.withValidator({ params, body: z.object({ key: z.string().min(1) }) })(
  async (c, { params: { id }, body }) => {
    const [event] = await db
      .select({ hash: events.delete_key_hash })
      .from(events)
      .where(eq(events.id, id));
    if (!event) return c.notFound();
    if (!(await deleteKeyMatches(body.key, event.hash)))
      return c.json({ message: "wrong key" }, 403);
    await db.batch([
      db.delete(bookings).where(eq(bookings.event_id, id)),
      db.delete(event_texts).where(eq(event_texts.event_id, id)),
      db.delete(events).where(eq(events.id, id)),
    ]);
    await clearCache({ paths: [`/[lang]/events/${id}`, "/[lang]/events", "/sitemap.xml"] });
    return c.redirect(routeUrl("/[lang]/events"));
  },
);

// Void's named actions: booking on the page itself, deleting on "?delete".
export const actions = { default: book, delete: remove };

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
