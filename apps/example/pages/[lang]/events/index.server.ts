// Upcoming events (the loader), and posting one (the action). The action clears this list from
// Void's page cache in every language, then goes to the new event's page.
import { event_texts, events, newEventSchema, startsAt } from "@schema";
import { defineHandler, type InferProps } from "void";
import { and, asc, db, eq, gte } from "void/db";
import { queues } from "void/queues";
import { revalidate } from "void/isr";
import { localizedPaths } from "void-fbtee/middleware";
import { z } from "zod";

export type Props = InferProps<typeof loader>;

// Each event with its title in the page's language, where it has been translated.
export const loader = defineHandler(async (c) => {
  const { locale } = c.get("i18n");
  const rows = await db
    .select({ event: events, text: event_texts })
    .from(events)
    .leftJoin(event_texts, and(eq(event_texts.event_id, events.id), eq(event_texts.locale, locale)))
    .where(gte(events.starts_at_utc, new Date().toISOString()))
    .orderBy(asc(events.starts_at_utc));
  // The zones the form offers: the Worker's, as it checks them. Engines list different ones (Safari
  // keeps old names too), so the browser doesn't make its own list.
  return {
    events: rows.map(({ event, text }) => ({ ...event, text })),
    zones: Intl.supportedValuesOf("timeZone"),
  };
});

export const action = defineHandler.withValidator({
  params: z.object({ lang: z.string() }),
  body: newEventSchema,
})(async (c, { params, body }) => {
  const { locale } = c.get("i18n");
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
  await revalidate({ paths: localizedPaths("/events") });
  return c.redirect({
    pathname: "/[lang]/events/[id]",
    params: { lang: params.lang, id: created.id },
  });
});
