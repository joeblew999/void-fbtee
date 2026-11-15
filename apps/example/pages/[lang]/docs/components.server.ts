import { defineHead } from "void";
import { fbs } from "fbtee";
import { pageHead } from "void-fbtee/head";
import { langParams } from "void-fbtee/server";

// Cached until the next deploy, in every language (Void's prerendering, as the other reference
// pages): only a deploy changes it.
export const prerender = true;
export const getPrerenderPaths = langParams;

export const head = defineHead(() =>
  pageHead({
    title: fbs.c("Components"),
    description: fbs(
      "Everything void-fbtee gives an app's pages, from void-fbtee/react: its components and hooks, what each is for, each at work, and the line that uses it.",
      "Components page introduction",
    ),
  }),
);
