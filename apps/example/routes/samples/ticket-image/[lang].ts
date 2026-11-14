// The PDFs page's sample ticket as a picture of its page, at /samples/ticket-image/<language>: the
// same page as the PDF (routes/samples/ticket/[lang].ts), for phones that don't show a PDF inside
// a page. Made once per language and look and kept in R2, then cached for a day.
import { defineHandler } from "void";
import { z } from "zod";
import { locales } from "../../../src/locales";
import { PrintError } from "../../../src/pdf";
import { sampleImage } from "../../../src/events/tickets";

export const GET = defineHandler.withValidator({ params: z.object({ lang: z.enum(locales) }) })(
  async (c, { params: { lang } }) => {
    let image: Uint8Array | undefined;
    try {
      image = await sampleImage(lang, new URL(c.req.url).origin, c.env.BROWSER);
    } catch (error) {
      if (!(error instanceof PrintError)) throw error;
      console.warn("sample ticket picture not made:", error.message);
      return c.text("The picture can't be made right now. Try again in a minute.", 503, {
        "retry-after": "60",
      });
    }
    if (!image) return c.notFound();
    return c.body(image.slice().buffer, 200, {
      "content-type": "image/webp",
      "cache-control": "public, max-age=86400",
    });
  },
);
