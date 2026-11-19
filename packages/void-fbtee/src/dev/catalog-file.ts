// A catalog file, i18n/translations/<locale>.json, as fbtee and void-fbtee write it, read with
// every field it has checked (plans/no-casts.md): a file that isn't that shape stops with an error
// naming it, rather than becoming a type it isn't. The shapes were checked against the example's
// catalogs (2026-11-19): `variations` are numbers; an entry also holds fbtee's own `tokens` and
// `types`, which are kept as they are.
import { isRecord, isStringArray, parseJson } from "../guards";
import type { Spent } from "../models";

export interface CatalogLine {
  translation: string;
  variations: Record<string, number>;
}

/**
 * A reviewer's verdict on one entry, kept in the entry (plans/translation-rework.md, step 6):
 * "ok", or "wrong" with what was wrong (`note`), the translator it judged (`of`) and its lines
 * (`was`), the reviewer's correction being the entry's lines now.
 */
export interface Review {
  by: string;
  at: string;
  verdict: "ok" | "wrong";
  of?: string;
  note?: string;
  was?: string[];
}

export interface CatalogEntry {
  description?: string;
  status?: string;
  translations?: CatalogLine[];
  /** Who wrote the translation: a model's id, "claude", a person, or "unknown" when nothing said
   * (plans/translation-provenance.md). Every finished entry has one (check.ts). */
  translatedBy?: string;
  /** The day it was written, YYYY-MM-DD. */
  translatedAt?: string;
  /** The AI Gateway log of the request that wrote it: its exact request and answer. */
  gatewayLogId?: string;
  /** What it cost: the request's tokens, and the US$ they came to that day (models.ts spent). */
  usage?: Spent;
  /** Claude's review of a translation an AI wrote (reviewTask). Cleared when it's translated again. */
  review?: Review;
}

export interface Catalog {
  "fb-locale"?: string;
  translations: Record<string, CatalogEntry>;
}

const optional = <T>(value: unknown, check: (v: unknown) => v is T): value is T | undefined =>
  value === undefined || check(value);
const isText = (value: unknown): value is string => typeof value === "string";
const isNumber = (value: unknown): value is number => typeof value === "number";

/** What a translation cost, as models.ts spent() records it. */
export const isSpent = (value: unknown): value is Spent =>
  isRecord(value) &&
  isNumber(value.in) &&
  isNumber(value.out) &&
  isNumber(value.thinking) &&
  isNumber(value.usd);

const isReview = (value: unknown): value is Review =>
  isRecord(value) &&
  isText(value.by) &&
  isText(value.at) &&
  (value.verdict === "ok" || value.verdict === "wrong") &&
  optional(value.of, isText) &&
  optional(value.note, isText) &&
  optional(value.was, isStringArray);

const isLine = (value: unknown): value is CatalogLine =>
  isRecord(value) &&
  isText(value.translation) &&
  isRecord(value.variations) &&
  Object.values(value.variations).every(isNumber);

const isEntry = (value: unknown): value is CatalogEntry =>
  isRecord(value) &&
  optional(value.description, isText) &&
  optional(value.status, isText) &&
  (value.translations === undefined ||
    (Array.isArray(value.translations) && value.translations.every(isLine))) &&
  optional(value.translatedBy, isText) &&
  optional(value.translatedAt, isText) &&
  optional(value.gatewayLogId, isText) &&
  optional(value.usage, isSpent) &&
  optional(value.review, isReview);

/** A catalog's text, read and checked. `what` names it in the error: its file, or the language. */
export function readCatalog(text: string, what: string): Catalog {
  const value = parseJson(text);
  if (!isRecord(value) || !optional(value["fb-locale"], isText) || !isRecord(value.translations))
    throw new Error(`void-fbtee: ${what} isn't a catalog: it has no "translations"`);
  const bad = Object.entries(value.translations).find(([, e]) => !isEntry(e));
  if (bad) throw new Error(`void-fbtee: ${what}: entry ${bad[0]} isn't in a catalog's shape`);
  // Every entry was checked just above: each is one.
  const translations: Record<string, CatalogEntry> = Object.fromEntries(
    Object.entries(value.translations).filter((e): e is [string, CatalogEntry] => isEntry(e[1])),
  );
  return { ...value, translations };
}
