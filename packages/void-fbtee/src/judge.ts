// Whether a translation can break the app, whoever wrote it: `vp dev` asks it of each answer before
// writing it to the catalog (dev/translate.ts: what it finds goes back to Void's AI once, as what to
// fix), and `vp build` of every finished catalog entry (dev/check.ts), against the entry's source lines.
// Only what breaks an app: a line missing or empty, a {placeholder} lost or made up. How well it
// reads is the translator's, and the reviewer's (plans/translation-simple.md).
import { CATEGORY_CODE } from "./plurals";

/** A source line: its text and, for a count or a person, the form it's for (fbtee's codes). */
export interface SourceLine {
  translation: string;
  variations: Record<string, number>;
}

/** The {placeholders} in a line. */
const placeholders = (text: string) => new Set(text.match(/\{[^{}]+\}/g) ?? []);

/** Forms that may say their number in words (zero, one, two), so may leave {number} out. */
const WORDED = new Set([CATEGORY_CODE.zero, CATEGORY_CODE.one, CATEGORY_CODE.two]);
const CATEGORY_OF = new Map(Object.entries(CATEGORY_CODE).map(([c, n]) => [n, c]));

/** Whether a plural form is for one number alone in a language: 1 in German, not in Russian. */
const forOneNumber = (to: string, category: string) => {
  const rules = new Intl.PluralRules(to);
  let n = 0;
  for (let k = 0; k <= 1000 && n < 2; k++) if (rules.select(k) === category) n++;
  return n === 1;
};

/** The language an entry's source text is in: fbtee's built-in strings are English. */
export const sourceLanguageOf = (
  hash: string,
  builtin: ReadonlySet<string>,
  sourceLocale: string,
) => (builtin.has(hash) ? "en" : sourceLocale);

/**
 * What would break the app in a translation into `to` of these source lines, in words Void's AI
 * is told when it's asked again. Empty: nothing. A form for one number alone may say its number
 * in words and drop {number}: Arabic's "two" is "باقي مكانين" (2026-11-18), Russian's one keeps
 * it, being 21 and 31 too (Intl.PluralRules).
 */
export function problemsWith(
  source: SourceLine[],
  lines: (string | undefined)[],
  to: string,
): string[] {
  if (lines.length !== source.length)
    return [`Give exactly ${source.length} line(s), one per source line.`];
  const problems: string[] = [];
  const all = new Set(source.flatMap((l) => [...placeholders(l.translation)]));
  lines.forEach((line, i) => {
    if (line === undefined || !line.trim()) {
      problems.push(`Line ${i + 1} is missing.`);
      return;
    }
    const has = placeholders(line);
    for (const x of has)
      if (!all.has(x)) problems.push(`Line ${i + 1} has ${x}, which the source hasn't: remove it.`);
    const worded = Object.values(source[i]!.variations).some(
      (v) => WORDED.has(v) && forOneNumber(to, CATEGORY_OF.get(v)!),
    );
    if (!worded)
      for (const x of all)
        if (!has.has(x)) problems.push(`Line ${i + 1} must keep the placeholder ${x} exactly.`);
  });
  return problems;
}

/**
 * What would break the app in a post's translation: a field missing or empty, a {placeholder}
 * lost or made up (a post rarely has any).
 */
export function fieldProblems(
  fields: Record<string, string>,
  answer: Record<string, string | undefined>,
): string[] {
  return Object.entries(fields).flatMap(([k, text]) => {
    const got = answer[k];
    if (!got?.trim()) return text.trim() ? [`The field "${k}" is missing.`] : [];
    const want = placeholders(text);
    const has = placeholders(got);
    return [
      ...[...want].filter((x) => !has.has(x)).map((x) => `"${k}" must keep ${x} exactly.`),
      ...[...has].filter((x) => !want.has(x)).map((x) => `"${k}" has ${x}, which the post hasn't.`),
    ];
  });
}
