import { defineHandler, type InferProps } from "void";
import { ownTemporal, Polyfill, runTemporal } from "../../../lib/temporal";

export type Props = InferProps<typeof loader>;

// Every row on the Worker, twice: with temporal-polyfill (what void-fbtee's code uses there), and
// with Cloudflare's own Temporal (the `temporal` compatibility flag), to show where it differs.
// Neutral results: no language.
export const loader = defineHandler(() => {
  const own = ownTemporal();
  return { worker: { polyfill: runTemporal(Polyfill), own: own ? runTemporal(own) : null } };
});
