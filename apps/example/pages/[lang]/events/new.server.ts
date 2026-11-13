// Posting an event: the zones the form offers (the loader), and saving it (the action). The action
// clears the list of events from Void's page cache in every language, then goes to the new event's
// page. A static segment beats `[id]` in Void's routing, so /events/new is never read as an id.
import { events, newEventSchema, startsAt } from "@schema";
import { defineHandler, defineHead, type InferProps } from "void";
import { fbs } from "fbtee";
import { pageHead } from "void-fbtee/head";
import { db } from "void/db";
import { queues } from "void/queues";
import { routeUrl } from "void-fbtee/routes";
import { langParams, revalidate } from "void-fbtee/server";
import { z } from "zod";
import { locales } from "@/locales";

// Cached until the next deploy, in every language (Void's prerendering: a one-year cache time,
// and a deploy clears the cache). Void's own platform also builds it during the deploy; deployed
// straight to Cloudflare, as here, the first visit after a deploy builds it. Only a deploy
// changes this page (the form and the Worker's list of time zones are fixed; posting is a POST, never cached).
export const prerender = true;
export const getPrerenderPaths = langParams;

export type Props = InferProps<typeof loader>;

// The zones the form offers: the Worker's, as it checks them. Engines list different ones (Safari
// keeps old names too), so the browser doesn't make its own list.
export const loader = defineHandler(() => ({ zones: Intl.supportedValuesOf("timeZone") }));

export const action = defineHandler.withValidator({
  // One of the app's languages (the middleware has already sent any other to the not-found page).
  params: z.object({ lang: z.enum(locales) }),
  body: newEventSchema,
})(async (c, { body }) => {
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
  // Its translations into the app's other languages, after this answers (queues/translate.ts).
  await queues.translate.send({ eventId: created.id });
  // The list in every language, and the sitemap, which lists the new event.
  await revalidate({ paths: ["/[lang]/events", "/sitemap.xml"] });
  return c.redirect(routeUrl("/[lang]/events/[id]", { params: { id: created.id } }));
});

export const head = defineHead(() =>
  pageHead({
    title: fbs("Post an event", "Heading of the form for posting a new event"),
    description: fbs(
      "Post an event in your own language, on your city's clock; everyone sees it on their own.",
      "Post-an-event page description, for search results",
    ),
  }),
);
