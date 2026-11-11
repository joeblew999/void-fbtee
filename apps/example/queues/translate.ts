// Translate a newly posted event's title and description into the app's other languages, with
// Workers AI, after the post (made by `void gen queue translate`). Each translation is stored in
// event_texts; then the event's pages leave Void's page cache, and open pages are told to reload
// their data (live). Model: @cf/meta/llama-3.3-70b-instruct-fp8-fast, listed by this account's
// Workers AI on 2026-11-11 (chosen over @cf/meta/m2m100-1.2b for natural Thai and Arabic).
import { event_texts, events } from "@schema";
import { defineQueue } from "void";
import { ai } from "void/ai";
import { db, eq } from "void/db";
import { revalidate } from "void/isr";
import type { RouteUrl } from "void/routes";
import { appLocales, localizedPaths } from "void-fbtee/middleware";
import { eventTopic, live } from "../src/live";

type Message = { eventId: string };

const MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const name = (locale: string) => new Intl.DisplayNames("en", { type: "language" }).of(locale);

async function translate(text: { title: string; description: string }, from: string, to: string) {
  const result = await ai.run(MODEL, {
    messages: [
      {
        role: "system",
        content:
          "You translate listings for events. Translate naturally, the way a local would write " +
          "it; keep names of people and places. Reply with JSON only: " +
          '{"title": "...", "description": "..."}.',
      },
      {
        role: "user",
        content: `From ${name(from)} into ${name(to)}:\n${JSON.stringify(text)}`,
      },
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
  const answer = (result as { response?: unknown }).response;
  const parsed = (typeof answer === "string" ? JSON.parse(answer) : answer) as typeof text;
  return { title: parsed.title.trim(), description: parsed.description.trim() };
}

export default defineQueue<Message>(async (batch) => {
  for (const message of batch.messages) {
    const [event] = await db.select().from(events).where(eq(events.id, message.body.eventId));
    if (!event) {
      message.ack();
      continue;
    }
    for (const locale of appLocales().filter((l) => l !== event.locale)) {
      const text = await translate(event, event.locale, locale);
      await db
        .insert(event_texts)
        .values({ event_id: event.id, locale, ...text })
        .onConflictDoNothing();
    }
    await revalidate({
      paths: [...localizedPaths(`/events/${event.id}`), ...localizedPaths("/events")] as RouteUrl[],
    });
    await live.publish(eventTopic(event.id), {}, { type: "translated" });
    message.ack();
  }
});
