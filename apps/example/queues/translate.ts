// Translates a newly posted event's title and description into the app's other languages, after the
// post (new.server.ts sends the message). The same consumer everywhere (Void's guide/queues.md):
// on Cloudflare it asks Workers AI; locally, where Workers AI is off (void.config.ts), it finds AI
// "Not available" and leaves the post as written, for Claude to translate
// (routes/api/translations.dev.ts). Both store through src/events/translations.ts.
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

const unavailable = (error: unknown) => String(error).includes("ai: Not available");

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
      // Locally: no Workers AI, so the post waits for Claude. Anything else: Cloudflare retries it.
      if (unavailable(error)) message.ack();
      else message.retry();
    }
  }
});
