// Upcoming events: only those not yet started, each with its title in the page's language where a
// translation is stored (the sample events), and its seats left. Posting one is its own page
// (new.server.ts), which clears this list.
import { bookings, event_texts, events } from "@schema";
import { defineHandler, defineHead, type InferProps } from "void";
import { fbs } from "fbtee";
import { pageHead } from "void-fbtee/head";
import { and, asc, count, db, eq, gte } from "void/db";

export type Props = InferProps<typeof loader>;

// Void's page cache keeps this list for 60 seconds: it lists only events not yet started, so it
// changes with time as well as with posts. Void serves the kept copy while it renders a new one,
// so no visitor waits. Posting clears it at once (new.server.ts); seats left here can be up to a
// minute behind (each event's own page has them live).
export const revalidate = 60;

export const loader = defineHandler(async (c) => {
  const { locale } = c.get("i18n");
  // Seats taken, per event, in the same query as the list.
  const taken = db
    .select({ event_id: bookings.event_id, n: count().as("n") })
    .from(bookings)
    .groupBy(bookings.event_id)
    .as("taken");
  const rows = await db
    .select({ event: events, text: event_texts, taken: taken.n })
    .from(events)
    .leftJoin(event_texts, and(eq(event_texts.event_id, events.id), eq(event_texts.locale, locale)))
    .leftJoin(taken, eq(taken.event_id, events.id))
    .where(gte(events.starts_at_utc, new Date().toISOString()))
    .orderBy(asc(events.starts_at_utc));
  return {
    events: rows.map(({ event, text, taken }) => ({
      ...event,
      text,
      left: Math.max(0, event.seats - (taken ?? 0)),
    })),
  };
});

export const head = defineHead(() =>
  pageHead({
    title: fbs("Upcoming events", "Heading of the events page"),
    description: fbs(
      "Events posted in any language, each on its own city's clock and on yours.",
      "Events page description, for search results",
    ),
  }),
);
