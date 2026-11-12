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
          "How void-fbtee translates a Void app: setup, strings, markdown pages, and the platform's Intl and Temporal.",
          "Docs index description, for search results",
        ),
      ),
    },
  ],
}));
