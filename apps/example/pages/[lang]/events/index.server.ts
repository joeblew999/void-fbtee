// Upcoming events (the loader), and posting one (the action). The action clears this list from
// Void's page cache in every language, then goes to the new event's page.
import { event_texts, events, newEventSchema, startsAt } from "@schema";
import { defineHandler, type InferProps } from "void";
import { and, asc, db, eq, gte } from "void/db";
import { queues } from "void/queues";
import { revalidate } from "void/isr";
import type { RouteUrl } from "void/routes";
import { localizedPaths, type SharedI18n } from "void-fbtee/middleware";

export type Props = InferProps<typeof loader>;

const i18n = (c: { get: (key: never) => unknown }) =>
  (c.get("shared" as never) as { i18n: SharedI18n }).i18n;

// Each event with its title in the page's language, where it has been translated.
export const loader = defineHandler(async (c) => {
  const { locale } = i18n(c);
  const rows = await db
    .select({ event: events, text: event_texts })
    .from(events)
    .leftJoin(event_texts, and(eq(event_texts.event_id, events.id), eq(event_texts.locale, locale)))
    .where(gte(events.starts_at_utc, new Date().toISOString()))
    .orderBy(asc(events.starts_at_utc));
  return { events: rows.map(({ event, text }) => ({ ...event, text })) };
});

export const action = defineHandler.withValidator({ body: newEventSchema })(async (c, { body }) => {
  const { locale } = i18n(c);
  const [created] = await db
    .insert(events)
    .values({
      title: body.title,
      description: body.description,
      seats: body.seats,
      locale,
      ...startsAt(body.local, body.time_zone),
    })
    .returning({ id: events.id });
  // Translated into the other languages after this (queues/translate.ts).
  await queues.translate.send({ eventId: created.id });
  await revalidate({ paths: localizedPaths("/events") as RouteUrl[] });
  return c.redirect({
    pathname: "/[lang]/events/[id]",
    params: { lang: c.req.param("lang")!, id: created.id },
  });
});
