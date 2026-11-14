import { defineHead } from "void";
import { fbs } from "fbtee";
import { pageHead } from "void-fbtee/head";
import { langParams } from "void-fbtee/server";

// Cached until the next deploy, in every language (Void's prerendering, as the Intl page): the
// markdown pages it lists only change with a deploy.
export const prerender = true;
export const getPrerenderPaths = langParams;

// The heading and the intro's own strings, so they're translated once.
export const head = defineHead(() =>
  pageHead({
    title: fbs("Markdown pages", "Docs page title: the page about translated markdown pages"),
    description: fbs(
      "A page written in markdown has a copy in each language, translated whole. Here are this site's, and what it takes, with the lines that do it.",
      "Markdown page introduction",
    ),
  }),
);
