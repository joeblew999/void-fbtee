// "Format on the server": the formats page posts the number the visitor typed, already read back
// to a plain number in the browser (neutral data, never formatted text), and the Worker formats
// it with its own Intl. null is a number that didn't read.
// The validator is the route's input type; the page calls it with Void's typed fetch.
import { defineHandler } from "void";
import { z } from "zod";
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
    number: z.number().nullable(),
    text: z.string().max(1000),
  }),
})((c, { body }) => tryIt(body.locale, body.number ?? NaN, body.text));
