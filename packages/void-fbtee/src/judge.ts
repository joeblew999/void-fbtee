// Whether a translation is right, by rules, no AI. One checker for every translation, whoever wrote
// it: `vp dev` asks it of each answer before writing it to the catalog (translate.ts: anything it
// finds goes back to Void's AI as what to fix), and `vp build` asks it of every finished catalog
// entry (check.ts), against the entry's source lines. Its problems (problemsWith) are what breaks
// an app: lines missing or one too many for the language's plural forms, JSON in a line, text left
// in the source language, the wrong script, a placeholder, command, file name or path changed, and
// what a language's grammar asks (grammar.json).

import grammar from "./grammar.json" with { type: "json" };
import { CATEGORY_CODE } from "./plurals";

/** A source line, as `vp dev` sends it: its text and, for a count, its plural form. */
export interface SourceLine {
  translation: string;
  variations: Record<string, number>;
}

/** The {placeholders} in a line. */
const placeholders = (text: string) => new Set(text.match(/\{[^{}]+\}/g) ?? []);
/** Forms that may say the number in words (zero, one, two), so may leave {number} out. */
const WORDED = new Set([16, 4, 8]);

/**
 * What a translation keeps exactly as the source writes it: product names (grammar.json
 * keptTerms.products: Void's AI, Claude Code), commands (`vp dev`), file names, dotted
 * ones whole (`AGENTS.md`, `void.config.ts`: both models once cut it to `config.ts`, 2026-11-17), paths (`i18n/translations`) and lower-case names with a hyphen (`void-fbtee`).
 */
export function keptTerms(text: string): string[] {
  return (
    text.match(
      /\bvp [a-z]+\b|[\w-]+(?:\.[\w-]+)*\.(?:md|mdx|ts|tsx|js|json|ya?ml)\b|\b[\w.-]+(?:\/[\w.-]+)+|\b[\w.-]+\/(?=[\s,.;:)]|$)|\b[a-z0-9]+(?:-[a-z0-9]+)+\b/g,
    ) ?? []
  )
    .map((t) => t.replace(/[.-]+$/, "")) // a sentence's own full stop isn't part of a path
    .filter((t) => !t.includes("-") || t.includes("/") || t.includes(".") || isName(t))
    .concat(grammar.keptTerms.products.filter((name) => text.includes(name)));
}

/**
 * A lower-case name with a hyphen kept as written: the packages void-fbtee's apps are built with
 * (grammar.json keptTerms.names). Any other hyphenated phrase is an English compound
 * ("right-to-left", "written-out", "supported-value"), translated like any words: vp build flagged
 * all three as names to keep when it began checking every entry (2026-11-17).
 */
const HYPHEN_NAMES = new Set(grammar.keptTerms.names);
const isName = (t: string) => HYPHEN_NAMES.has(t);
/**
 * The script a language is written in, by CLDR's likely subtags (Intl.Locale.maximize: "th" →
 * Thai), as Unicode script names for a regular expression. Japanese and Korean mix in Han.
 */
const SCRIPTS: Record<string, string[]> = {
  Jpan: ["Hiragana", "Katakana", "Han"],
  Kore: ["Hangul", "Han"],
  Hans: ["Han"],
  Hant: ["Han"],
  Arab: ["Arabic"],
  Hebr: ["Hebrew"],
  Thai: ["Thai"],
  Deva: ["Devanagari"],
  Beng: ["Bengali"],
  Cyrl: ["Cyrillic"],
  Grek: ["Greek"],
  Hang: ["Hangul"],
  Khmr: ["Khmer"],
  Laoo: ["Lao"],
  Mymr: ["Myanmar"],
  Taml: ["Tamil"],
  Telu: ["Telugu"],
  Knda: ["Kannada"],
  Mlym: ["Malayalam"],
  Gujr: ["Gujarati"],
  Guru: ["Gurmukhi"],
  Geor: ["Georgian"],
  Armn: ["Armenian"],
  Ethi: ["Ethiopic"],
  Sinh: ["Sinhala"],
};
export function scriptOf(locale: string): string[] | undefined {
  const script = new Intl.Locale(locale).maximize().script;
  return script ? SCRIPTS[script] : undefined;
}

/**
 * Whether a line is written in its language's script: some of its letters are, and it has no run
 * of four lower-case Latin words, which is English left in (names and commands are short). For a
 * language in Latin letters there's nothing to tell apart: the unchanged-text check covers it.
 */
export function inScript(line: string, locale: string): boolean {
  const scripts = scriptOf(locale);
  if (!scripts) return true;
  const own = new RegExp(scripts.map((s) => `\\p{Script=${s}}`).join("|"), "u");
  const words = line.replace(/\{[^{}]+\}/g, " ");
  // Nothing to write in a script: placeholders and marks alone ("{number}+", list joiners), or
  // only names ("Worker", "PDFs"): a name is written as it is.
  if (!/\p{L}/u.test(words) || /^[\s\p{P}\p{S}]*(?:\p{Lu}[\p{L}']*[\s\p{P}\p{S}]*)+$/u.test(words))
    return true;
  return own.test(line) && !/\b[a-z']+(?:\s+[a-z']+){3}\b/.test(line);
}
/**
 * What's wrong with a translated entry into `to`, in words Void's AI is told when it's asked
 * again. Empty: nothing breaks an app.
 */
/** Whether two locales are the same language (en-US and en-GB are: "en"). */
const sameLanguage = (a?: string, b?: string) =>
  !!a && !!b && a.split("-")[0]!.toLowerCase() === b.split("-")[0]!.toLowerCase();

/** The language an entry's source text is in: fbtee's built-in strings are English. */
export const sourceLanguageOf = (
  hash: string,
  builtin: ReadonlySet<string>,
  sourceLocale: string,
) => (builtin.has(hash) ? "en" : sourceLocale);

export function problemsWith(
  source: SourceLine[],
  lines: string[],
  to?: string,
  from?: string,
): string[] {
  if (lines.length !== source.length)
    return [`Give exactly ${source.length} line(s), one per source line, in order.`];
  const problems: string[] = [];
  const words = (t: string) => t.trim().split(/\s+/).length;
  const all = new Set(source.flatMap((l) => [...placeholders(l.translation)]));
  lines.forEach((line, i) => {
    const src = source[i]!.translation;
    if (!line.trim()) problems.push(`Line ${i + 1} is empty.`);
    // Another string's answer run into this one (Gemma's Chinese "Strings" came back
    // "字符串\n目录", "Strings" and "Catalog", 2026-11-15).
    if (line.trim().includes("\n") && !src.includes("\n"))
      problems.push(`Line ${i + 1} is more than one line: give only its own translation.`);
    // Pieces of the request's JSON in the line (Llama's Arabic plural once read
    // `form": "zero", "target": "…"`, 2026-11-15).
    if (/"\s*:\s*"|\b(?:form|source|target|lines|id)"\s*:/.test(line))
      problems.push(`Line ${i + 1} has JSON in it: give only the translated sentence.`);
    // Only a line with words of its own: "{previous items}; {following items}" is the same in
    // every language. And only into another language: fbtee's built-in strings are English, so
    // their en-US lines in a Thai app are rightly the same (callers pass "en" as their `from`).
    else if (
      !sameLanguage(to, from) &&
      line.trim() === src.trim() &&
      words(line) >= 3 &&
      /\p{L}/u.test(line.replace(/\{[^{}]+\}/g, ""))
    )
      problems.push(`Line ${i + 1} is still the source text: translate it.`);
    else if (to && line.trim() && !inScript(line, to))
      problems.push(
        `Line ${i + 1} isn't written in ${new Intl.DisplayNames("en", { type: "language" }).of(to)}: translate all of it, keeping only names and commands.`,
      );
    for (const t of keptTerms(src))
      if (!line.includes(t)) problems.push(`Line ${i + 1} must keep "${t}" exactly as written.`);
    const has = placeholders(line);
    for (const x of has)
      if (!all.has(x)) problems.push(`Line ${i + 1} has ${x}, which the source hasn't: remove it.`);
    // A form may say its number in words only where it's for one number alone: Russian's one is
    // also 21 and 31, so it keeps {number} (Intl.PluralRules).
    const worded = Object.values(source[i]!.variations).some(
      (v) => WORDED.has(v) && (!to || forOneNumber(to, CATEGORY_OF.get(v)!)),
    );
    if (!worded)
      for (const x of all)
        if (!has.has(x)) problems.push(`Line ${i + 1} must keep the placeholder ${x} exactly.`);
  });
  if (to)
    problems.push(
      ...grammarProblems(
        source,
        lines,
        to,
        from ? { from, lines: source.map((l) => l.translation) } : undefined,
      ),
      ...wordingProblems(source, lines, to),
    );
  return problems;
}

const language = (to: string) => new Intl.Locale(to).language;
/** Whether a plural form is for one number alone in a language: 1 in German, not in Russian. */
const forOneNumber = (to: string, category: string) => {
  const rules = new Intl.PluralRules(to);
  let n = 0;
  for (let k = 0; k <= 1000 && n < 2; k++) if (rules.select(k) === category) n++;
  return n === 1;
};
const nameOf = (to: string) => new Intl.DisplayNames("en", { type: "language" }).of(to) ?? to;
const CATEGORY_OF = new Map(Object.entries(CATEGORY_CODE).map(([c, n]) => [n, c]));
const BOTH_GENDERS = grammar.bothGenders.patterns.map((p) => new RegExp(p, "u"));

/**
 * What a language's grammar asks of the lines, from grammar.json. `vp dev` checks each answer with
 * it (problemsWith), and `vp build` every catalog entry, without the English, so without the first:
 * - a count's lines for forms whose noun differs (one and other: 1 Platz, 2 Plätze) differ, when
 *   the source shows a noun is counted;
 * - a line for a man or a woman has no word written for both (забронировал(а));
 * - a Korean particle right after a placeholder gives both forms (을(를)).
 */
export function grammarProblems(
  source: { variations: Record<string, number> }[],
  lines: string[],
  to: string,
  original?: { from: string; lines: string[] },
): string[] {
  const problems: string[] = [];
  const lang = language(to);
  // Only where a noun is counted ("{seats} seats", not "{number}+") must two forms' lines differ:
  // seen in the source language's own text (grammar.json countedNoun). Without it (vp build), not
  // checked.
  const noun = original
    ? (grammar.pluralLinesDiffer.countedNoun as Record<string, string>)[language(original.from)]
    : undefined;
  const counted = !!noun && original!.lines.some((l) => new RegExp(noun, "u").test(l));
  const pairs = counted
    ? ((grammar.pluralLinesDiffer.languages as Record<string, string[][]>)[lang] ?? [])
    : [];
  const tokens = (i: number) => Object.entries(source[i]!.variations);
  for (let i = 0; i < source.length; i++)
    for (let j = i + 1; j < source.length; j++) {
      // The same but for one plural token: the lines for two forms of one count.
      const a = tokens(i),
        b = source[j]!.variations;
      const differ = a.filter(([k, v]) => b[k] !== v);
      if (differ.length !== 1) continue;
      const [k, v] = differ[0]!;
      const forms = [CATEGORY_OF.get(v), CATEGORY_OF.get(b[k]!)];
      if (!forms[0] || !forms[1]) continue;
      const must = pairs.some(
        ([x, y]) => (x === forms[0] && y === forms[1]) || (x === forms[1] && y === forms[0]),
      );
      if (must && lines[i]!.trim() === lines[j]!.trim())
        problems.push(
          `Lines ${i + 1} (${forms[0]}) and ${j + 1} (${forms[1]}) are the same, but in ${nameOf(to)} the noun changes between those counts: give each line its own form.`,
        );
    }
  lines.forEach((line, i) => {
    const gender = Object.values(source[i]!.variations).find((v) => v === 1 || v === 2);
    if (gender)
      for (const re of BOTH_GENDERS) {
        const m = line.match(re);
        if (m)
          problems.push(
            `Line ${i + 1} is for ${gender === 1 ? "a man" : "a woman"}, but "${m[0]}" is written for both: write the ${gender === 1 ? "male" : "female"} form.`,
          );
      }
    for (const [pattern, what] of (grammar.punctuation.languages as Record<string, string[][]>)[
      lang
    ] ?? [])
      if (new RegExp(pattern!, "u").test(line)) problems.push(`Line ${i + 1} ${what}.`);
    for (const [pattern, what] of (grammar.register.languages as Record<string, string[][]>)[
      lang
    ] ?? [])
      if (new RegExp(pattern!, "u").test(line)) problems.push(`Line ${i + 1} ${what}.`);
    const particles = (grammar.particles.languages as Record<string, string[][]>)[lang] ?? [];
    for (const pair of particles)
      for (const one of pair) {
        const m = line.match(new RegExp(`(\\{[^{}]+\\})${one}(?!\\()`, "u"));
        if (m)
          problems.push(
            `Line ${i + 1} puts "${one}" right after ${m[1]}: the word it stands for may end in a consonant or a vowel, so write both forms, "${pair[0]}(${pair[1]})".`,
          );
      }
  });
  return problems;
}

/** A word in Latin letters: a run of letters, apostrophes and hyphens. */
const LATIN_WORD = /[A-Za-z\u00C0-\u024F\u0400-\u04FF\u0370-\u03FF][\p{L}'’-]*/gu;

/**
 * Wording the source decides, so `vp dev` checks it on each answer (problemsWith), not `vp build`:
 * - a word capitalised in the middle of a sentence where the source has no capital there (not in
 *   German, which capitalises every noun);
 * - in a language in another script, English words left in Latin letters, when the source has
 *   them as plain words, not names, commands or file names.
 */
export function wordingProblems(source: SourceLine[], lines: string[], to: string): string[] {
  const problems: string[] = [];
  const lang = language(to);
  lines.forEach((line, i) => {
    const src = source[i]!.translation;
    const kept = new Set([
      ...keptTerms(src).flatMap((t) => t.split(/[\s/.]+/)),
      ...grammar.noEnglishWords.kept,
    ]);
    // Capitalised in the source: names (Claude Code, Void's AI, Gmail).
    const named = new Set((src.match(LATIN_WORD) ?? []).filter((w) => /^\p{Lu}/u.test(w)));
    // A term's English name in brackets after the language's own word is a gloss, not text left
    // untranslated ("ربط (binding)": the app's catalogs write it so).
    const plain = line
      .replace(/\{[^{}]+\}/g, " ")
      .replace(/`[^`]*`/g, " ")
      .replace(/\([^()]*\)/g, " ");
    const latinScript =
      !scriptOf(to) || /Cyrl|Grek/.test(new Intl.Locale(to).maximize().script ?? "");
    if (latinScript && !grammar.capitals.notChecked.includes(lang)) {
      // Words with a capital that don't start a sentence. A name the source has, translated
      // (Thailand, Tailandia), keeps its capital: so only more of them than the source has count.
      const inside = (text: string) =>
        text
          .split(/[.!?:;]\s+/)
          .flatMap((sentence) => (sentence.trim().match(LATIN_WORD) ?? []).slice(1))
          .filter((w) => /^\p{Lu}\p{Ll}/u.test(w));
      const theirs = inside(src.replace(/\{[^{}]+\}/g, " ")).filter((w) => !plain.includes(w));
      const always = (grammar.capitals.alwaysCapital as Record<string, string[]>)[lang] ?? [];
      const extra = inside(plain).filter(
        (w) => !named.has(w) && !kept.has(w) && !always.includes(w),
      );
      if (extra.length > theirs.length)
        problems.push(
          `Line ${i + 1} writes ${extra.map((w) => `"${w}"`).join(", ")} with a capital in the middle of a sentence: write it in lower case, as ${nameOf(to)} does.`,
        );
    }
    if (grammar.noEnglishWords.languages.includes(lang)) {
      const english = (plain.match(LATIN_WORD) ?? []).filter(
        (w) => /^\p{Ll}+$/u.test(w) && w.length > 1 && !kept.has(w) && !/[0-9_.]/.test(w),
      );
      if (english.length)
        problems.push(
          `Line ${i + 1} leaves "${english.join(" ")}" in English: translate it; only names, commands, file names and placeholders stay in Latin letters.`,
        );
    }
  });
  return problems;
}

/** A glossary word's stem: Arabic's article (ال) and the prefixes before it don't count. */
const stem = (w: string) => w.replace(/^(?:[وفبلك]?ال)/, "");

/**
 * The glossary's words the translation doesn't use, in words for Void's AI: a term the entry's
 * source uses ("strings") should be written as the app writes it ("ข้อความ"). Asked about, not a
 * problem: the last answer is kept without it.
 */
export function glossaryMisses(
  glossary: { source: string; translation: string }[],
  lines: string[],
): string[] {
  const text = lines.join(" ");
  return glossary
    .filter((g) => !g.translation.split(/\s+/).every((w) => text.includes(stem(w))))
    .map((g) => `The app writes "${g.source}" as "${g.translation}": use that word, not another.`);
}

/**
 * What's wrong with a post's translation (what people write, ai.ts translate), each field as one
 * line: the checks the app's own text gets (problemsWith: English left in, the source unchanged,
 * placeholders), and, into a language not written in Latin letters, a capitalised Latin word taken
 * over from the source. That one may be a name, which stays ("Bondi"), or a word left untranslated
 * ("Harbour" in a Thai title, AI Gateway's logs, 2026-11-17): the model is asked again and decides.
 */
export function postProblems(
  fields: Record<string, string>,
  out: Record<string, string>,
  from: string,
  to: string,
): string[] {
  const problems: string[] = [];
  for (const [key, text] of Object.entries(fields)) {
    const line = out[key] ?? "";
    if (!line.trim() && text.trim()) {
      problems.push(`"${key}" is empty: translate it.`);
      continue;
    }
    for (const p of problemsWith([{ translation: text, variations: {} }], [line], to, from))
      problems.push(`"${key}": ${p.replace(/^Line 1 /, "it ")}`);
    if (scriptOf(to)) {
      const source = new Set(text.match(LATIN_WORD) ?? []);
      const kept = [...new Set(line.match(LATIN_WORD) ?? [])].filter(
        (w) => /^\p{Lu}/u.test(w) && source.has(w),
      );
      if (kept.length)
        problems.push(
          `"${key}" keeps ${kept.map((w) => `"${w}"`).join(", ")} in Latin letters: translate ${kept.length > 1 ? "each" : "it"}, unless it's a name (a place, a person, a brand), which stays as written.`,
        );
    }
  }
  return problems;
}
