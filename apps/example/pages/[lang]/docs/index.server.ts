// The docs index's title and description, in the page's language.
import { defineHead } from "void";
import { fbs } from "fbtee";
import { langParams } from "void-fbtee/middleware";

// Cached until the next deploy, in every language (Void's prerendering: a one-year cache time,
// and a deploy clears the cache). Void's own platform also builds it during the deploy; deployed
// straight to Cloudflare, as here, the first visit after a deploy builds it. Only a deploy
// changes this page (its text is fixed).
export const prerender = true;
export const getPrerenderPaths = langParams;

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
