import { defineHandler, defineHead, type InferProps } from "void";
import { fbs } from "fbtee";
import { ownTemporal, Polyfill, runTemporal } from "@/lib/temporal";

export type Props = InferProps<typeof loader>;

// Every row on the Worker, twice: with Cloudflare's own Temporal (the `temporal` compatibility
// flag: what the app's code runs there), and with temporal-polyfill, to compare. Neutral
// results: no language.
export const loader = defineHandler(() => {
  const own = ownTemporal();
  return { worker: { polyfill: runTemporal(Polyfill), own: own ? runTemporal(own) : null } };
});

// The intro's own string as the description, so it's translated once.
export const head = defineHead(() => ({
  title: "Temporal",
  meta: [
    {
      name: "description",
      content: String(
        fbs(
          "Temporal does the arithmetic on dates and times. Each result is a neutral value, not text for the screen, so it must come out the same everywhere. Each row ran on the Worker with Cloudflare's own Temporal, which this app uses there, and with the temporal-polyfill package, and again in your browser: with its own Temporal, and with the polyfill. A highlighted row is a real bug, and its columns show whose.",
          "Temporal page introduction",
        ),
      ),
    },
  ],
}));
