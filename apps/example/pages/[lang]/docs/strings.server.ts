import { defineHead } from "void";
import { fbs } from "fbtee";
import { pageHead } from "void-fbtee/head";
import { langParams } from "void-fbtee/server";

// Cached until the next deploy, in every language (Void's prerendering, as the Intl page): only
// a deploy changes it.
export const prerender = true;
export const getPrerenderPaths = langParams;

// The heading and the intro's own strings, so they're translated once.
export const head = defineHead(() =>
  pageHead({
    title: fbs("Strings", "Docs page title: the page about translated strings"),
    description: fbs(
      "Every word on this site is marked in the code with fbtee, and each language has a catalog file with its translations. Here is what that takes, with the lines that do it.",
      "Strings page introduction",
    ),
  }),
);
