// SPIKE: the server decides "now" once and sends it, so server and browser render the same text.
import { defineHandler } from "void";
import type { InferProps } from "void";
import { Temporal } from "temporal-polyfill";

export type Props = InferProps<typeof loader>;

export const loader = defineHandler(() => ({
  now: Temporal.Now.instant().toString(),
  // A booking carries its place's time zone, so every viewer sees the venue's local time.
  booking: "2026-12-24T19:30:00+07:00[Asia/Bangkok]",
  birthday: "2026-04-15",
  length: "PT2H5M",
}));
