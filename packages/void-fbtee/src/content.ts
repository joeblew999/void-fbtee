// Translations of what people write in the app's tables (plans/translated-content.md): which rows
// lack which of the app's languages, storing a translation with who made it, queuing one, keeping
// every table in the app's languages both ways, and reading a row in the reader's language.
//
// Which tables, and which of their fields: voidFbtee({ content }), handed over in
// virtual:void-fbtee/config. Each table's translations are in `<table>_translations`, the one shape
// translationsOf() makes (void-fbtee/db/schema). A table of content has a text `id` and a `locale`
// column, the language the row was written in (`vp build` checks both).
import config from "virtual:void-fbtee/config";
import { db, sql } from "void/db";
import { queues } from "void/queues";
import { translationsTableName, UNKNOWN } from "./db-schema";
import { notePending } from "./content-pending";
import { pickText, textLocales as textLocalesOf } from "./server";
import type { RuntimeConfig } from "./runtime";

/** A table's fields to translate, and what it holds, for the model (voidFbtee({ content })). */
export interface ContentTable {
  fields: string[];
  about: string;
}

/** voidFbtee({ content }) as the runtime has it: every table, with its fields and what it holds. */
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

/** One row of content: its id, the language it was written in, and its fields. */
export interface Source {
  id: string;
  locale: string;
  fields: Record<string, string>;
}

/**
 * A row, and the app's languages it has no translation in. One nobody can say the origin of
 * ("unknown") counts as missing: it's translated again, and replaced (storeTranslation).
 * Undefined when the row is gone.
 */
export async function untranslated(
  table: string,
  id: string,
): Promise<{ source: Source; missing: string[] } | undefined> {
  const { fields } = tableOf(table);
  const rows = (await db.all(
    sql`SELECT ${ident("id")}, ${ident("locale")}, ${sql.join(
      fields.map((f) => ident(f)),
      sql`, `,
    )} FROM ${ident(table)} WHERE ${ident("id")} = ${id}`,
  )) as Record<string, string>[];
  const row = rows[0];
  if (!row) return;
  const have = (
    (await db.all(
      sql`SELECT ${ident("locale")} FROM ${ident(translationsTableName(table))}
        WHERE ${ident("source_id")} = ${id} AND ${ident("translated_by")} <> ${UNKNOWN}`,
    )) as { locale: string }[]
  ).map((r) => r.locale);
  return {
    source: {
      id: row.id!,
      locale: row.locale!,
      fields: Object.fromEntries(
        fields.map((f) => {
          const value = (row as Record<string, unknown>)[f];
          return [f, typeof value === "string" ? value : ""];
        }),
      ),
    },
    missing: appLocales().filter((l) => l !== row.locale && !have.includes(l)),
  };
}

/** Who made a translation: the model's id, or "claude", or a person; and its AI Gateway log. */
export interface Made {
  by: string;
  gatewayLogId?: string;
}

/**
 * Stores a row's translation into `locale`, with who made it. A stored translation is kept, unless
 * nobody can say who made it ("unknown"): that one is replaced. Resolves true when it was stored.
 */
export async function storeTranslation(
  table: string,
  id: string,
  locale: string,
  fields: Record<string, string>,
  made: Made,
): Promise<boolean> {
  const t = translationsTableName(table);
  const today = new Date().toISOString().slice(0, 10);
  const json = JSON.stringify(
    Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v.trim()])),
  );
  const result = await db.run(
    sql`INSERT INTO ${ident(t)} (${ident("id")}, ${ident("source_id")}, ${ident("locale")}, ${ident("fields")},
        ${ident("translated_by")}, ${ident("translated_at")}, ${ident("gateway_log_id")})
      VALUES (${crypto.randomUUID()}, ${id}, ${locale}, ${json}, ${made.by}, ${today}, ${made.gatewayLogId ?? null})
      ON CONFLICT (${ident("source_id")}, ${ident("locale")}) DO UPDATE SET
        ${ident("fields")} = excluded.${ident("fields")},
        ${ident("translated_by")} = excluded.${ident("translated_by")},
        ${ident("translated_at")} = excluded.${ident("translated_at")},
        ${ident("gateway_log_id")} = excluded.${ident("gateway_log_id")},
        ${ident("updated_at")} = datetime('now')
      WHERE ${ident(t)}.${ident("translated_by")} = ${UNKNOWN}`,
  );
  return ((result as { meta?: { changes?: number } }).meta?.changes ?? 1) > 0;
}

/** The queue every translation goes through: the app's `queues/translate.ts`. */
export type TranslateMessage = { table: string; id: string };

/**
 * Queues a row's translation into the app's languages it lacks, at once. Optional: a row read in
 * a language it lacks is queued then (the middleware), and the hourly job finds any left.
 */
export async function translateSoon(table: string, id: string): Promise<void> {
  tableOf(table);
  await (
    queues as unknown as Record<string, { send(m: TranslateMessage): Promise<void> }>
  ).translate!.send({ table, id });
}

/**
 * Every table of content kept to the app's languages, both ways: translations into a language the
 * app no longer has are deleted, and every row missing one of its languages, or with an "unknown"
 * one, is queued. Counted in the database, one query a table (D1 takes at most 100 bound
 * parameters a query, so not a list of ids). The hourly job's work (void-fbtee/crons/translations).
 */
export async function reconcile(): Promise<{ deleted: number; queued: number }> {
  const locales = appLocales();
  let deleted = 0;
  let queued = 0;
  for (const table of contentTables().keys()) {
    const t = ident(translationsTableName(table));
    const gone = await db.run(
      sql`DELETE FROM ${t} WHERE ${ident("locale")} NOT IN (${list(locales)})`,
    );
    deleted += (gone as { meta?: { changes?: number } }).meta?.changes ?? 0;
    const rows = (await db.all(
      sql`SELECT s.${ident("id")} AS id FROM ${ident(table)} s
        WHERE (SELECT count(*) FROM ${t} x WHERE x.${ident("source_id")} = s.${ident("id")}
          AND x.${ident("translated_by")} <> ${UNKNOWN}
          AND x.${ident("locale")} <> s.${ident("locale")}
          AND x.${ident("locale")} IN (${list(locales)}))
        < ${locales.length} - (CASE WHEN s.${ident("locale")} IN (${list(locales)}) THEN 1 ELSE 0 END)`,
    )) as { id: string }[];
    for (const { id } of rows) await translateSoon(table, id);
    queued += rows.length;
  }
  return { deleted, queued };
}

/** A stored translation, as the read helpers give it. */
export interface Translation {
  source_id: string;
  locale: string;
  fields: Record<string, string>;
}

/**
 * The stored translations of these rows: those a page in `locale` can show (it and its fallbacks),
 * or all of them without `locale`. "unknown" ones are left out: they're being replaced.
 */
export async function translationsFor(
  table: string,
  ids: string[],
  locale?: string,
): Promise<Translation[]> {
  tableOf(table);
  if (!ids.length) return [];
  const t = ident(translationsTableName(table));
  const rows = (await db.all(
    sql`SELECT ${ident("source_id")} AS source_id, ${ident("locale")} AS locale, ${ident("fields")} AS fields
      FROM ${t} WHERE ${ident("source_id")} IN (${list(ids)}) AND ${ident("translated_by")} <> ${UNKNOWN}`,
  )) as { source_id: string; locale: string; fields: string }[];
  const wanted = locale ? new Set(textLocalesOf(locale)) : undefined;
  return rows
    .filter((r) => !wanted || wanted.has(r.locale))
    .map((r) => ({ source_id: r.source_id, locale: r.locale, fields: JSON.parse(r.fields) }));
}

/**
 * A row's fields for a reader in `locale`, and the language they're in: the best stored translation
 * (pickText), else the original. When it's the original and the reader's language is one the app
 * has, the request notes it (content-pending.ts): the middleware keeps the page out of Void's page
 * cache and queues the translation. `translations` may hold other rows' too.
 */
export function textOf(
  table: string,
  row: { id: string; locale: string },
  translations: readonly Translation[],
  locale: string,
): { fields: Record<string, string>; locale: string; translated: boolean } {
  const { fields } = tableOf(table);
  const found = pickText(
    translations.filter((t) => t.source_id === row.id),
    locale,
  );
  // Not in the reader's own language (none, or only a fallback's): the page waits for it.
  if ((found?.locale ?? row.locale) !== locale && appLocales().includes(locale))
    notePending(table, row.id);
  if (found) return { fields: found.fields, locale: found.locale, translated: true };
  return {
    fields: Object.fromEntries(
      fields.map((f) => {
        const value = (row as Record<string, unknown>)[f];
        return [f, typeof value === "string" ? value : ""];
      }),
    ),
    locale: row.locale,
    translated: false,
  };
}
