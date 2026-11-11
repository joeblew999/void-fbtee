// "Format on the server": the formats page posts what the visitor typed, written their language's
// way, and the Worker reads it back as a plain number and formats it again with its own Intl.
// The validator is the route's input type; the page calls it with Void's typed fetch.
import { defineHandler } from "void";
import { z } from "zod";
import { parseNumber } from "../../lib/parse-number";
import { tryIt } from "../../lib/try-it";

export const POST = defineHandler.withValidator({
  body: z.object({
    // A language tag Intl accepts, such as "th-TH" (Intl throws on a malformed one).
    locale: z.string().refine((l) => {
      try {
        return Intl.NumberFormat.supportedLocalesOf(l).length > 0;
      } catch {
        return false;
      }
    }),
    number: z.string().max(100),
    text: z.string().max(1000),
  }),
})((c, { body }) => tryIt(body.locale, parseNumber(body.locale, body.number), body.text));
