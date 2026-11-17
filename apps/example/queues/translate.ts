// Translates a newly posted event's title and description into the app's other languages, after the
// post (new.server.ts sends the message). The same consumer everywhere (Void's guide/queues.md),
// with Void's AI everywhere too: on Cloudflare, and in dev and the preview through Void's
// Cloudflare sign-in (guide/ai.md, "Local Development"; the preview needs the binding marked
// remote in void.config.ts). A failure is retried. In dev, a post can
// be translated again through Void's queue trigger, `POST /__void/queue` (the README shows it).
//
// The translator is void-fbtee's own (void-fbtee/ai), the same one `vp dev` translates the app's
// strings and pages with: its model and why are there.
import { defineQueue } from "void";
import "void/ai";
import { translate as translateText } from "void-fbtee/ai";
import { storeTranslations, untranslated, type Text } from "../src/events/translations";

type Message = { eventId: string };

// Void connects its AI when the app's own files import void/ai (Void reads the app's files, not
// its packages), so this file names it, above.
const translate = (text: Text, from: string, to: string): Promise<Text> =>
  translateText(text, { from, to, about: "listings for events" });

export default defineQueue<Message>(async (batch) => {
  for (const message of batch.messages) {
    const [event] = await untranslated(message.body.eventId);
    if (!event) {
      message.ack();
      continue;
    }
    try {
      const done: Record<string, Text> = {};
      for (const locale of event.missing)
        // Only the text: the event's other fields (its id, the languages it lacks) aren't to be
        // translated, and sent along they come back as more of the answer.
        done[locale] = await translate(
          { title: event.title, description: event.description },
          event.locale,
          locale,
        );
      await storeTranslations(event.id, done);
      message.ack();
    } catch (error) {
      // Deleted while it was being translated: its translations can't go in (the database's
      // foreign key refuses them), and there's nothing left to translate.
      const [still] = await untranslated(message.body.eventId);
      if (!still) {
        message.ack();
        continue;
      }
      // D1's own reason is the error's cause; Drizzle's message only names the query.
      const cause = (error as { cause?: unknown }).cause;
      console.warn(
        "translation failed, retried:",
        String(error),
        cause instanceof Error ? cause.message : "",
      );
      message.retry();
    }
  }
});
