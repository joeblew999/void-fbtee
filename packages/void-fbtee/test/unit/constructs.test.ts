// Every fbtee construct, through fbtee's own collect and prepare and void-fbtee's variant lines
// (plurals.ts addVariants, as catalogs.ts prepared() runs them for the dev server), into Arabic:
// the lines each string gets. fbtee marks what changes a sentence's words (`types`: 28 a count, 3 a
// gender, wherever it comes from); a pronoun, an enum's value and a list are their own entries or
// fbtee's built-in strings, so one line each.
import { expect, test } from "vite-plus/test";
import { collectSync, prepareTranslationsBatchSync } from "@nkzw/fbtee-compiler";
import { addVariants, pluralSlots, type PluralEntry } from "../../src/plurals";

const SOURCE = `import { fbt } from "fbtee";
const a = (g) => <fbt desc="subject" subject={g}>You booked.</fbt>;
const b = (x, g) => <fbt desc="param gender"><fbt:param name="who" gender={g}>{x}</fbt:param> booked.</fbt>;
const c = (n) => <fbt desc="param number"><fbt:param name="n" number={n}>{n}</fbt:param> nights</fbt>;
const d = (x, g, n) => <fbt desc="param gender and number"><fbt:param name="who" gender={g}>{x}</fbt:param> booked <fbt:param name="n" number={n}>{n}</fbt:param> seats</fbt>;
const e = (x, g) => <fbt desc="name"><fbt:name name="name" gender={g}>{x}</fbt:name> booked.</fbt>;
const f = (g) => <fbt desc="pronoun"><fbt:pronoun type="subject" gender={g} human={true} capitalize={true} /> booked.</fbt>;
const j = (w) => <fbt desc="enum"><fbt:enum enum-range={{ a: "in person", b: "online" }} value={w} /></fbt>;
const k = (n) => <fbt desc="plural"><fbt:plural count={n} many="seats" showCount="ifMany">a seat</fbt:plural></fbt>;
const l = (items) => <fbt desc="list"><fbt:list items={items} name="xs" conjunction="or" delimiter="semicolon" /></fbt>;
const m = (g, n) => <fbt desc="subject and plural" subject={g}>You booked <fbt:plural count={n} many="seats" showCount="yes">seat</fbt:plural>.</fbt>;
`;
const phrases = JSON.parse(
  collectSync("s.jsx", SOURCE, { collectPackager: "text" }).output!,
).phrases;
const catalog = JSON.parse(
  addVariants(
    prepareTranslationsBatchSync(JSON.stringify({ phrases }), [{ locale: "ar-EG" }])[0]!,
    pluralSlots(phrases),
    "ar-EG",
  ),
) as { translations: Record<string, PluralEntry> };
const text: Record<string, string> = {};
for (const ph of phrases)
  for (const [hash, leaf] of Object.entries<{ desc: string; text: string }>(ph.hashToLeaf ?? {}))
    text[hash] = `${leaf.desc}: ${leaf.text}`;
const lines = Object.fromEntries(
  Object.entries(catalog.translations).map(([hash, e]) => [text[hash], e.translations!.length]),
);

test("each construct gets the lines its variants need in Arabic", () => {
  expect(lines).toMatchObject({
    // A gender: fbtee's three, wherever it comes from.
    "subject: You booked.": 3,
    "param gender: {who} booked.": 3,
    "name: {name} booked.": 3,
    // A count: Arabic's six plural forms (a <fbt:plural> has "1 seat" as its own entry, so five).
    "param number: {n} nights": 6,
    "plural: {number} seats": 5,
    "plural: a seat": 1,
    // Both: every combination.
    "param gender and number: {who} booked {n} seats": 18,
    "subject and plural: You booked {number} seats.": 15,
    "subject and plural: You booked 1 seat.": 3,
    // Their own entries, or fbtee's built-in strings: one line each.
    "pronoun: She booked.": 1,
    "pronoun: He booked.": 1,
    "pronoun: They booked.": 1,
    "enum: in person": 1,
    "enum: online": 1,
    "list: {xs}": 1,
  });
});
