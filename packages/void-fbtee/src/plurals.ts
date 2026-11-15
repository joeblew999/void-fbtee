// Variants in catalogs: a count's plural forms and a person's gender. fbtee's compiler and runtime
// handle both, and since fbtee 6 its prepare-translations names each string's tokens (`tokens`,
// `types`: 28 a count, 3 a gender), but it still gives each string one line, so a catalog doesn't
// show a translator which lines a language needs. This adds them, in fbtee's own format, which its
// translateSync then compiles: one line per plural category the locale uses (Intl.PluralRules),
// per gender (fbtee's three), and per combination of the two.
//
// The format, from fbtee's source (checked against 6.0.0):
// - A line's `variations` maps the token's index to its category's code (fbtee src/IntlVariations.tsx).
// - At runtime fbtee picks the category with Intl.PluralRules (fbtee src/IntlNumberType.tsx), and
//   for n = 1 it tries a <fbt:plural>'s exactly-one form "_1" first (src/IntlVariationResolver.tsx).

type Category = Intl.LDMLPluralRule;

/** fbtee's IntlVariations code for each CLDR plural category. */
export const CATEGORY_CODE: Record<Category, number> = {
  zero: 16,
  one: 4,
  two: 8,
  few: 20,
  many: 12,
  other: 24,
};
const ORDER: Category[] = ["zero", "one", "two", "few", "many", "other"];

// Counts fbtee can be given: whole numbers and some fractions.
const SAMPLES = [
  ...Array.from({ length: 1001 }, (_, i) => i),
  0.5,
  1.5,
  2.5,
  3.5,
  5.5,
  10.5,
  0.1,
  1.1,
  2.1,
  1.25,
];

/**
 * The plural categories a translation of this count needs in this locale, in CLDR order. With
 * `exactlyOne` (a <fbt:plural>, which has its own form for exactly 1), a category only 1 can
 * reach is left out. A single "other" means the locale needs no plural forms.
 */
export function pluralCategories(locale: string, exactlyOne: boolean): Category[] {
  const rules = new Intl.PluralRules(locale);
  const used = new Set(
    (exactlyOne ? SAMPLES.filter((n) => n !== 1) : SAMPLES).map((n) => rules.select(n)),
  );
  return ORDER.filter((c) => used.has(c));
}

interface Leaf {
  text: string;
  desc: string;
}
export interface PluralPhrase {
  hashToLeaf?: Record<string, Leaf>;
  jsfbt?: { m?: ({ token?: string; type?: number } | null)[]; t?: unknown };
}
interface Line {
  translation: string;
  variations?: Record<string, number | string>;
}
export interface PluralEntry {
  status?: string;
  tokens?: string[];
  types?: number[];
  translations?: Line[];
  [key: string]: unknown;
}

/** The number tokens each string varies by: its count, and whether it has an exactly-one form. */
export type Slots = { token: string; exactlyOne: boolean }[];

/**
 * For each catalog hash, the counts that string varies by. Walks fbtee's collected table
 * (jsfbt.t): level i is jsfbt.m[i]; a number level's "*" branch varies by count, its "_1" branch
 * is exactly one and doesn't.
 */
export function pluralSlots(phrases: PluralPhrase[]): Map<string, Slots> {
  const out = new Map<string, Slots>();
  for (const ph of phrases) {
    const m = ph.jsfbt?.m ?? [];
    if (!m.some((e) => e?.type === 2)) continue;
    const byLeaf = new Map(
      Object.entries(ph.hashToLeaf ?? {}).map(([h, l]) => [`${l.desc}\u0000${l.text}`, h]),
    );
    const walk = (node: unknown, level: number, slots: Slots) => {
      if (!node || typeof node !== "object") return;
      const n = node as Record<string, unknown>;
      if (typeof n.text === "string" && typeof n.desc === "string") {
        const hash = byLeaf.get(`${n.desc}\u0000${n.text}`);
        if (hash && slots.length) out.set(hash, slots);
        return;
      }
      const meta = m[level];
      for (const [key, child] of Object.entries(n)) {
        const varies = meta?.type === 2 && meta.token && key === "*";
        walk(
          child,
          level + 1,
          varies ? [...slots, { token: meta.token!, exactlyOne: "_1" in n }] : slots,
        );
      }
    };
    walk(ph.jsfbt?.t, 0, []);
  }
  return out;
}

const keyOf = (v: Record<string, number | string> | undefined) =>
  JSON.stringify(
    Object.entries(v ?? {})
      .map(([k, x]) => [Number(k), Number(x)])
      .sort((a, b) => a[0]! - b[0]!),
  );

/** fbtee's IntlVariations codes for a person's gender (fbtee src/IntlVariations.tsx). */
export const GENDER_CODE = { male: 1, female: 2, unknown: 3 } as const;

/**
 * The word for each code a line can be marked with, as the translating skill names them
 * ("Counts", "People"): what Void's AI is told each line is for (ai.ts). From the same codes
 * withVariants writes, so the two can't differ; test/unit/skills.test.ts holds the skills to them.
 */
export const MARKS: Record<number, string> = Object.fromEntries([
  ...Object.entries(CATEGORY_CODE).map(([word, code]) => [code, word]),
  ...Object.entries(GENDER_CODE).map(([word, code]) => [code, word]),
]);

/** fbtee's `types` for a token: a count (BITMASK_NUMBER) or a person's gender (BITMASK_GENDER). */
const NUMBER = 28;
const GENDER = 3;

/**
 * One entry with a line for every variant fbtee's own data says it has, in the locale: for each
 * of its tokens (fbtee 6's prepare names them, `tokens` with their `types`), a count's plural
 * categories (Intl.PluralRules) or a person's three genders, every combination of them, each line's
 * `variations` keyed by its token's index. Gender is the same three in every language: where a
 * language doesn't change its words, its lines read the same. Lines already there are kept.
 * Lines it adds carry the entry's current text and mark the entry "new", so it counts as
 * untranslated until someone writes each one. Returns the entry unchanged when it has no variants.
 */
export function withVariants(
  entry: PluralEntry,
  slots: Slots,
  locale: string,
  { genders = true }: { genders?: boolean } = {},
): PluralEntry {
  // fbtee's own tokens, or for a catalog written before it named them, the counts alone.
  const tokens = entry.tokens?.length ? entry.tokens : slots.map((s) => s.token);
  const types = entry.types?.length ? entry.types : slots.map(() => NUMBER);
  const values = tokens.map((token, i): number[] => {
    if (types[i] === NUMBER) {
      const slot = slots.find((s) => s.token === token);
      return pluralCategories(locale, slot?.exactlyOne ?? false).map((c) => CATEGORY_CODE[c]);
    }
    if (types[i] === GENDER && genders) return Object.values(GENDER_CODE);
    return [];
  });
  if (values.every((v) => v.length <= 1)) return entry;
  const lines = entry.translations ?? [];
  const existing = new Map(lines.map((l) => [keyOf(l.variations), l]));
  const fallback = lines.find((l) => !Object.keys(l.variations ?? {}).length) ?? lines[0];
  let combos: Record<string, number>[] = [{}];
  values.forEach((codes, i) => {
    if (codes.length > 1)
      combos = combos.flatMap((c) => codes.map((code) => ({ ...c, [i]: code })));
  });
  let added = false;
  const translations = combos.map((variations) => {
    const line = existing.get(keyOf(variations));
    if (line) return line;
    added = true;
    return { translation: fallback?.translation ?? "", variations };
  });
  return {
    ...entry,
    tokens,
    types,
    ...(added ? { status: "new" } : {}),
    translations,
  };
}

/** A prepared catalog (fbtee's JSON) with every entry's variants added (withVariants). */
export function addVariants(
  json: string,
  slots: Map<string, Slots>,
  locale: string,
  options?: { genders?: boolean },
): string {
  const catalog = JSON.parse(json) as { translations: Record<string, PluralEntry> };
  for (const [hash, entry] of Object.entries(catalog.translations))
    catalog.translations[hash] = withVariants(entry, slots.get(hash) ?? [], locale, options);
  return JSON.stringify(catalog);
}
