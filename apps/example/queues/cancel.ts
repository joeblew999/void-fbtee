// Tells everyone who booked a deleted event that it's cancelled, each in their own language (the
// language they booked in). The delete action (pages/[lang]/events/[id].server.ts) sends one message
// per booking, with what the email needs, before the rows are gone; so the delete answers at once
// however many booked, and a failed email is retried on its own (Void's guide/queues.md).
import { defineQueue } from "void";
import { sendCancellationEmail } from "../src/events/emails";

type Message = { to: string } & Parameters<typeof sendCancellationEmail>[1];

export default defineQueue<Message>(async (batch) => {
  for (const message of batch.messages) {
    const { to, ...booking } = message.body;
    if (await sendCancellationEmail(to, booking)) message.ack();
    else message.retry({ delaySeconds: 60 });
  }
});
