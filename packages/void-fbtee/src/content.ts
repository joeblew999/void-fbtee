// Translations of what people write in the app's tables (plans/translated-content.md): which rows
// lack which of the app's languages, storing a translation with who made it, asking for one (once
// an hour at most), keeping every table in the app's languages both ways, and reading a row in the
// reader's language.
//
// Which tables, and which of their fields: voidFbtee({ content }), handed over in
// virtual:void-fbtee/config. Each table's translations are in `<table>_translations`, the one shape
// translationsOf() makes (void-fbtee/db/schema). A table of content has a text `id` and a `locale`
// column, the language the row was written in (`vp build` checks both).
//
// Asking for a translation is recorded in that table, a "queued" row for the language, and asked
// again only when that's more than an hour old: a page read many times while it waits, posting,
// and the daily job all ask through it, so a row is paid for once, not once per view.
//
// The SQL is db/translations.ts's. Each function here takes the database session to use, from the
// handler calling it (primaryDb()), so all of a page's or a job's reads share one: one trip to D1's
// main copy. Without one, it opens its own.
import config from "virtual:void-fbtee/config";
import { queues } from "void/queues";
import { primaryDb, type Db } from "./db";
import {
  contentRow,
  deleteOtherLanguages,
  markAsked,
  namedTranslations,
  rowsShortOf,
  translationRows,
  upsertTranslation,
} from "./db/translations";
import { notePending } from "./content-pending";
import { fingerprint } from "./fingerprint";
import type { Spent } from "./models";
import { textLocales } from "./server";
import type { RuntimeConfig } from "./runtime";

/** A table's fields to translate (voidFbtee({ content })). */
export interface ContentTable {
  fields: string[];
}

/** voidFbtee({ content }) as the runtime has it: every table, with its fields. */
export function contentTables(
  c: Pick<RuntimeConfig, "content"> = config,
): Map<string, ContentTable> {
  return new Map(Object.entries(c.content ?? {}));
}

function tableOf(table: string): ContentTable {
  const found = contentTables().get(table);
  if (!found) throw new Error(`void-fbtee: "${table}" isn't in voidFbtee({ content })`);
  return found;
}

const appLocales = () => config.locales.map((l) => l.locale);

/** One row of content: its id, the language it was written in, and its fields. */
export interface Source {
  id: string;
  locale: string;
  fields: Record<string, string>;
}

/**
 * What a translation of a row's fields is made from, as its fingerprint (fingerprint.ts): the
 * fields, in the table's order (voidFbtee({ content })), as JSON. Kept with the translation
 * (`translated_from`); a row changed since no longer matches, and is translated again.
 */
export const fieldsFingerprint = (fields: Record<string, string>) =>
  fingerprint(JSON.stringify(fields));

/** Whether a stored translation was made from what the row says now: one with no fingerprint was
 * made before they were kept, and counts as current. */
const current = (from: string | null | undefined, now: string) => !from || from === now;

/**
 * A row, its fingerprint, and the app's languages it has no current translation in: none, or one
 * nobody can name ("unknown"), or only asked for ("queued"), or made from what the row said before
 * it was changed. All are translated, and replaced, by storeTranslation. Undefined when the row is
 * gone.
 */
export async function untranslated(
  table: string,
  id: string,
  db: Db = primaryDb(),
): Promise<{ source: Source; from: string; missing: string[] } | undefined> {
  const { fields } = tableOf(table);
  const row = await contentRow(db, table, fields, id);
  if (!row) return;
  const source: Source = {
    id: row.id!,
    locale: row.locale!,
    fields: Object.fromEntries(fields.map((f) => [f, row[f] ?? ""])),
  };
  const from = fieldsFingerprint(source.fields);
  const have = (await namedTranslations(db, table, id))
    .filter((r) => current(r.translated_from, from))
    .map((r) => r.locale);
  return {
    source,
    from,
    missing: appLocales().filter((l) => l !== row.locale && !have.includes(l)),
  };
}

/**
 * Who made a translation: the model's id, or "claude", or a person; its AI Gateway log; what it
 * cost; and the fingerprint of the row's fields it was made from (untranslated's `from`).
 */
export interface Made {
  by: string;
  gatewayLogId?: string;
  usage?: Spent;
  from?: string;
}

/**
 * Stores a row's translation into `locale`, with who made it. A stored translation is kept, unless
 * nobody can say who made it ("unknown"), it was only asked for ("queued"), or it was made from
 * what the row said before it was changed: that one is replaced. Resolves true when it was stored.
 */
export async function storeTranslation(
  table: string,
  id: string,
  locale: string,
  fields: Record<string, string>,
  made: Made,
  db: Db = primaryDb(),
): Promise<boolean> {
  return upsertTranslation(db, table, {
    source_id: id,
    locale,
    fields: Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v.trim()])),
    translatedBy: made.by,
    translatedAt: new Date().toISOString().slice(0, 10),
    gatewayLogId: made.gatewayLogId ?? null,
    usage: made.usage ?? null,
    translatedFrom: made.from ?? null,
  });
}

/** The queue every translation goes through: the app's `queues/translate.ts`. */
export type TranslateMessage = { table: string; id: string };

/**
 * Asks for a row's translation into the app's languages it lacks (untranslated): marks each
 * "queued" (or, for an "unknown" one or one made before the row was changed, as asked, keeping it
 * to show meanwhile) and sends one message, unless every one was asked for in the last hour (then
 * nothing: it's on its way, or the daily job asks again). Resolves whether it was sent. Call it
 * when a post is made, and with `{ changed: true }` when it's just been changed: then it asks at
 * once, whatever was asked or stored in the last hour (its translations were likely stored
 * minutes ago). A row read in a language it lacks, or whose translation is out of date, is asked
 * for then too (the middleware), and the daily job finds any missing.
 */
export async function translateSoon(
  table: string,
  id: string,
  { changed = false }: { changed?: boolean } = {},
  db: Db = primaryDb(),
): Promise<boolean> {
  const found = await untranslated(table, id, db);
  if (!found?.missing.length) return false;
  let asked = 0;
  for (const locale of found.missing)
    // New: a "queued" row. There already (queued, an "unknown" translation, or one made before
    // the row changed): asked again only when its last asking is over an hour old. A current
    // translation someone can name isn't missing.
    if (await markAsked(db, table, id, locale, found.from, changed)) asked++;
  if (!asked) return false;
  await (
    queues as unknown as Record<string, { send(m: TranslateMessage): Promise<void> }>
  ).translate!.send({ table, id });
  return true;
}

/**
 * Every table of content kept to the app's languages, both ways: translations into a language the
 * app no longer has are deleted, and every row missing one of its languages, or with an "unknown"
 * one, is asked for (translateSoon: not one asked for in the last hour). Counted in the database,
 * one query a table. The daily job's work (void-fbtee/crons/translations).
 */
export async function reconcile(
  db: Db = primaryDb(),
): Promise<{ deleted: number; queued: number }> {
  const locales = appLocales();
  let deleted = 0;
  let queued = 0;
  for (const table of contentTables().keys()) {
    deleted += await deleteOtherLanguages(db, table, locales);
    for (const id of await rowsShortOf(db, table, locales))
      if (await translateSoon(table, id, {}, db)) queued++;
  }
  return { deleted, queued };
}

/** A stored translation, as the read helpers give it. */
export interface Translation {
  source_id: string;
  locale: string;
  fields: Record<string, string>;
  /** The fingerprint of the row's fields it was made from (fieldsFingerprint); none if older. */
  from?: string | null;
}

/**
 * The stored translations of these rows: those a page in `locale` can show (it and its fallbacks),
 * or all of them without `locale`. Only ones someone can name: "unknown" ones are being replaced,
 * "queued" ones are only asked for. Any number of ids (asked for 90 at a time, under D1's limit).
 */
export async function translationsFor(
  table: string,
  ids: string[],
  locale?: string,
  db: Db = primaryDb(),
): Promise<Translation[]> {
  tableOf(table);
  const wanted = locale ? new Set(textLocales(locale)) : undefined;
  return (await translationRows(db, table, ids))
    .filter((r) => !wanted || wanted.has(r.locale))
    .map((r) => ({
      source_id: r.source_id,
      locale: r.locale,
      fields: r.fields,
      from: r.translated_from,
    }));
}

/**
 * A row's fields for a reader in `locale`, and the language they're in: the first of the reader's
 * language and its fallbacks (textLocales) the row is in, as written or translated; else the
 * original. When the reader's own language is one the app has and the row isn't in it yet, or its
 * translation was made before the row was changed (shown meanwhile), the request notes it
 * (content-pending.ts): the middleware keeps the page out of Void's page cache and asks for the
 * translation. Call it from a page's loader; with `{ note: false }` (an email, an
 * action) it notes nothing. `translations` may hold other rows' too.
 */
export function textOf(
  table: string,
  row: { id: string; locale: string },
  translations: readonly Translation[],
  locale: string,
  { note = true }: { note?: boolean } = {},
): { fields: Record<string, string>; locale: string; translated: boolean } {
  const { fields } = tableOf(table);
  const mine = translations.filter((t) => t.source_id === row.id);
  const original = () => ({
    fields: Object.fromEntries(
      fields.map((f) => {
        const value = (row as Record<string, unknown>)[f];
        return [f, typeof value === "string" ? value : ""];
      }),
    ),
    locale: row.locale,
    translated: false,
  });
  // Not yet in the reader's own language, or out of date there: the page waits for it.
  if (note && row.locale !== locale && appLocales().includes(locale)) {
    const now = fieldsFingerprint(original().fields);
    if (!mine.some((t) => t.locale === locale && current(t.from, now))) notePending(table, row.id);
  }
  for (const l of textLocales(locale)) {
    if (l === row.locale) return original();
    const found = mine.find((t) => t.locale === l);
    if (found) return { fields: found.fields, locale: found.locale, translated: true };
  }
  return original();
}
