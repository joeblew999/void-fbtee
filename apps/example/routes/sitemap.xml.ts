// The sitemap, at /sitemap.xml (Void drops only the `.ts`), made when it's asked for so it lists
// events posted since the deploy. void-fbtee's sitemap() lists every page in every language, by
// Google's rules (its comment, in void-fbtee/server); this adds the events and the dates things
// changed. Void's page cache keeps it until the next deploy (routing.revalidate in
// void.config.ts); posting an event clears it (new.server.ts).
import { event_texts, events } from "@schema";
import { defineHandler } from "void";
import { db, eq, max } from "void/db";
import { sitemap } from "void-fbtee/server";

/** SQLite's "2026-11-12 09:42:31" (UTC) as the W3C date-time the sitemap takes. */
const w3c = (sqlite: string) => `${sqlite.replace(" ", "T")}Z`;
const newest = (...dates: (string | null | undefined)[]) =>
  dates
    .filter((d): d is string => !!d)
    .sort()
    .at(-1);

export const GET = defineHandler(async (c) => {
  // Each event's last change: its own row, or a translation of it added later.
  const changed = await db
    .select({ id: events.id, at: events.updatedAt, text: max(event_texts.updatedAt) })
    .from(events)
    .leftJoin(event_texts, eq(event_texts.event_id, events.id))
    .groupBy(events.id);
  const eventDate = changed.map((e) => ({ id: e.id, date: w3c(newest(e.at, e.text)!) }));
  return sitemap(c, {
    pages: [
      // The events list changes when an event is posted or changes.
      { path: "/[lang]/events", lastmod: newest(...eventDate.map((e) => e.date)) },
      ...eventDate.map(({ id, date }) => ({
        path: "/[lang]/events/[id]" as const,
        params: { id },
        lastmod: date,
      })),
    ],
    // The posting form has nothing to find.
    exclude: ["/[lang]/events/new"],
  });
});
