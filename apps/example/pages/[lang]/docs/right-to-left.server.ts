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
    title: fbs.c("Right to left"),
    description: fbs(
      "Every language gets its own address, and Arabic reads right to left: the whole site mirrors. Here is the same markup both ways round, and what it takes, with the lines that do it.",
      "Right-to-left page introduction",
    ),
  }),
);
