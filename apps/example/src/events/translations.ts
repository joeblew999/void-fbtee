// The events' text in a reader's language, and what the app does when a translation lands. The
// translating itself is the package's (plans/translated-content.md): voidFbtee({ content }) names
// the events' title and description, queues/translate.ts translates them, crons/translations.ts
// keeps them in the app's languages, and a page that shows an event not yet in its language isn't
// cached and queues it (void-fbtee's middleware). What's here is the app's own: which pages show
// an event, and telling open ones.
import type { AppLocale } from "void-fbtee/locales";
import { textOf, translationsFor, type Translation } from "void-fbtee/content";
import { primaryDb } from "void-fbtee/db";
import { revalidate } from "void-fbtee/server";
import { tellBookers } from "./owed";
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
 * fallbacks), or all of them without `locale` (void-fbtee/content translationsFor).
 */
export const textsFor = (ids: string[], locale?: AppLocale) =>
  translationsFor("events", ids, locale);

/**
 * The event's title and description for a reader in `locale`, and the language they're in: the best
 * stored translation, or null to show the original as its organiser wrote it. A page that gets null
 * for an event in another language waits for its translation: void-fbtee's middleware keeps it out
 * of the page cache and queues it.
 */
export function textFor(
  event: { id: string; locale: string },
  texts: readonly Translation[],
  locale: string,
  { note = true }: { note?: boolean } = {},
): (Text & { locale: string }) | null {
  const text = textOf("events", event, texts, locale, { note });
  if (!text.translated) return null;
  return {
    locale: text.locale,
    title: text.fields.title ?? "",
    description: text.fields.description ?? "",
  };
}

/**
 * The event's title for a reader in `locale`, and the language it's in: for an email, a ticket or
 * an action, so it asks for nothing (a page's loader uses textFor).
 */
export function titleFor(
  event: { id: string; title: string; locale: string },
  texts: readonly Translation[],
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
