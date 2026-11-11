// Upcoming events (the loader), and posting one (the action). The action clears this list from
// Void's page cache in every language, then goes to the new event's page.
import { events, newEventSchema, startsAt } from "@schema";
import { defineHandler, type InferProps } from "void";
import { asc, db, gte } from "void/db";
import { revalidate } from "void/isr";
import type { RouteUrl } from "void/routes";
import { localizedPaths, type SharedI18n } from "void-fbtee/middleware";

export type Props = InferProps<typeof loader>;

const i18n = (c: { get: (key: never) => unknown }) =>
  (c.get("shared" as never) as { i18n: SharedI18n }).i18n;

export const loader = defineHandler(async () => ({
  events: await db
    .select()
    .from(events)
    .where(gte(events.starts_at_utc, new Date().toISOString()))
    .orderBy(asc(events.starts_at_utc)),
}));

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
  await revalidate({ paths: localizedPaths("/events") as RouteUrl[] });
  return c.redirect({
    pathname: "/[lang]/events/[id]",
    params: { lang: c.req.param("lang")!, id: created.id },
  });
});
