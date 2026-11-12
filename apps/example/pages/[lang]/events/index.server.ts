// Upcoming events: only those not yet started, each with its title in the page's language where a
// translation is stored (the sample events). Posting one is its own page (new.server.ts), which clears this list.
import { event_texts, events } from "@schema";
import { defineHandler, defineHead, type InferProps } from "void";
import { fbs } from "fbtee";
import { and, asc, db, eq, gte } from "void/db";

export type Props = InferProps<typeof loader>;

export const loader = defineHandler(async (c) => {
  const { locale } = c.get("i18n");
  const rows = await db
    .select({ event: events, text: event_texts })
    .from(events)
    .leftJoin(event_texts, and(eq(event_texts.event_id, events.id), eq(event_texts.locale, locale)))
    .where(gte(events.starts_at_utc, new Date().toISOString()))
    .orderBy(asc(events.starts_at_utc));
  return {
    events: rows.map(({ event, text }) => ({ ...event, text })),
  };
});

export const head = defineHead(() => ({
  title: String(fbs("Upcoming events", "Heading of the events page")),
  meta: [
    {
      name: "description",
      content: String(
        fbs(
          "Events posted in any language, each on its own city's clock and on yours.",
          "Events page description, for search results",
        ),
      ),
    },
  ],
}));
