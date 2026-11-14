// The PDFs page's sample ticket, at /samples/ticket/<language>: Laila's seat at the calligraphy
// evening, made by the app's own ticket code (src/events/tickets.ts), printed once per language and
// look and kept in R2, then cached in the browser and at the edge for a day.
import { defineHandler } from "void";
import { z } from "zod";
import { locales } from "../../../src/locales";
import { printedResponse } from "../../../src/pdf";
import { samplePdf } from "../../../src/events/tickets";

export const GET = defineHandler.withValidator({ params: z.object({ lang: z.enum(locales) }) })(
  async (c, { params: { lang } }) =>
    (await printedResponse("sample", () => samplePdf(lang, c.env.BROWSER), {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="ticket-${lang}.pdf"`,
      "cache-control": "public, max-age=86400",
      "x-robots-tag": "noindex",
    })) ?? c.notFound(),
);
