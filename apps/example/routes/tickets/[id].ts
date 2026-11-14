// A booking's PDF ticket, at /tickets/<booking id>: kept in R2, or printed now if the queue that
// emails it hasn't yet (src/events/tickets.ts). The id is a random UUID, so only whoever booked has
// the address (the event's page shows it to them after booking). Shown in the browser, saved as
// ticket.pdf; private to that person, so no shared cache keeps it and search engines don't list it.
import { defineHandler } from "void";
import { z } from "zod";
import { PrintError } from "../../src/pdf";
import { ticketPdf } from "../../src/events/tickets";

export const GET = defineHandler.withValidator({ params: z.object({ id: z.uuid() }) })(async (
  c,
  { params: { id } },
) => {
  let pdf: Uint8Array | undefined;
  try {
    pdf = await ticketPdf(id, c.env.BROWSER);
  } catch (error) {
    if (!(error instanceof PrintError)) throw error;
    console.warn("ticket not printed:", error.message);
    return c.text("The ticket can't be printed right now. Try again in a minute.", 503, {
      "retry-after": "60",
    });
  }
  if (!pdf) return c.notFound();
  return c.body(pdf.slice().buffer, 200, {
    "content-type": "application/pdf",
    "content-disposition": 'inline; filename="ticket.pdf"',
    "cache-control": "private, max-age=3600",
    "x-robots-tag": "noindex",
  });
});
