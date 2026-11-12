import { defineHandler, type InferProps } from "void";
import { ownTemporal, Polyfill, runTemporal } from "@/lib/temporal";

export type Props = InferProps<typeof loader>;

// Every row on the Worker, twice: with Cloudflare's own Temporal (the `temporal` compatibility
// flag: what the app's code runs there), and with temporal-polyfill, to compare. Neutral
// results: no language.
export const loader = defineHandler(() => {
  const own = ownTemporal();
  return { worker: { polyfill: runTemporal(Polyfill), own: own ? runTemporal(own) : null } };
});
