// Translates a newly posted event's title and description into the app's other languages, after the
// post (new.server.ts sends the message). The same consumer everywhere (Void's guide/queues.md),
// with Workers AI everywhere too: on Cloudflare, and in dev and the preview through Void's
// Cloudflare sign-in (guide/ai.md, "Local Development"; the preview needs the binding marked
// remote in void.config.ts). A failure is retried. In dev, a post can
// be translated again through Void's queue trigger, `POST /__void/queue` (the README shows it).
//
// Model: @cf/meta/llama-3.3-70b-instruct-fp8-fast, chosen over @cf/meta/m2m100-1.2b (Workers AI's
// translation model) on 2026-11-13: on the 5 sample events, title and description into every
// language they're stored in, its mean chrF against the stored translations was 53.0 against 29.6,
// better in 14 of 16 (the stored ones were written by Claude, so this leans toward a text model;
// plans/quiet-harbor-atlas.md, 7b).
import { defineQueue } from "void";
import { ai } from "void/ai";
import { storeTranslations, untranslated, type Text } from "../src/events/translations";

type Message = { eventId: string };

const MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const name = (locale: string) => new Intl.DisplayNames("en", { type: "language" }).of(locale);

async function translate(text: Text, from: string, to: string): Promise<Text> {
  const result = await ai.run(MODEL, {
    messages: [
      {
        role: "system",
        content:
          "You translate listings for events. Translate naturally, the way a local would write " +
          "it; keep names of people and places. Reply with JSON only: " +
          '{"title": "...", "description": "..."}.',
      },
      { role: "user", content: `From ${name(from)} into ${name(to)}:\n${JSON.stringify(text)}` },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        type: "object",
        properties: { title: { type: "string" }, description: { type: "string" } },
        required: ["title", "description"],
      },
    },
  });
  // Workers AI has answered in both shapes: its own ({ response }) and OpenAI's ({ choices }).
  const r = result as { response?: unknown; choices?: { message?: { content?: unknown } }[] };
  const answer = r.response ?? r.choices?.[0]?.message?.content;
  const parsed = (typeof answer === "string" ? JSON.parse(answer) : answer) as Text;
  return { title: parsed.title, description: parsed.description };
}

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
        done[locale] = await translate(event, event.locale, locale);
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
