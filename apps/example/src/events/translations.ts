// Translations of what people post, made by Workers AI in the translate queue (queues/translate.ts).
// Each is stored beside the original (event_texts), then the event's pages leave Void's page cache
// in every language, and its open pages are told to load their data again (live).
import { event_texts, events } from "@schema";
import { db, eq } from "void/db";
import { appLocales, revalidate } from "void-fbtee/server";
import { eventTopic, live } from "./live";

export type Text = { title: string; description: string };

/** An event's original, and the app's languages it has no translation in yet. */
export async function untranslated(eventId: string) {
  const list = await db.select().from(events).where(eq(events.id, eventId));
  const texts = await db
    .select({ event_id: event_texts.event_id, locale: event_texts.locale })
    .from(event_texts)
    .where(eq(event_texts.event_id, eventId));
  return list
    .map((e) => ({
      id: e.id,
      locale: e.locale,
      title: e.title,
      description: e.description,
      missing: appLocales().filter(
        (l) => l !== e.locale && !texts.some((t) => t.event_id === e.id && t.locale === l),
      ),
    }))
    .filter((e) => e.missing.length);
}

/** Stores an event's text in `locale` (once: a stored translation is kept), then its pages refresh. */
export async function storeTranslations(eventId: string, translations: Record<string, Text>) {
  const locales = Object.keys(translations);
  if (!locales.length) return;
  for (const [locale, text] of Object.entries(translations))
    await db
      .insert(event_texts)
      .values({
        event_id: eventId,
        locale,
        title: text.title.trim(),
        description: text.description.trim(),
      })
      .onConflictDoNothing();
  await revalidate({ paths: [`/[lang]/events/${eventId}`, "/[lang]/events", "/sitemap.xml"] });
  await live.publish(eventTopic(eventId), {}, { type: "translated" });
}
