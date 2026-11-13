// Void's docs examples, as a developer writes them, with their text translated: a loader
// (guide/pages-routing/loaders.md) and head() (guide/pages-routing/head.md, "Page titles and
// metadata"). Both run inside the request's language, so they need nothing more from the app.
import { defineHandler, defineHead, type InferProps } from "void";
import { fbs } from "fbtee";

export type Props = InferProps<typeof loader>;

export const loader = defineHandler((c) => ({ locale: c.get("i18n").locale }));

export const head = defineHead(() => {
  const description = fbs(
    "An example Void app in three languages: events to post and book, and docs on how it's done.",
    "Home page description, for search results",
  );
  return {
    title: fbs("i18n for Void apps", "Home page heading"),
    meta: [{ name: "description", content: description }],
  };
});
