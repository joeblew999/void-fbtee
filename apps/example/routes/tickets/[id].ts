// A booking's PDF ticket, at /tickets/<booking id>: kept in R2, or printed now if the queue that
// emails it hasn't yet (src/events/tickets.ts). The id is a random UUID, so only whoever booked has
// the address (the event's page shows it to them after booking). Shown in the browser, saved as
// ticket.pdf; private to that person, so no shared cache keeps it and search engines don't list it.
import { defineHandler } from "void";
import { z } from "zod";
import { printedResponse } from "../../src/pdf";
import { ticketPdf } from "../../src/events/tickets";

export const GET = defineHandler.withValidator({ params: z.object({ id: z.uuid() }) })(
  async (c, { params: { id } }) =>
    (await printedResponse("ticket", () => ticketPdf(id, c.env.BROWSER), {
      "content-type": "application/pdf",
      "content-disposition": 'inline; filename="ticket.pdf"',
      "cache-control": "private, max-age=3600",
      "x-robots-tag": "noindex",
    })) ?? c.notFound(),
);
