// Plural forms, end to end with fbtee's real compiler and runtime: void-fbtee adds the lines,
// a translator fills them, fbtee's translateSync compiles them, and fbtee's runtime picks the
// right one for each count.
import { describe, expect, test } from "vite-plus/test";
import { CATEGORY_CODE, pluralCategories, type PluralEntry } from "../../src/plurals";
import { compiled, phrasesFrom, prepare as prepareFor, type Prepared } from "./fbtee-run";
import { got } from "./got";

// The two ways to write a count.
const SOURCE = `import { fbt } from "fbtee";
const param = (n) => <fbt desc="nights, param"><fbt:param name="count" number={n}>{n}</fbt:param> nights</fbt>;
const plural = (n) => <fbt desc="nights, plural"><fbt:plural count={n} many="nights" showCount="yes">night</fbt:plural></fbt>;
`;
const phrases = phrasesFrom("s.jsx", SOURCE);
const hashOf: Record<string, string> = Object.fromEntries(
  phrases.flatMap((p) => Object.entries(p.hashToLeaf ?? {}).map(([h, l]) => [l.text, h])),
);
const PARAM = got(hashOf["{count} nights"]);
const PLURAL = got(hashOf["{number} nights"]);
const ONE = got(hashOf["1 night"]);

const prepare = (locale: string, existing?: object) => prepareFor(phrases, locale, existing);

/** Fill every line as a translator would: `forms` by category, {n} for the count. */
const translate = (catalog: Prepared, forms: Record<string, string>) => {
  const byCode = Object.fromEntries(
    Object.entries(CATEGORY_CODE).map(([cat, code]) => [code, forms[cat]]),
  );
  for (const [hash, e] of Object.entries(catalog.translations)) {
    if (hash === ONE) {
      e.translations = [{ translation: got(forms.one).replace("{n}", "1") }];
    } else if (hash === PARAM || hash === PLURAL) {
      for (const line of got(e.translations)) {
        const code = line.variations?.[0];
        const text = code === undefined ? got(forms.other) : got(byCode[Number(code)]);
        line.translation = text.replace("{n}", hash === PARAM ? "{count}" : "{number}");
      }
    }
    e.status = "translated";
  }
  return catalog;
};

/** Both strings, rendered by fbtee's runtime for each count. */
const render = (catalog: Prepared, counts: Array<number>) => {
  const fn = compiled("s.jsx", SOURCE, ["param", "plural"], phrases, catalog);
  return counts.map((n) => [n, String(fn("param")(n)), String(fn("plural")(n))]);
};

const lines = (e: PluralEntry) => got(e.translations).map((l) => l.variations);

describe("which forms a catalog gets", () => {
  test("one line per form the locale uses; none where it has one form", () => {
    expect(pluralCategories("pl-PL", false)).toEqual(["one", "few", "many", "other"]);
    expect(pluralCategories("ar-EG", false)).toEqual([
      "zero",
      "one",
      "two",
      "few",
      "many",
      "other",
    ]);
    // <fbt:plural> has its own form for exactly 1, so German and English need nothing more.
    expect(pluralCategories("de-DE", true)).toEqual(["other"]);
    const pl = prepare("pl-PL").translations;
    expect(pl[PARAM]).toMatchObject({ status: "new", tokens: ["count"], types: [28] });
    expect(lines(got(pl[PARAM]))).toEqual([{ 0: 4 }, { 0: 20 }, { 0: 12 }, { 0: 24 }]);
    // Polish "one" is only ever 1, which "1 night" already covers.
    expect(lines(got(pl[PLURAL]))).toEqual([{ 0: 20 }, { 0: 12 }, { 0: 24 }]);
    expect(got(pl[ONE]).tokens).toEqual([]);
    // One form only: fbtee's single line, as it prepared it.
    expect(lines(got(prepare("th-TH").translations[PARAM]))).toEqual([{}]);
    expect(lines(got(prepare("de-DE").translations[PLURAL]))).toEqual([{}]);
    expect(lines(got(prepare("de-DE").translations[PARAM]))).toEqual([{ 0: 4 }, { 0: 24 }]);
  });
});

describe("the runtime picks the right form", () => {
  test("Polish", () => {
    const pl = translate(prepare("pl-PL"), {
      one: "{n} noc",
      few: "{n} noce",
      many: "{n} nocy",
      other: "{n} nocy",
    });
    expect(render(pl, [0, 1, 2, 5, 12, 22, 25])).toEqual([
      [0, "0 nocy", "0 nocy"],
      [1, "1 noc", "1 noc"],
      [2, "2 noce", "2 noce"],
      [5, "5 nocy", "5 nocy"],
      [12, "12 nocy", "12 nocy"],
      [22, "22 noce", "22 noce"],
      [25, "25 nocy", "25 nocy"],
    ]);
  });

  test("Arabic, all six forms", () => {
    const ar = translate(prepare("ar-EG"), {
      zero: "لا ليالٍ",
      one: "ليلة واحدة",
      two: "ليلتان",
      few: "{n} ليالٍ",
      many: "{n} ليلة",
      other: "{n} ليلة",
    });
    // ar-EG writes numbers in Arabic-Indic digits.
    expect(render(ar, [0, 1, 2, 3, 11, 100])).toEqual([
      [0, "لا ليالٍ", "لا ليالٍ"],
      [1, "ليلة واحدة", "ليلة واحدة"],
      [2, "ليلتان", "ليلتان"],
      [3, "٣ ليالٍ", "٣ ليالٍ"],
      [11, "١١ ليلة", "١١ ليلة"],
      [100, "١٠٠ ليلة", "١٠٠ ليلة"],
    ]);
  });
});

describe("running prepare again", () => {
  test("keeps a finished entry exactly as it is", () => {
    const done = translate(prepare("pl-PL"), {
      one: "{n} noc",
      few: "{n} noce",
      many: "{n} nocy",
      other: "{n} nocy",
    });
    expect(prepare("pl-PL", done).translations).toEqual(done.translations);
  });

  test("an entry translated without forms gets them, keeps its text, and is new again", () => {
    const old = prepare("th-TH"); // no forms
    old["fb-locale"] = "pl-PL";
    old.translations[PARAM] = {
      status: "translated",
      tokens: [],
      types: [],
      translations: [{ translation: "noce: {count}", variations: {} }],
    };
    const e = got(prepare("pl-PL", old).translations[PARAM]);
    expect(e.status).toBe("new");
    expect(got(e.translations).map((l) => l.translation)).toEqual(Array(4).fill("noce: {count}"));
  });
});

// fbtee#83, fixed in fbtee 6: a plural that doesn't show its count still varies by it.
describe('a hidden count (showCount="no")', () => {
  const HIDDEN = `import { fbt } from "fbtee";
const left = (n) => <fbt desc="seats left, count hidden"><fbt:plural count={n} many="seats are left" showCount="no">One seat is left</fbt:plural></fbt>;
`;
  const ph = phrasesFrom("h.jsx", HIDDEN);
  const prepared = prepareFor(ph, "ar-EG");

  test("gets a line for each form Arabic uses, and the runtime picks the right one", () => {
    const forms: Record<number, string> = {
      [CATEGORY_CODE.zero]: "لا مقاعد",
      [CATEGORY_CODE.two]: "مقعدان",
      [CATEGORY_CODE.few]: "بضعة مقاعد",
      [CATEGORY_CODE.many]: "مقاعد كثيرة",
      [CATEGORY_CODE.other]: "مقاعد",
    };
    for (const e of Object.values(prepared.translations)) {
      // The exactly-one string has no forms; the other gets one line per form, 1 aside.
      if (!Object.keys(got(got(e.translations)[0]).variations ?? {}).length) {
        e.translations = [{ translation: "مقعد واحد" }];
      } else {
        expect(got(e.translations).map((l) => Number(got(l.variations)[0]))).toEqual(
          (["zero", "two", "few", "many", "other"] as const).map((c) => CATEGORY_CODE[c]),
        );
        for (const l of got(e.translations)) {
          l.translation = got(forms[Number(got(l.variations)[0])]);
        }
      }
      e.status = "translated";
    }
    const left = compiled("h.jsx", HIDDEN, ["left"], ph, prepared)("left");
    expect([0, 1, 2, 3, 11, 100].map((n) => left(n))).toEqual([
      "لا مقاعد",
      "مقعد واحد",
      "مقعدان",
      "بضعة مقاعد",
      "مقاعد كثيرة",
      "مقاعد",
    ]);
  });
});

// A person's gender, alone and with a count: fbtee names the tokens (types 3 a gender, 28 a
// count), void-fbtee adds a line per gender and per combination, each keyed by its own token, and
// fbtee's runtime picks the right one. Before, a name and a count in one string had its plural
// lines filed under the name's key (2026-11-15).
describe("a name's gender, alone and with a count", () => {
  const PEOPLE = `import { fbt } from "fbtee";
const booked = (name, g) => <fbt desc="someone booked"><fbt:name name="name" gender={g}>{name}</fbt:name> booked.</fbt>;
const seats = (name, g, n) => <fbt desc="someone booked seats"><fbt:name name="name" gender={g}>{name}</fbt:name> booked <fbt:plural count={n} many="seats" showCount="yes">seat</fbt:plural>.</fbt>;
`;
  const ph = phrasesFrom("p.jsx", PEOPLE);
  const prepared = prepareFor(ph, "ar-EG");
  const G: Record<number, string> = { 1: "he", 2: "she", 3: "they" };

  test("a line per gender, and per gender and plural form, each keyed by its own token", () => {
    const shapes = Object.values(prepared.translations)
      .filter((e) => e.tokens?.includes("name"))
      .map((e) => ({ tokens: e.tokens, lines: got(e.translations).length, status: e.status }));
    expect(shapes).toContainEqual({ tokens: ["name"], lines: 3, status: "new" });
    // Arabic's five forms besides exactly one, times three genders.
    expect(shapes).toContainEqual({ tokens: ["name", "number"], lines: 15, status: "new" });
  });

  test("fbtee's runtime picks the line for the person's gender and the count", () => {
    for (const e of Object.values(prepared.translations)) {
      for (const l of got(e.translations)) {
        const v = l.variations ?? {};
        const who = G[Number(v[0])] ?? "x";
        l.translation = e.tokens?.includes("number")
          ? `${who} {name} ${Number(v[1])} {number}`
          : `${who} {name}`;
      }
      e.status = "translated";
    }
    const fn = compiled("p.jsx", PEOPLE, ["booked", "seats"], ph, prepared);
    const booked = fn("booked");
    const seats = fn("seats");
    expect([1, 2, 3].map((g) => String(booked("Sara", g)))).toEqual([
      "he Sara",
      "she Sara",
      "they Sara",
    ]);
    // 3 is few (20) in Arabic, 11 many (12); the count in Arabic's own digits, as Intl writes it.
    const n = (x: number) => new Intl.NumberFormat("ar-EG").format(x);
    expect(String(seats("Sara", 2, 3))).toBe(`she Sara ${CATEGORY_CODE.few} ${n(3)}`);
    expect(String(seats("Ali", 1, 11))).toBe(`he Ali ${CATEGORY_CODE.many} ${n(11)}`);
  });
});
