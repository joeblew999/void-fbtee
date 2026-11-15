// Whether a translation is right: one judge for every translation void-fbtee makes or tests.
// `vp dev` asks it before writing a string to the catalog (translate.ts translateEntry: anything it
// finds goes back to Void's AI as what to fix), and the translator test asks it about every answer
// (e2e/translator/). It answers in two kinds of words:
// - problems (problemsWith): what breaks an app, so an answer with any is never kept: lines missing,
//   JSON in a line, text left in the source language, the wrong script, a placeholder, command,
//   file name or path changed;
// - signals, for the test to rank answers and choose what a person reads: the meaning score
//   (ai.ts meaningScore: Workers AI's multilingual embeddings), the score against a reference
//   (test/translator/score.ts), and a verdict once someone has read the answer
//   (test/translator/verdicts.ts).

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
 * What a translation keeps exactly as the source writes it: commands (`vp dev`), file names
 * (`AGENTS.md`), paths (`i18n/translations`) and lower-case names with a hyphen (`void-fbtee`).
 */
export function keptTerms(text: string): string[] {
  return (
    text.match(
      /\bvp [a-z]+\b|[\w-]+\.(?:md|mdx|ts|tsx|js|json|ya?ml)\b|\b[\w.-]+(?:\/[\w.-]+)+|\b[a-z0-9]+(?:-[a-z0-9]+)+\b/g,
    ) ?? []
  ).map((t) => t.replace(/[.-]+$/, "")); // a sentence's own full stop isn't part of a path
}

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
  return own.test(line) && !/\b[a-z']+(?:\s+[a-z']+){3}\b/.test(line);
}

/**
 * What's wrong with a translated entry into `to`, in words Void's AI is told when it's asked
 * again. Empty: nothing breaks an app.
 */
export function problemsWith(source: SourceLine[], lines: string[], to?: string): string[] {
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
    else if (line.trim() === src.trim() && words(line) >= 3)
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
    const worded = Object.values(source[i]!.variations).some((v) => WORDED.has(v));
    if (!worded)
      for (const x of all)
        if (!has.has(x)) problems.push(`Line ${i + 1} must keep the placeholder ${x} exactly.`);
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
