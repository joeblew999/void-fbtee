// Posting an event: the zones the form offers (the loader), and saving it (the action). The action
// clears the list of events from Void's page cache in every language, then goes to the new event's
// page. A static segment beats `[id]` in Void's routing, so /events/new is never read as an id.
import { events, newEventSchema, startsAt } from "@schema";
import { defineHandler, defineHead, type InferProps } from "void";
import { fbs } from "fbtee";
import { db } from "void/db";
import { revalidate } from "void/isr";
import { localizedPaths } from "void-fbtee/middleware";
import { z } from "zod";
import { locales } from "@/locales";

export type Props = InferProps<typeof loader>;

// The zones the form offers: the Worker's, as it checks them. Engines list different ones (Safari
// keeps old names too), so the browser doesn't make its own list.
export const loader = defineHandler(() => ({ zones: Intl.supportedValuesOf("timeZone") }));

export const action = defineHandler.withValidator({
  // One of the app's languages (the middleware has already sent any other to the not-found page).
  params: z.object({ lang: z.enum(locales) }),
  body: newEventSchema,
})(async (c, { params, body }) => {
  const { locale } = c.get("i18n");
  const [created] = await db
    .insert(events)
    .values({
      title: body.title,
      description: body.description,
      seats: body.seats,
      venue: body.venue || null,
      locale,
      ...startsAt(body.local, body.time_zone),
    })
    .returning({ id: events.id });
  await revalidate({ paths: localizedPaths("/events") });
  return c.redirect({
    pathname: "/[lang]/events/[id]",
    params: { lang: params.lang, id: created.id },
  });
});

export const head = defineHead(() => ({
  title: String(fbs("Post an event", "Heading of the form for posting a new event")),
  meta: [
    {
      name: "description",
      content: String(
        fbs(
          "Post an event in your own language, on your city's clock; everyone sees it on their own.",
          "Post-an-event page description, for search results",
        ),
      ),
    },
  ],
}));
