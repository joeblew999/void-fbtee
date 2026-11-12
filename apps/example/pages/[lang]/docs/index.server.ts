// The docs index's title and description, in the page's language.
import { defineHead } from "void";
import { fbs } from "fbtee";

export const head = defineHead(() => ({
  title: String(fbs("Documentation", "Docs index heading")),
  meta: [
    {
      name: "description",
      content: String(
        fbs(
          "void-fbtee at work: the platform's Intl and Temporal in every language, and the events demo.",
          "Docs index description, for search results",
        ),
      ),
    },
  ],
}));
