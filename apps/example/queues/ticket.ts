// A booking's confirmation with its PDF ticket, after the booking has answered: the booking action
// (pages/[lang]/events/[id].server.ts) sends the booking's id. Printing takes up to a second and
// Browser Run allows 3 browsers at once on the free plan, so it's done here, where a failure is
// retried (Void's guide/queues.md), not while the booker waits. One message per batch, so a failed
// print retries only its own booking.
//
// If the ticket still can't be printed on the last try, the email goes without it: nobody is left
// without a confirmation, and the event's page offers the ticket for download, printed then.
import { defineQueue } from "void";
import { sendBookingEmail } from "../src/events/emails";
import { bookingTicket, ticketPdf } from "../src/events/tickets";

type Message = { bookingId: string };

/** Tries before the email goes without its ticket: the first and two retries, a minute apart (within
 * Void's default of 3 retries). */
const TRIES = 3;

export const maxBatchSize = 1;

export default defineQueue<Message>(async (batch, env) => {
  for (const message of batch.messages) {
    const booking = await bookingTicket(message.body.bookingId);
    // The event was deleted since: its cancellation has gone instead (queues/cancel.ts).
    if (!booking) {
      message.ack();
      continue;
    }
    let ticket: Uint8Array | undefined;
    try {
      ticket = await ticketPdf(message.body.bookingId, env.BROWSER);
    } catch (error) {
      if (message.attempts < TRIES) {
        console.warn("ticket not printed, retrying:", String(error));
        message.retry({ delaySeconds: 60 });
        continue;
      }
      console.warn("ticket not printed, emailing without it:", String(error));
    }
    if (await sendBookingEmail(booking.email, { ...booking.ticket, ticket })) message.ack();
    else message.retry({ delaySeconds: 60 });
  }
});
