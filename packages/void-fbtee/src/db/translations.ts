// Every query void-fbtee runs on the app's database (plans/layout.md): on its tables of content and
// their `<table>_translations` (translationsOf, ./schema). What they mean (which translation is
// current, when to ask again, what a reader sees) is content.ts's; this is only the SQL.
//
// Each takes the session it's given (primaryDb(), ./index), so a handler opens one and every query
// it makes shares it: one trip to D1's main copy, not one a query.
import { sql } from "void/db";
import type { Db } from "./index";
import { QUEUED, translationsTableName, UNKNOWN } from "./schema";

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

/** A row of a table of content: its id, its language, and these fields. Undefined when it's gone. */
export async function contentRow(
  db: Db,
  table: string,
  fields: readonly string[],
  id: string,
): Promise<Record<string, string> | undefined> {
  const rows = (await db.all(
    sql`SELECT ${ident("id")}, ${ident("locale")}, ${sql.join(
      fields.map((f) => ident(f)),
      sql`, `,
    )} FROM ${ident(table)} WHERE ${ident("id")} = ${id}`,
  )) as Record<string, string>[];
  return rows[0];
}

/** The languages a row has a translation someone can name in, and what each was made from. */
export async function namedTranslations(
  db: Db,
  table: string,
  id: string,
): Promise<{ locale: string; translated_from: string | null }[]> {
  return (await db.all(
    sql`SELECT ${ident("locale")} AS locale, ${ident("translated_from")} AS translated_from
      FROM ${ident(translationsTableName(table))}
      WHERE ${ident("source_id")} = ${id} AND ${named()}`,
  )) as { locale: string; translated_from: string | null }[];
}

/**
 * Stores a translation, or replaces one nobody can name ("unknown"), only asked for ("queued"), or
 * made from what the row said before (a different `translated_from`). True when it was stored.
 */
export async function upsertTranslation(
  db: Db,
  table: string,
  row: {
    id: string;
    locale: string;
    fields: string;
    by: string;
    at: string;
    gatewayLogId: string | null;
    usage: string | null;
    from: string | null;
  },
): Promise<boolean> {
  const t = translationsTableName(table);
  const result = await db.run(
    sql`INSERT INTO ${ident(t)} (${ident("id")}, ${ident("source_id")}, ${ident("locale")}, ${ident("fields")},
        ${ident("translated_by")}, ${ident("translated_at")}, ${ident("gateway_log_id")},
        ${ident("usage")}, ${ident("translated_from")})
      VALUES (${crypto.randomUUID()}, ${row.id}, ${row.locale}, ${row.fields}, ${row.by}, ${row.at},
        ${row.gatewayLogId}, ${row.usage}, ${row.from})
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

/**
 * Marks a row's translation into `locale` asked for: a new "queued" row; or, for one there already
 * that's queued, "unknown" or made from what the row said before (not `from`), its asking renewed,
 * when that was over an hour ago or `now` is set. True when it was marked.
 */
export async function markAsked(
  db: Db,
  table: string,
  id: string,
  locale: string,
  from: string,
  now: boolean,
): Promise<boolean> {
  const t = ident(translationsTableName(table));
  const result = await db.run(
    sql`INSERT INTO ${t} (${ident("id")}, ${ident("source_id")}, ${ident("locale")}, ${ident("fields")}, ${ident("translated_by")})
      VALUES (${crypto.randomUUID()}, ${id}, ${locale}, ${"{}"}, ${QUEUED})
      ON CONFLICT (${ident("source_id")}, ${ident("locale")}) DO UPDATE SET ${ident("updated_at")} = datetime('now')
      WHERE (${t}.${ident("translated_by")} IN (${QUEUED}, ${UNKNOWN})
          OR (${t}.${ident("translated_from")} IS NOT NULL
            AND ${t}.${ident("translated_from")} <> ${from}))
        AND (${now ? 1 : 0} = 1 OR ${t}.${ident("updated_at")} < datetime('now', '-1 hour'))`,
  );
  return changes(result) > 0;
}

/** Deletes a table's translations into languages not in `locales`. How many went. */
export async function deleteOtherLanguages(
  db: Db,
  table: string,
  locales: string[],
): Promise<number> {
  const t = ident(translationsTableName(table));
  return changes(
    await db.run(sql`DELETE FROM ${t} WHERE ${ident("locale")} NOT IN (${list(locales)})`),
  );
}

/** The ids of a table's rows short of a translation someone can name in one of `locales` (their
 * own language aside). Counted in the database, one query. */
export async function rowsShortOf(db: Db, table: string, locales: string[]): Promise<string[]> {
  const t = ident(translationsTableName(table));
  const rows = (await db.all(
    sql`SELECT s.${ident("id")} AS id FROM ${ident(table)} s
      WHERE (SELECT count(*) FROM ${t} x WHERE x.${ident("source_id")} = s.${ident("id")}
        AND x.${ident("translated_by")} NOT IN (${UNKNOWN}, ${QUEUED})
        AND x.${ident("locale")} <> s.${ident("locale")}
        AND x.${ident("locale")} IN (${list(locales)}))
      < ${locales.length} - (CASE WHEN s.${ident("locale")} IN (${list(locales)}) THEN 1 ELSE 0 END)`,
  )) as { id: string }[];
  return rows.map((r) => r.id);
}

/** The translations someone can name of these rows, in every language: any number of ids (asked
 * for 90 at a time, under D1's limit). `fields` is the stored JSON. */
export async function translationRows(
  db: Db,
  table: string,
  ids: string[],
): Promise<
  { source_id: string; locale: string; fields: string; translated_from: string | null }[]
> {
  const t = ident(translationsTableName(table));
  const out = [];
  for (const some of chunks([...new Set(ids)]))
    out.push(
      ...((await db.all(
        sql`SELECT ${ident("source_id")} AS source_id, ${ident("locale")} AS locale, ${ident("fields")} AS fields,
            ${ident("translated_from")} AS translated_from
          FROM ${t} WHERE ${ident("source_id")} IN (${list(some)}) AND ${named()}`,
      )) as {
        source_id: string;
        locale: string;
        fields: string;
        translated_from: string | null;
      }[]),
    );
  return out;
}
