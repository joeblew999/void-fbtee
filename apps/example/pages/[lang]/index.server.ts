import { defineHandler, defineHead, defer } from "void";
import { fbs } from "fbtee";
import type { InferProps } from "void";

export type Props = InferProps<typeof loader>;

export const loader = defineHandler(async () => {
  return {
    count: 3,
    // Resolves after the shell has been sent, so it renders after next() returned.
    late: defer(async () => {
      await new Promise((r) => setTimeout(r, 300));
      return { count: 1 };
    }),
  };
});

// The tab's title and the search result's text, in the page's language (head() runs inside
// void-fbtee's per-request state, after the loader). The title is the heading's own string.
export const head = defineHead(() => ({
  title: String(fbs("i18n for Void apps", "Home page heading")),
  meta: [
    {
      name: "description",
      content: String(
        fbs(
          "An example Void app in three languages: events to post and book, and docs on how it's done.",
          "Home page description, for search results",
        ),
      ),
    },
  ],
}));
