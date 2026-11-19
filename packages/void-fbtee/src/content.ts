// Translations of what people write in the app's tables (plans/translated-content.md,
// plans/types-from-schema.md): which rows lack which of the app's languages, storing a translation
// with who made it, asking for one (once an hour at most), keeping every table in the app's
// languages both ways, and reading a row in the reader's language.
//
// The app hands over its schema, its database session and its translate queue, once, in a file of
// its own:
//
//   // src/content.ts
//   import * as schema from "@schema";
//   import { queues } from "void/queues";
//   import { translatedContent, type TranslateQueue } from "void-fbtee/content";
//   import { primaryDb } from "./db";
//   export const content = translatedContent(schema, {
//     db: primaryDb,
//     // Typed by Void from queues/translate.ts. Annotated: that file uses `content`, so without it
//     // the two types would depend on each other.
//     queue: (): TranslateQueue => queues.translate,
//   });
//
// Which tables are translated, and which fields: the `<table>_translations` tables in that schema,
// each beside its `<export>_fields` list (`void-fbtee gen translations` writes both, db/schema.ts).
// Everything is typed from them: `content.textOf(events, …)` gives the events' title and
// description as their own types, and a table with no translations doesn't compile.
//
// Asking for a translation is recorded in that table, a "queued" row for the language, and asked
// again only when that's more than an hour old: a page read many times while it waits, posting,
// and the daily job all ask through it, so a row is paid for once, not once per view.
//
// The SQL is db/translations.ts's. Each function takes the database session to use, from the
// handler calling it, so all of a page's or a job's reads share one: one trip to D1's main copy.
// Without one, it opens its own (the `db` the app handed over).
//
// Nothing in this file is cast. A value read at run time (a row, a stored translation) becomes the
// app's type only through isFields, which checks it first.
import config from "virtual:void-fbtee/config";
import {
  contentRow,
  deleteOtherLanguages,
  markAsked,
  namedTranslations,
  rowsShortOf,
  translationRows,
  upsertTranslation,
  type Db,
} from "./db/translations";
import { contentEntries, type ContentEntry } from "./db/schema";
import { notePending } from "./content-pending";
import { fingerprint } from "./fingerprint";
import type { Spent } from "./models";
import { textLocales } from "./server";

export type { Db } from "./db/translations";

type NameOf<T> = T extends { _: { name: infer N extends string } } ? N : never;

/** The translations table of `T` in the schema `S`: the one named `<T's name>_translations`. */
export type TranslationsOf<S, T> = {
  [K in keyof S]: S[K] extends { _: { name: `${NameOf<T>}_translations` } } ? S[K] : never;
}[keyof S];

/** The app's tables of content: those in its schema with a translations table, an id and a language. */
export type ContentTable<S> = {
  [K in keyof S]: S[K] extends { _: { name: string }; $inferSelect: { id: string; locale: string } }
    ? [TranslationsOf<S, S[K]>] extends [never]
      ? never
      : S[K]
    : never;
}[keyof S];

/** A table's translated fields, as its translations table types them: { title: string; … }. */
export type FieldsOf<S, T> =
  TranslationsOf<S, T> extends { $inferSelect: { fields: infer F } } ? F : never;

/** One row of content: its id, the language it was written in, and its fields. */
export interface Source<F = Record<string, string>> {
  id: string;
  locale: string;
  fields: F;
}

/**
 * What a translation of a row's fields is made from, as its fingerprint (fingerprint.ts): the
 * fields, in the table's order (its `_fields` list), as JSON. Kept with the translation
 * (`translated_from`); a row changed since no longer matches, and is translated again.
 */
export const fieldsFingerprint = (fields: object) => fingerprint(JSON.stringify(fields));

/**
 * Whether `value` holds every one of `fields` as text (or empty): a row's fields, or a stored
 * translation's, read at run time. It's how the package's generic code knows a value is the app's
 * type (`FieldsOf`, from its schema): checked, never assumed. The generator builds that type and
 * the field list from the same list, so a value that passes is the app's type.
 */
function isFields<F>(value: unknown, fields: readonly string[]): value is F {
  return (
    typeof value === "object" &&
    value !== null &&
    fields.every((f) => {
      const v: unknown = Reflect.get(value, f);
      return typeof v === "string" || v === null;
    })
  );
}

/** Whether a stored translation was made from what the row says now: one with no fingerprint was
 * made before they were kept, and counts as current. */
const current = (from: string | null | undefined, now: string) => !from || from === now;

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

/** The queue every translation goes through: the app's `queues/translate.ts`. `table` is the
 * table's name in the database ("events"). */
export type TranslateMessage = { table: string; id: string };

/** A stored translation, as the read helpers give it. */
export interface Translation<F = Record<string, string>> {
  source_id: string;
  locale: string;
  fields: F;
  /** The fingerprint of the row's fields it was made from (fieldsFingerprint); none if older. */
  from?: string | null;
}

const appLocales = () => config.locales.map((l) => l.locale);

/**
 * The app's translated content: every function typed by its schema. `schema` is the app's
 * `import * as schema from "@schema"`; `db` opens the session a function uses when the caller
 * doesn't pass one (the app's `createDb(env.DB, { session: "first-primary" })`).
 */
/** Where translations are asked for: the app's `queues.translate` (void/queues), which Void types
 * from its `queues/translate.ts`. */
export interface TranslateQueue {
  send(message: TranslateMessage): Promise<unknown>;
}

export function translatedContent<S extends Record<string, unknown>>(
  schema: S,
  { db, queue }: { db: () => Db; queue: () => TranslateQueue },
) {
  const entries = contentEntries(schema);
  const entryOf = (table: ContentTable<S> | string): ContentEntry => {
    const name =
      typeof table === "string"
        ? table
        : [...entries.values()].find((e) => Object.is(e.source, table))?.name;
    const found = name === undefined ? undefined : entries.get(name);
    if (!found) throw new Error(`void-fbtee: ${String(name)} has no translations table.`);
    return found;
  };

  async function untranslatedOf<F = Record<string, string>>(
    c: ContentEntry,
    id: string,
    session: Db,
  ): Promise<{ source: Source<F>; from: string; missing: string[] } | undefined> {
    const row = await contentRow(session, c, id);
    if (!row) return;
    // Each field as text, in the list's order: what the fingerprint is made from.
    const fields = Object.fromEntries(
      c.fields.map((f) => {
        const v: unknown = Reflect.get(row, f);
        return [f, typeof v === "string" ? v : ""];
      }),
    );
    const from = fieldsFingerprint(fields);
    if (!isFields<F>(fields, c.fields)) return;
    const source: Source<F> = { id: row.id, locale: row.locale, fields };
    const have = (await namedTranslations(session, c, id))
      .filter((r) => current(r.translated_from, from))
      .map((r) => r.locale);
    return {
      source,
      from,
      missing: appLocales().filter((l) => l !== row.locale && !have.includes(l)),
    };
  }

  async function storeOf(
    c: ContentEntry,
    id: string,
    locale: string,
    fields: Record<string, string>,
    made: Made,
    session: Db,
  ) {
    return upsertTranslation(session, c, {
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

  async function askOf(c: ContentEntry, id: string, changed: boolean, session: Db) {
    const found = await untranslatedOf(c, id, session);
    if (!found?.missing.length) return false;
    let asked = 0;
    for (const locale of found.missing)
      // New: a "queued" row. There already (queued, an "unknown" translation, or one made before
      // the row changed): asked again only when its last asking is over an hour old. A current
      // translation someone can name isn't missing.
      if (await markAsked(session, c, id, locale, found.from, changed)) asked++;
    if (!asked) return false;
    await queue().send({ table: c.name, id });
    return true;
  }

  return {
    /** The session the functions open when not given one. */
    db,

    /**
     * A row, its fingerprint, and the app's languages it has no current translation in: none, or
     * one nobody can name ("unknown"), or only asked for ("queued"), or made from what the row
     * said before it was changed. All are translated, and replaced, by storeTranslation.
     * Undefined when the row is gone.
     */
    async untranslated<T extends ContentTable<S>>(
      table: T,
      id: string,
      session: Db = db(),
    ): Promise<{ source: Source<FieldsOf<S, T>>; from: string; missing: string[] } | undefined> {
      return untranslatedOf<FieldsOf<S, T>>(entryOf(table), id, session);
    },

    /**
     * Stores a row's translation into `locale`, with who made it. A stored translation is kept,
     * unless nobody can say who made it ("unknown"), it was only asked for ("queued"), or it was
     * made from what the row said before it was changed: that one is replaced. Resolves true when
     * it was stored.
     */
    storeTranslation<T extends ContentTable<S>>(
      table: T,
      id: string,
      locale: string,
      fields: FieldsOf<S, T> & Record<string, string>,
      made: Made,
      session: Db = db(),
    ): Promise<boolean> {
      return storeOf(entryOf(table), id, locale, fields, made, session);
    },

    /**
     * Asks for a row's translation into the app's languages it lacks (untranslated): marks each
     * "queued" (or, for an "unknown" one or one made before the row was changed, as asked, keeping
     * it to show meanwhile) and sends one message, unless every one was asked for in the last hour
     * (then nothing: it's on its way, or the daily job asks again). Resolves whether it was sent.
     * Call it when a post is made, and with `{ changed: true }` when it's just been changed: then
     * it asks at once, whatever was asked or stored in the last hour. A row read in a language it
     * lacks, or whose translation is out of date, is asked for then too (the middleware), and the
     * daily job finds any missing.
     */
    translateSoon(
      table: ContentTable<S>,
      id: string,
      { changed = false }: { changed?: boolean } = {},
      session: Db = db(),
    ): Promise<boolean> {
      return askOf(entryOf(table), id, changed, session);
    },

    /**
     * Every table of content kept to the app's languages, both ways: translations into a language
     * the app no longer has are deleted, and every row missing one of its languages, or with an
     * "unknown" one, is asked for (translateSoon: not one asked for in the last hour). Counted in
     * the database, one query a table. The daily job's work (content.cron).
     */
    async reconcile(session: Db = db()): Promise<{ deleted: number; queued: number }> {
      const locales = appLocales();
      let deleted = 0;
      let queued = 0;
      for (const c of entries.values()) {
        deleted += await deleteOtherLanguages(session, c, locales);
        for (const id of await rowsShortOf(session, c, locales))
          if (await askOf(c, id, false, session)) queued++;
      }
      return { deleted, queued };
    },

    /**
     * The stored translations of these rows: those a page in `locale` can show (it and its
     * fallbacks), or all of them without `locale`. Only ones someone can name: "unknown" ones are
     * being replaced, "queued" ones are only asked for. Any number of ids (asked for 90 at a time,
     * under D1's limit).
     */
    async translationsFor<T extends ContentTable<S>>(
      table: T,
      ids: string[],
      locale?: string,
      session: Db = db(),
    ): Promise<Translation<FieldsOf<S, T>>[]> {
      const c = entryOf(table);
      const wanted = locale ? new Set(textLocales(locale)) : undefined;
      const out: Translation<FieldsOf<S, T>>[] = [];
      for (const r of await translationRows(session, c, ids)) {
        if (wanted && !wanted.has(r.locale)) continue;
        // A stored translation missing a field (written by hand, or by older code) isn't shown:
        // said, so it can be fixed.
        if (!isFields<FieldsOf<S, T>>(r.fields, c.fields)) {
          console.warn(
            `void-fbtee: ${c.name}_translations ${r.source_id} ${r.locale} lacks one of ${c.fields.join(", ")}: not shown`,
          );
          continue;
        }
        out.push({
          source_id: r.source_id,
          locale: r.locale,
          fields: r.fields,
          from: r.translated_from,
        });
      }
      return out;
    },

    /**
     * A row's fields for a reader in `locale`, and the language they're in: the first of the
     * reader's language and its fallbacks (textLocales) the row is in, as written or translated;
     * else the original. When the reader's own language is one the app has and the row isn't in it
     * yet, or its translation was made before the row was changed (shown meanwhile), the request
     * notes it (content-pending.ts): the middleware keeps the page out of Void's page cache and
     * asks for the translation. Call it from a page's loader; with `{ note: false }` (an email, an
     * action) it notes nothing. `translations` may hold other rows' too.
     */
    textOf<T extends ContentTable<S>>(
      table: T,
      row: { id: string; locale: string } & FieldsOf<S, T>,
      translations: readonly Translation<FieldsOf<S, T>>[],
      locale: string,
      { note = true }: { note?: boolean } = {},
    ): { fields: FieldsOf<S, T>; locale: string; translated: boolean } {
      const c = entryOf(table);
      const mine = translations.filter((t) => t.source_id === row.id);
      const picked = Object.fromEntries(c.fields.map((f) => [f, Reflect.get(row, f)]));
      if (!isFields<FieldsOf<S, T>>(picked, c.fields))
        throw new Error(
          `void-fbtee: the ${c.name} row passed to textOf lacks one of ${c.fields.join(", ")}`,
        );
      const fields = picked;
      const original = () => ({ fields, locale: row.locale, translated: false });
      // Not yet in the reader's own language, or out of date there: the page waits for it.
      if (note && row.locale !== locale && appLocales().includes(locale)) {
        const now = fieldsFingerprint(fields);
        if (!mine.some((t) => t.locale === locale && current(t.from, now)))
          notePending(c.name, row.id);
      }
      for (const l of textLocales(locale)) {
        if (l === row.locale) return original();
        const found = mine.find((t) => t.locale === l);
        if (found) return { fields: found.fields, locale: found.locale, translated: true };
      }
      return original();
    },

    /** For the package's queue, cron and middleware: the tables found, by name, and the untyped
     * steps they run with a table's name from a message or a note. */
    internal: {
      entries,
      untranslated: (name: string, id: string, session: Db) =>
        entries.has(name) ? untranslatedOf(entries.get(name)!, id, session) : undefined,
      store: (
        name: string,
        id: string,
        locale: string,
        fields: Record<string, string>,
        made: Made,
        session: Db,
      ) => storeOf(entryOf(name), id, locale, fields, made, session),
      ask: (name: string, id: string, session: Db) =>
        entries.has(name) ? askOf(entries.get(name)!, id, false, session) : false,
    },
  };
}

/** The app's translated content, as `translatedContent` gives it. */
export type TranslatedContent = ReturnType<typeof translatedContent>;
