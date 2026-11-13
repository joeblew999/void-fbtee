import { defineHandler, defineHead, type InferProps } from "void";
import { fbs } from "fbtee";
import { pageHead } from "void-fbtee/head";
import { runAll } from "@/docs/intl";
import { langParams } from "void-fbtee/server";

// Cached until the next deploy, in every language (Void's prerendering: a one-year cache time,
// and a deploy clears the cache). Void's own platform also builds it during the deploy; deployed
// straight to Cloudflare, as here, the first visit after a deploy builds it. Only a deploy
// changes this page (every row is a fixed call).
export const prerender = true;
export const getPrerenderPaths = langParams;

export type Props = InferProps<typeof loader>;

// Every row, run on the Worker with its own Intl, in the page's language.
export const loader = defineHandler((c) => {
  const { locale } = c.get("i18n");
  return { worker: runAll(locale) };
});

// The intro's own string as the description, so it's translated once.
export const head = defineHead(() =>
  pageHead({
    title: "Intl",
    description: fbs(
      "Each row is one call to the platform's own Intl, in this page's language. The Worker ran it before sending the page: that's the text this app's pages show. Your browser ran it again with its own engine.",
      "Intl page introduction",
    ),
  }),
);
