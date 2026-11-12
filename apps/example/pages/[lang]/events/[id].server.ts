// One event, by its id, with its seats left (the loader), and booking a seat (the action).
import { bookings, bookSchema, event_texts, events } from "@schema";
import { defineHandler, type InferProps } from "void";
import { and, count, db, eq, sql } from "void/db";
import { revalidate } from "void/isr";
import { localizedPaths } from "void-fbtee/middleware";
import { eventTopic, live } from "../../../src/live";

export type Props = InferProps<typeof loader>;

const booked = (id: string) =>
  db
    .select({ n: count() })
    .from(bookings)
    .where(eq(bookings.event_id, id))
    .then(([row]) => row.n);

// The event, its title and description in the page's language where translated, seats left.
export const loader = defineHandler(async (c) => {
  const id = c.req.param("id")!;
  const { locale } = c.get("i18n");
  const [event] = await db.select().from(events).where(eq(events.id, id));
  if (!event) return c.notFound();
  const [text] = await db
    .select()
    .from(event_texts)
    .where(and(eq(event_texts.event_id, id), eq(event_texts.locale, locale)));
  return { event, text: text ?? null, left: event.seats - (await booked(id)) };
});

export const action = defineHandler.withValidator({ body: bookSchema })(async (c, { body }) => {
  const id = c.req.param("id")!;
  const { locale } = c.get("i18n");
  // One statement, so two people can't take the last seat: the row goes in only while the event
  // has fewer bookings than seats. D1 runs each statement on the primary, one at a time.
  const result = await db.run(sql`
    INSERT INTO ${bookings} (id, event_id, name, email, locale, time_zone)
    SELECT ${crypto.randomUUID()}, ${id}, ${body.name}, ${body.email}, ${locale}, ${body.time_zone}
    WHERE (SELECT COUNT(*) FROM ${bookings} WHERE event_id = ${id})
        < (SELECT seats FROM ${events} WHERE id = ${id})`);
  if (!result.meta.changes) return c.json({ message: "sold out" }, 409);
  const [event] = await db.select({ seats: events.seats }).from(events).where(eq(events.id, id));
  const left = event.seats - (await booked(id));
  // This event's page, in every language (the list shows each event's seats, not what's left).
  await revalidate({ paths: localizedPaths(`/events/${id}`) });
  await live.publish(eventTopic(id), { left }, { type: "seats" });
  // No return: Void reruns the loader, so the page shows the new count.
});
