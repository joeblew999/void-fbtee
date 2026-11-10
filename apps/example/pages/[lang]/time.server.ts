// SPIKE: Temporal values in the data. "Now" comes from the middleware (shared.i18n.now).
import { defineHandler } from "void";
import type { InferProps } from "void";

export type Props = InferProps<typeof loader>;

export const loader = defineHandler(() => ({
  // A booking carries its place's time zone, so every viewer sees the venue's local time.
  booking: "2026-12-24T19:30:00+07:00[Asia/Bangkok]",
  birthday: "2026-04-15",
  length: "PT2H5M",
}));
