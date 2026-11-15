// The English strings every language is tested on (e2e/translator/): what an app's catalog holds,
// with each thing a translation can get wrong. Each entry is as `vp dev` sends a new one: its
// description, and its source lines (a count has one line per plural form of the language, each
// the source text, as fbtee's prepare writes it: formsFor). Add a string when Void's AI gets a new
// kind of thing wrong, with its reference translation in every language (references.ts).

export interface TestString {
  /** What it tests, for the report, and its key in references.ts. */
  name: string;
  description: string;
  lines: { text: string; variations: Record<string, number> }[];
  /** A count: the test gives it one line per plural form of the language (formsFor). */
  plural?: boolean;
}

/** fbtee's plural form codes, by Intl's plural category (catalogs.ts, plurals.ts). */
const CODES: Record<string, number> = { zero: 16, one: 4, two: 8, few: 20, many: 12, other: 24 };

/** A count's lines for a language: one per form it uses, in the order of CODES. */
export const formsFor = (locale: string, text: string) => {
  const has = new Intl.PluralRules(locale).resolvedOptions().pluralCategories as string[];
  return Object.keys(CODES)
    .filter((c) => has.includes(c))
    .map((c) => ({ text, variations: { "0": CODES[c]! } }));
};

const one = (name: string, description: string, text: string): TestString => ({
  name,
  description,
  lines: [{ text, variations: {} }],
});
const plural = (name: string, description: string, text: string): TestString => ({
  name,
  description,
  lines: [{ text, variations: { "0": 24 } }],
  plural: true,
});

export const STRINGS: TestString[] = [
  one("a label", "Button that saves the event the person is editing", "Save"),
  one(
    "a sentence",
    "Line under the form, telling the person what happens after they post",
    "Your event shows in every language once it's posted.",
  ),
  one(
    "a placeholder",
    "Greeting at the top of an email, with the person's name",
    "Hello {name}, your ticket is attached.",
  ),
  one(
    "two placeholders",
    "Progress line on the docs page: how many strings are translated",
    "{translated} of {total} strings translated",
  ),
  plural("a plural", "How many seats are left at an event", "{number} seats left"),
  one(
    "a command",
    "Docs line saying which command to run to start the dev server",
    "Run vp dev to start the app.",
  ),
  one(
    "a file name",
    "Docs line saying where the app's agent instructions are",
    "The app's AGENTS.md tells your coding agent what to do.",
  ),
  one(
    "a product name",
    "Docs line saying which tools translate the app",
    "Void's AI or Claude Code translates what's new.",
  ),
  one(
    "a path",
    "Docs line saying where the catalogs are",
    "Each language's catalog is in i18n/translations.",
  ),
  one(
    "a question",
    "Heading of the page's last section, asking whether the reader is ready",
    "Ready to translate your app?",
  ),
];
