// Every query void-fbtee runs on the app's database (plans/layout.md): on its tables of content and
// their `<table>_translations`. What they mean (which translation is current, when to ask again,
// what a reader sees) is content.ts's; this is only the queries.
//
// Typed Drizzle on the app's own tables, found in the schema it hands over (./schema
// contentEntries), not tables built from names. Each takes the session it's given, so a handler
// opens one and every query it makes shares it: one trip to D1's main copy, not one a query.
import type { DrizzleD1Database } from "void/db";
import { and, count, eq, inArray, isNotNull, lt, ne, notInArray, or, sql } from "void/db";
import { QUEUED, UNKNOWN, type ContentEntry, type TranslationsTable } from "./schema";

/**
 * A database session. The app's own (`createDb(env.DB, { session: "first-primary" })`, typed by its
 * schema in Void's generated `.void/db.d.ts`) fits: the queries here only use the tables they're
 * given.
 */
export type Db = DrizzleD1Database<Record<string, unknown>>;

// D1 takes at most 100 bound parameters a query (Cloudflare's D1 limits).
const CHUNK = 90;
const chunks = <T>(items: T[]) =>
  Array.from({ length: Math.ceil(items.length / CHUNK) }, (_, i) =>
    items.slice(i * CHUNK, (i + 1) * CHUNK),
  );

export type TranslationInsert = Omit<
  TranslationsTable["$inferInsert"],
  "id" | "createdAt" | "updatedAt"
>;

/** Not "unknown" (being replaced) nor "queued" (asked for): a translation someone can name. */
const named = (t: TranslationsTable) => notInArray(t.translatedBy, [UNKNOWN, QUEUED]);

/** A row of a table of content, all its columns. Undefined when it's gone. */
export async function contentRow(db: Db, c: ContentEntry, id: string) {
  const [row] = await db.select().from(c.source).where(eq(c.source.id, id));
  return row;
}

/** The languages a row has a translation someone can name in, and what each was made from. */
export async function namedTranslations(db: Db, c: ContentEntry, id: string) {
  const t = c.translations;
  return db
    .select({ locale: t.locale, translated_from: t.translatedFrom })
    .from(t)
    .where(and(eq(t.source_id, id), named(t)));
}

/**
 * Stores a translation, or replaces one nobody can name ("unknown"), only asked for ("queued"), or
 * made from what the row said before (a different `translated_from`). True when it was stored.
 */
export async function upsertTranslation(
  db: Db,
  c: ContentEntry,
  row: TranslationInsert,
): Promise<boolean> {
  const t = c.translations;
  const result = await db
    .insert(t)
    .values({ id: crypto.randomUUID(), ...row })
    .onConflictDoUpdate({
      target: [t.source_id, t.locale],
      set: {
        fields: sql`excluded.fields`,
        translatedBy: sql`excluded.translated_by`,
        translatedAt: sql`excluded.translated_at`,
        gatewayLogId: sql`excluded.gateway_log_id`,
        usage: sql`excluded.usage`,
        translatedFrom: sql`excluded.translated_from`,
        updatedAt: sql`(datetime('now'))`,
      },
      setWhere: or(
        inArray(t.translatedBy, [UNKNOWN, QUEUED]),
        and(isNotNull(t.translatedFrom), sql`${t.translatedFrom} <> excluded.translated_from`),
      ),
    });
  return result.meta.changes > 0;
}

/**
 * Marks a row's translation into `locale` asked for: a new "queued" row; or, for one there already
 * that's queued, "unknown" or made from what the row said before (not `from`), its asking renewed,
 * when that was over an hour ago or `now` is set. True when it was marked.
 */
export async function markAsked(
  db: Db,
  c: ContentEntry,
  id: string,
  locale: string,
  from: string,
  now: boolean,
): Promise<boolean> {
  const t = c.translations;
  const result = await db
    .insert(t)
    .values({ id: crypto.randomUUID(), source_id: id, locale, fields: {}, translatedBy: QUEUED })
    .onConflictDoUpdate({
      target: [t.source_id, t.locale],
      set: { updatedAt: sql`(datetime('now'))` },
      setWhere: and(
        or(
          inArray(t.translatedBy, [QUEUED, UNKNOWN]),
          and(isNotNull(t.translatedFrom), ne(t.translatedFrom, from)),
        ),
        now ? undefined : lt(t.updatedAt, sql`datetime('now', '-1 hour')`),
      ),
    });
  return result.meta.changes > 0;
}

/** Deletes a table's translations into languages not in `locales`. How many went. */
export async function deleteOtherLanguages(
  db: Db,
  c: ContentEntry,
  locales: string[],
): Promise<number> {
  const t = c.translations;
  const result = await db.delete(t).where(notInArray(t.locale, locales));
  return result.meta.changes;
}

/** The ids of a table's rows short of a translation someone can name in one of `locales` (their
 * own language aside). Counted in the database, one query. */
export async function rowsShortOf(db: Db, c: ContentEntry, locales: string[]): Promise<string[]> {
  const s = c.source;
  const t = c.translations;
  const have = db
    .select({ n: count() })
    .from(t)
    .where(
      and(eq(t.source_id, s.id), named(t), ne(t.locale, s.locale), inArray(t.locale, locales)),
    );
  const rows = await db
    .select({ id: s.id })
    .from(s)
    .where(
      sql`(${have}) < ${locales.length} - (CASE WHEN ${inArray(s.locale, locales)} THEN 1 ELSE 0 END)`,
    );
  return rows.map((r) => r.id);
}

/** The translations someone can name of these rows, in every language: any number of ids (asked
 * for 90 at a time, under D1's limit). */
export async function translationRows(db: Db, c: ContentEntry, ids: string[]) {
  const t = c.translations;
  const out = [];
  for (const some of chunks([...new Set(ids)]))
    out.push(
      ...(await db
        .select({
          source_id: t.source_id,
          locale: t.locale,
          fields: t.fields,
          translated_from: t.translatedFrom,
        })
        .from(t)
        .where(and(inArray(t.source_id, some), named(t)))),
    );
  return out;
}
