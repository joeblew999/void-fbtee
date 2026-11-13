// Dev only (the .dev suffix: Void serves it on the dev server and leaves it out of every build):
// the posts still waiting for a translation, and a way to store them. Locally there's no Workers
// AI (void.config.ts), so the queue leaves each new post as written (queues/translate.ts), and
// Claude translates them here, as it translates the app's own strings:
//   GET  /api/translations   each event with the languages it's missing
//   POST /api/translations   { eventId, translations: { "th-TH": { title, description }, … } }
// Stored as the queue stores them (src/events/translations.ts).
import { defineHandler } from "void";
import { z } from "zod";
import { storeTranslations, untranslated } from "../../src/events/translations";
import { appLocales } from "void-fbtee/server";

const text = z.object({ title: z.string().trim().min(1), description: z.string().trim().min(1) });

export const GET = defineHandler(async () => ({ events: await untranslated() }));

export const POST = defineHandler.withValidator({
  body: z.object({
    eventId: z.string(),
    translations: z.partialRecord(z.enum(appLocales() as [string, ...string[]]), text),
  }),
})(async (c, { body }) => {
  const [event] = await untranslated(body.eventId);
  if (!event) return c.json({ message: "nothing to translate for that event" }, 404);
  await storeTranslations(event.id, body.translations as Record<string, z.infer<typeof text>>);
  return { stored: Object.keys(body.translations) };
});
