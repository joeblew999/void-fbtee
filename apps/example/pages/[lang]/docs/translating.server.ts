import { defineHandler, defineHead, type InferProps } from "void";
import { fbs } from "fbtee";
import { pageHead } from "void-fbtee/head";
import { langParams } from "void-fbtee/server";

// Cached until the next deploy, in every language (Void's prerendering, as the Intl page): the
// catalogs only change with a deploy.
export const prerender = true;
export const getPrerenderPaths = langParams;

export type Props = InferProps<typeof loader>;

type Catalog = Record<string, { status?: string; translations?: unknown[] }>;
// Every language's catalog, as the repository has it (the source language has none: its text is
// the code's). Read at build, on the server; only the counts reach the page.
const catalogs = import.meta.glob<Catalog>("../../../i18n/translations/*.json", {
  eager: true,
  import: "translations",
});

export const loader = defineHandler(() => ({
  catalogs: Object.entries(catalogs).map(([file, entries]) => {
    const all = Object.values(entries);
    return {
      locale: file.replace(/^.*\/(.+)\.json$/, "$1"),
      strings: all.length,
      // As void-fbtee's build check counts them (its catalogs.ts): what the dev server adds is "new" until it's
      // translated, and an entry with no translation isn't.
      translated: all.filter((e) => e.status !== "new" && e.translations?.length).length,
    };
  }),
}));

// The heading and the intro's own strings, so they're translated once.
export const head = defineHead(() =>
  pageHead({
    title: fbs.c("Translating"),
    description: fbs(
      "The app's own text and what people post are translated by the same AI, Gemini 4 Hydrogen through Void's AI: the text into files in the repository that you review, posts as they're posted. Claude Code translates what it leaves. Here is each, with the lines that do it.",
      "Translating page introduction",
    ),
  }),
);
