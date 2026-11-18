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
import config from "virtual:void-fbtee/config";
import { sql } from "void/db";
import { queues } from "void/queues";
import { primaryDb } from "./db";
import { QUEUED, translationsTableName, UNKNOWN } from "./db-schema";
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
const ident = (name: string) => sql.identifier(name);
const list = (values: string[]) =>
  sql.join(
    values.map((v) => sql`${v}`),
    sql`, `,
  );
/** Translations someone can name: not "unknown" (being replaced), not "queued" (asked for). */
const named = () => sql`${ident("translated_by")} NOT IN (${UNKNOWN}, ${QUEUED})`;
// D1 takes at most 100 bound parameters a query (Cloudflare's D1 limits).
const CHUNK = 90;
const chunks = <T>(items: T[]) =>
  Array.from({ length: Math.ceil(items.length / CHUNK) }, (_, i) =>
    items.slice(i * CHUNK, (i + 1) * CHUNK),
  );
const changes = (result: unknown) => (result as { meta?: { changes?: number } }).meta?.changes ?? 0;

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
): Promise<{ source: Source; from: string; missing: string[] } | undefined> {
  const db = primaryDb();
  const { fields } = tableOf(table);
  const rows = (await db.all(
    sql`SELECT ${ident("id")}, ${ident("locale")}, ${sql.join(
      fields.map((f) => ident(f)),
      sql`, `,
    )} FROM ${ident(table)} WHERE ${ident("id")} = ${id}`,
  )) as Record<string, string>[];
  const row = rows[0];
  if (!row) return;
  const source: Source = {
    id: row.id!,
    locale: row.locale!,
    fields: Object.fromEntries(fields.map((f) => [f, row[f] ?? ""])),
  };
  const from = fieldsFingerprint(source.fields);
  const have = (
    (await db.all(
      sql`SELECT ${ident("locale")} AS locale, ${ident("translated_from")} AS translated_from
        FROM ${ident(translationsTableName(table))}
        WHERE ${ident("source_id")} = ${id} AND ${named()}`,
    )) as { locale: string; translated_from: string | null }[]
  )
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
): Promise<boolean> {
  const db = primaryDb();
  const t = translationsTableName(table);
  const today = new Date().toISOString().slice(0, 10);
  const json = JSON.stringify(
    Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v.trim()])),
  );
  const result = await db.run(
    sql`INSERT INTO ${ident(t)} (${ident("id")}, ${ident("source_id")}, ${ident("locale")}, ${ident("fields")},
        ${ident("translated_by")}, ${ident("translated_at")}, ${ident("gateway_log_id")},
        ${ident("usage")}, ${ident("translated_from")})
      VALUES (${crypto.randomUUID()}, ${id}, ${locale}, ${json}, ${made.by}, ${today}, ${made.gatewayLogId ?? null},
        ${made.usage ? JSON.stringify(made.usage) : null}, ${made.from ?? null})
      ON CONFLICT (${ident("source_id")}, ${ident("locale")}) DO UPDATE SET
        ${ident("fields")} = excluded.${ident("fields")},
        ${ident("translated_by")} = excluded.${ident("translated_by")},
        ${ident("translated_at")} = excluded.${ident("translated_at")},
        ${ident("gateway_log_id")} = excluded.${ident("gateway_log_id")},
        ${ident("usage")} = excluded.${ident("usage")},
        ${ident("translated_from")} = excluded.${ident("translated_from")},
        ${ident("updated_at")} = datetime('now')
      WHERE ${ident(t)}.${ident("translated_by")} IN (${UNKNOWN}, ${QUEUED})
        OR (${ident(t)}.${ident("translated_from")} IS NOT NULL
          AND ${ident(t)}.${ident("translated_from")} <> excluded.${ident("translated_from")})`,
  );
  return changes(result) > 0;
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
): Promise<boolean> {
  const db = primaryDb();
  const found = await untranslated(table, id);
  if (!found?.missing.length) return false;
  const t = ident(translationsTableName(table));
  let asked = 0;
  for (const locale of found.missing)
    // New: a "queued" row. There already (queued, an "unknown" translation, or one made before
    // the row changed): asked again only when its last asking is over an hour old. A current
    // translation someone can name isn't missing.
    asked += changes(
      await db.run(
        sql`INSERT INTO ${t} (${ident("id")}, ${ident("source_id")}, ${ident("locale")}, ${ident("fields")}, ${ident("translated_by")})
          VALUES (${crypto.randomUUID()}, ${id}, ${locale}, ${"{}"}, ${QUEUED})
          ON CONFLICT (${ident("source_id")}, ${ident("locale")}) DO UPDATE SET ${ident("updated_at")} = datetime('now')
          WHERE (${t}.${ident("translated_by")} IN (${QUEUED}, ${UNKNOWN})
              OR (${t}.${ident("translated_from")} IS NOT NULL
                AND ${t}.${ident("translated_from")} <> ${found.from}))
            AND (${changed ? 1 : 0} = 1 OR ${t}.${ident("updated_at")} < datetime('now', '-1 hour'))`,
      ),
    );
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
export async function reconcile(): Promise<{ deleted: number; queued: number }> {
  const db = primaryDb();
  const locales = appLocales();
  let deleted = 0;
  let queued = 0;
  for (const table of contentTables().keys()) {
    const t = ident(translationsTableName(table));
    deleted += changes(
      await db.run(sql`DELETE FROM ${t} WHERE ${ident("locale")} NOT IN (${list(locales)})`),
    );
    const rows = (await db.all(
      sql`SELECT s.${ident("id")} AS id FROM ${ident(table)} s
        WHERE (SELECT count(*) FROM ${t} x WHERE x.${ident("source_id")} = s.${ident("id")}
          AND x.${ident("translated_by")} NOT IN (${UNKNOWN}, ${QUEUED})
          AND x.${ident("locale")} <> s.${ident("locale")}
          AND x.${ident("locale")} IN (${list(locales)}))
        < ${locales.length} - (CASE WHEN s.${ident("locale")} IN (${list(locales)}) THEN 1 ELSE 0 END)`,
    )) as { id: string }[];
    for (const { id } of rows) if (await translateSoon(table, id)) queued++;
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
): Promise<Translation[]> {
  const db = primaryDb();
  tableOf(table);
  const t = ident(translationsTableName(table));
  const wanted = locale ? new Set(textLocales(locale)) : undefined;
  const out: Translation[] = [];
  for (const some of chunks([...new Set(ids)])) {
    const rows = (await db.all(
      sql`SELECT ${ident("source_id")} AS source_id, ${ident("locale")} AS locale, ${ident("fields")} AS fields,
          ${ident("translated_from")} AS translated_from
        FROM ${t} WHERE ${ident("source_id")} IN (${list(some)}) AND ${named()}`,
    )) as { source_id: string; locale: string; fields: string; translated_from: string | null }[];
    for (const r of rows)
      if (!wanted || wanted.has(r.locale))
        out.push({
          source_id: r.source_id,
          locale: r.locale,
          fields: JSON.parse(r.fields),
          from: r.translated_from,
        });
  }
  return out;
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
