// Translations of what people post, made by Workers AI in the translate queue (queues/translate.ts).
// Each is stored beside the original (event_texts), then the event's pages leave Void's page cache
// in every language, and its open pages are told to load their data again (live). Until then, a
// page in a language it isn't in yet isn't cached at all (awaitsTranslation).
import { event_texts, events } from "@schema";
import { and, db, eq, inArray } from "void/db";
import type { AppLocale } from "void-fbtee/locales";
import { appLocales, pickText, revalidate, textLocales } from "void-fbtee/server";
import { eventTopic, live } from "./live";

export type Text = { title: string; description: string };

/**
 * The pages that show an event, to clear from Void's page cache when it changes: its own page (with
 * `id`), the list, and the sitemap.
 */
export const eventPages = (id?: string): Parameters<typeof revalidate>[0]["paths"] => [
  ...(id ? ([`/[lang]/events/${id}`] as const) : []),
  "/[lang]/events",
  "/sitemap.xml",
];

/**
 * The stored translations of these events: those a page in `locale` can show (it and its
 * fallbacks, textLocales from void-fbtee/server), or all of them without `locale`.
 */
export async function textsFor(ids: string[], locale?: AppLocale) {
  if (!ids.length) return [];
  const ofThese = inArray(event_texts.event_id, ids);
  return await db
    .select()
    .from(event_texts)
    .where(locale ? and(ofThese, inArray(event_texts.locale, textLocales(locale))) : ofThese);
}

/**
 * The event's title for someone reading in `locale`, and the language it's in: the best stored
 * translation (pickText), else the original. `texts` may hold other events' too.
 */
export function titleFor(
  event: { id: string; title: string; locale: string },
  texts: readonly { event_id: string; title: string; locale: string }[],
  locale: string,
): { title: string; locale: string } {
  const text = pickText(
    texts.filter((t) => t.event_id === event.id),
    locale,
  );
  return { title: text?.title ?? event.title, locale: text?.locale ?? event.locale };
}

/**
 * Whether a page in `locale` shows an event still waiting for its translation into that language:
 * it was written in another one, and none of the stored texts is in `locale`. Such a page isn't
 * kept in Void's page cache (`x-revalidate: 0`, guide/edge/revalidation.md, "Per-response TTL
 * override"), so the cache never holds an event in the wrong language: the first visit after the
 * translation is stored caches the finished page. Clearing the cache when it lands
 * (storeTranslations) then only has older copies to clear, and nothing waits on it.
 */
export const awaitsTranslation = (
  written: string,
  texts: readonly { locale: string }[],
  locale: string,
) => written !== locale && !texts.some((t) => t.locale === locale);

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
  await revalidate({ paths: eventPages(eventId) });
  await live.publish(eventTopic(eventId), {}, { type: "translated" });
}
