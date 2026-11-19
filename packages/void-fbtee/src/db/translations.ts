// Every query void-fbtee runs on the app's database (plans/layout.md): on its tables of content and
// their `<table>_translations`. What they mean (which translation is current, when to ask again,
// what a reader sees) is content.ts's; this is only the queries.
//
// Typed Drizzle, from the tables' definitions, not hand-written SQL: the translations tables are
// translationsOf()'s (./schema), the shape this package defines; a table of content is known only
// by its name and fields (voidFbtee({ content })), so it's defined here from those, as far as the
// queries need it. Each takes the session it's given (primaryDb(), ./index), so a handler opens one
// and every query it makes shares it: one trip to D1's main copy, not one a query.
import { and, count, eq, inArray, isNotNull, lt, ne, notInArray, or, sql } from "void/db";
import { sqliteTable, text } from "void/schema-d1";
import type { Db } from "./index";
import { QUEUED, translationsOf, UNKNOWN } from "./schema";

// D1 takes at most 100 bound parameters a query (Cloudflare's D1 limits).
const CHUNK = 90;
const chunks = <T>(items: T[]) =>
  Array.from({ length: Math.ceil(items.length / CHUNK) }, (_, i) =>
    items.slice(i * CHUNK, (i + 1) * CHUNK),
  );

/** A table of content as the queries need it: its id, its language, and these text fields. */
const contentTable = (name: string, fields: readonly string[] = []) =>
  sqliteTable(name, {
    id: text("id").primaryKey(),
    locale: text("locale").notNull(),
    ...Object.fromEntries(fields.map((f) => [f, text(f)])),
  });

/** A table of content's translations: translationsOf() over it, as the app's schema has it. */
const translations = (table: string) => translationsOf(contentTable(table));

type TranslationsTable = ReturnType<typeof translations>;
export type TranslationInsert = Omit<
  TranslationsTable["$inferInsert"],
  "id" | "createdAt" | "updatedAt"
>;

/** Not "unknown" (being replaced) nor "queued" (asked for): a translation someone can name. */
const named = (t: TranslationsTable) => notInArray(t.translatedBy, [UNKNOWN, QUEUED]);

/** A row of a table of content: its id, its language, and these fields. Undefined when it's gone. */
export async function contentRow(db: Db, table: string, fields: readonly string[], id: string) {
  const s = contentTable(table, fields);
  const [row] = await db.select().from(s).where(eq(s.id, id));
  return row as Record<string, string | null> | undefined;
}

/** The languages a row has a translation someone can name in, and what each was made from. */
export async function namedTranslations(db: Db, table: string, id: string) {
  const t = translations(table);
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
  table: string,
  row: TranslationInsert,
): Promise<boolean> {
  const t = translations(table);
  const result = await db
    .insert(t)
    .values(row)
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
  table: string,
  id: string,
  locale: string,
  from: string,
  now: boolean,
): Promise<boolean> {
  const t = translations(table);
  const result = await db
    .insert(t)
    .values({ source_id: id, locale, fields: {}, translatedBy: QUEUED })
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
  table: string,
  locales: string[],
): Promise<number> {
  const t = translations(table);
  const result = await db.delete(t).where(notInArray(t.locale, locales));
  return result.meta.changes;
}

/** The ids of a table's rows short of a translation someone can name in one of `locales` (their
 * own language aside). Counted in the database, one query. */
export async function rowsShortOf(db: Db, table: string, locales: string[]): Promise<string[]> {
  const s = contentTable(table);
  const t = translations(table);
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
export async function translationRows(db: Db, table: string, ids: string[]) {
  const t = translations(table);
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
