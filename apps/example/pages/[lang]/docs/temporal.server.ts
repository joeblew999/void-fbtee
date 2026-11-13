import { defineHandler, defineHead, type InferProps } from "void";
import { fbs } from "fbtee";
import { pageHead } from "void-fbtee/head";
import { ownTemporal, Polyfill, runTemporal } from "@/docs/temporal";
import { langParams } from "void-fbtee/middleware";

// Cached until the next deploy, in every language (Void's prerendering: a one-year cache time,
// and a deploy clears the cache). Void's own platform also builds it during the deploy; deployed
// straight to Cloudflare, as here, the first visit after a deploy builds it. Only a deploy
// changes this page (every row is a fixed date).
export const prerender = true;
export const getPrerenderPaths = langParams;

export type Props = InferProps<typeof loader>;

// Every row on the Worker, twice: with Cloudflare's own Temporal (the `temporal` compatibility
// flag: what the app's code runs there), and with temporal-polyfill, to compare. Neutral
// results: no language.
export const loader = defineHandler(() => {
  const own = ownTemporal();
  return { worker: { polyfill: runTemporal(Polyfill), own: own ? runTemporal(own) : null } };
});

// The intro's own string as the description, so it's translated once.
export const head = defineHead(() =>
  pageHead({
    title: "Temporal",
    description: fbs(
      "Temporal does the arithmetic on dates and times. Each result is a neutral value, not text for the screen, so it must come out the same everywhere. Each row ran on the Worker with Cloudflare's own Temporal, which this app uses there, and with the temporal-polyfill package, and again in your browser: with its own Temporal, and with the polyfill. A highlighted row is a real bug, and its columns show whose.",
      "Temporal page introduction",
    ),
  }),
);
