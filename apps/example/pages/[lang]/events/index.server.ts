// Upcoming events: only those not yet started, each with its title in the page's language where a
// translation is stored (the sample events), and its seats left. Posting one is its own page
// (new.server.ts), which clears this list.
import { defineHandler, defineHead, type InferProps } from "void";
import { fbs } from "fbtee";
import { pageHead } from "void-fbtee/head";
import { primaryDb } from "void-fbtee/db";
import { upcoming } from "../../../src/events/store";
import { textFor, textsFor } from "../../../src/events/translations";

export type Props = InferProps<typeof loader>;

// Void's page cache keeps this list for 60 seconds: it lists only events not yet started, so it
// changes with time as well as with posts. Void serves the kept copy while it renders a new one,
// so no visitor waits. Posting clears it at once (new.server.ts); seats left here can be up to a
// minute behind (each event's own page has them live). While an event in it isn't translated into
// the page's language yet, the list isn't cached, and the translation is queued (textFor, and
// void-fbtee's middleware).
export const revalidate = 60;

// Read from the database's main copy (void-fbtee/db), as the cache keeps what this returns: a
// replica behind would cache the list from before a post, a change or a delete.
export const loader = defineHandler(async (c) => {
  const { locale } = c.get("i18n");
  // One session for its reads (plans/layout.md); seats taken come with the list, in one query.
  const db = primaryDb();
  const rows = await upcoming(db);
  // Their stored translations for this page (the page's language and its fallbacks), and for each
  // the best (textFor).
  const ids = rows.map((r) => r.event.id);
  const texts = await textsFor(ids, locale, db);
  return {
    events: rows.map(({ event, taken }) => ({
      ...event,
      text: textFor(event, texts, locale),
      left: Math.max(0, event.seats - taken),
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
