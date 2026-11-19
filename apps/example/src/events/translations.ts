// The events' text in a reader's language, and what the app does when a translation lands. The
// translating itself is the package's (plans/translated-content.md): db/schema/events_translations.ts
// says the events' title and description are translated, queues/translate.ts translates them,
// crons/translations.ts keeps them in the app's languages, and a page that shows an event not yet
// in its language isn't cached and queues it (void-fbtee's middleware). What's here is the app's
// own: which pages show an event, and telling open ones. Every type comes from the schema
// (src/content.ts).
import type { AppLocale } from "void-fbtee/locales";
import type { Translation } from "void-fbtee/content";
import { events, events_translations } from "@schema";
import { content } from "@/content";
import { primaryDb, type Db } from "@/db";
import { revalidate } from "void-fbtee/server";
import { tellBookers } from "./owed";
import { eventTopic, live } from "./live";

/** An event's translated fields: its title and description, as the schema types them. */
export type Text = (typeof events_translations.$inferSelect)["fields"];

/** An event's stored translation, as the package gives it. */
export type EventTranslation = Translation<Text>;

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
 * fallbacks), or all of them without `locale` (void-fbtee/content translationsFor).
 */
export const textsFor = (ids: string[], locale?: AppLocale, db?: Db) =>
  content.translationsFor(events, ids, locale, db);

/**
 * The event's title and description for a reader in `locale`, and the language they're in: the best
 * stored translation, or null to show the original as its organiser wrote it. A page that gets null
 * for an event in another language waits for its translation: void-fbtee's middleware keeps it out
 * of the page cache and queues it.
 */
export function textFor(
  event: { id: string; locale: string } & Text,
  texts: readonly EventTranslation[],
  locale: string,
  { note = true }: { note?: boolean } = {},
): (Text & { locale: string }) | null {
  const text = content.textOf(events, event, texts, locale, { note });
  if (!text.translated) return null;
  return { locale: text.locale, ...text.fields };
}

/**
 * The event's title for a reader in `locale`, and the language it's in: for an email, a ticket or
 * an action, so it asks for nothing (a page's loader uses textFor).
 */
export function titleFor(
  event: { id: string; locale: string } & Text,
  texts: readonly EventTranslation[],
  locale: string,
): { title: string; locale: string } {
  const text = textFor(event, texts, locale, { note: false });
  return { title: text?.title ?? event.title, locale: text?.locale ?? event.locale };
}

/**
 * A translation landed (queues/translate.ts): the event's pages leave Void's page cache in every
 * language, its open pages are told to load their data again, and its bookers in that language who
 * are owed a change email are sent it now, with the title in their language (src/events/owed.ts;
 * the next step of the change action, plans/reliable-work.md).
 */
export async function onTranslated(_table: string, id: string, locale: string) {
  await revalidate({ paths: eventPages(id) });
  await live.publish(eventTopic(id), {}, { type: "translated" });
  await tellBookers(primaryDb(), id, [locale]);
}

/**
 * Translating the event into these languages failed this time (Gemini erring, the account not
 * paying; queues/translate.ts tries again): its bookers in them who are owed a change email aren't
 * kept waiting for it, and get the title as written. If the translation lands later, they're owed
 * nothing more.
 */
export async function onTranslationFailed(_table: string, id: string, locales: string[]) {
  await tellBookers(primaryDb(), id, locales);
}
