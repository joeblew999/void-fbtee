// The PDFs page's sample ticket as a picture of its page, at /samples/ticket-image/<language>: the
// same page as the PDF (routes/samples/ticket/[lang].ts), for phones that don't show a PDF inside
// a page. Made once per language and look and kept in R2, then cached for a day.
import { defineHandler } from "void";
import { z } from "zod";
import { locales } from "../../../src/locales";
import { printedResponse } from "../../../src/pdf";
import { sampleImage } from "../../../src/events/tickets";

export const GET = defineHandler.withValidator({ params: z.object({ lang: z.enum(locales) }) })(
  async (c, { params: { lang } }) =>
    (await printedResponse("picture", () => sampleImage(lang, c.env.BROWSER), {
      "content-type": "image/webp",
      "cache-control": "public, max-age=86400",
    })) ?? c.notFound(),
);
