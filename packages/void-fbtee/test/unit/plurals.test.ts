// Plural forms, end to end with fbtee's real compiler and runtime: void-fbtee adds the lines,
// a translator fills them, fbtee's translateSync compiles them, and fbtee's runtime picks the
// right one for each count.
import { describe, expect, test } from "vite-plus/test";
import {
  collectSync,
  prepareTranslationsBatchSync,
  transformSync,
  translateSync,
} from "@nkzw/fbtee-compiler";
import { createFbteeRuntime } from "fbtee";
import {
  addVariants,
  CATEGORY_CODE,
  pluralCategories,
  pluralSlots,
  type PluralEntry,
} from "../../src/plurals";

// The two ways to write a count.
const SOURCE = `import { fbt } from "fbtee";
const param = (n) => <fbt desc="nights, param"><fbt:param name="count" number={n}>{n}</fbt:param> nights</fbt>;
const plural = (n) => <fbt desc="nights, plural"><fbt:plural count={n} many="nights" showCount="yes">night</fbt:plural></fbt>;
`;
const phrases = JSON.parse(
  collectSync("s.jsx", SOURCE, { collectPackager: "text" }).output!,
).phrases;
const slots = pluralSlots(phrases);
const hashOf: Record<string, string> = Object.fromEntries(
  phrases.flatMap((p: any) => Object.entries(p.hashToLeaf).map(([h, l]: any) => [l.text, h])),
);
const PARAM = hashOf["{count} nights"]!;
const PLURAL = hashOf["{number} nights"]!;
const ONE = hashOf["1 night"]!;

const prepare = (locale: string, existing?: object) =>
  JSON.parse(
    addVariants(
      prepareTranslationsBatchSync(JSON.stringify({ phrases }), [
        existing ? { locale, existingJson: JSON.stringify(existing) } : { locale },
      ])[0]!,
      slots,
      locale,
    ),
  ) as { "fb-locale": string; translations: Record<string, PluralEntry> };

/** Fill every line as a translator would: `forms` by category, {n} for the count. */
const translate = (catalog: ReturnType<typeof prepare>, forms: Record<string, string>) => {
  const byCode = Object.fromEntries(
    Object.entries(CATEGORY_CODE).map(([cat, code]) => [code, forms[cat]]),
  );
  for (const [hash, e] of Object.entries(catalog.translations)) {
    if (hash === ONE) e.translations = [{ translation: forms.one!.replace("{n}", "1") }];
    else if (hash === PARAM || hash === PLURAL)
      for (const line of e.translations!) {
        const code = line.variations?.[0];
        const text = code === undefined ? forms.other! : byCode[Number(code)]!;
        line.translation = text.replace("{n}", hash === PARAM ? "{count}" : "{number}");
      }
    e.status = "translated";
  }
  return catalog;
};

/** Both strings, rendered by fbtee's runtime for each count. */
const render = (catalog: ReturnType<typeof prepare>, counts: number[]) => {
  const locale = catalog["fb-locale"];
  const table = JSON.parse(
    translateSync(JSON.stringify({ phrases, translationGroups: [catalog] }), true),
  )[locale];
  const { fbt } = createFbteeRuntime({ locale, translations: { [locale]: table } });
  const code = transformSync("s.jsx", SOURCE, { lang: "jsx" }).code.replace(/^import .*$/m, "");
  // Runs fbtee's compiled output for the strings above.
  // oxlint-disable-next-line no-implied-eval
  const fns = new Function("fbt", `${code}; return { param, plural };`)(fbt);
  return counts.map((n) => [n, String(fns.param(n)), String(fns.plural(n))]);
};

const lines = (e: PluralEntry) => e.translations!.map((l) => l.variations);

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
    expect(lines(pl[PARAM]!)).toEqual([{ 0: 4 }, { 0: 20 }, { 0: 12 }, { 0: 24 }]);
    // Polish "one" is only ever 1, which "1 night" already covers.
    expect(lines(pl[PLURAL]!)).toEqual([{ 0: 20 }, { 0: 12 }, { 0: 24 }]);
    expect(pl[ONE]!.tokens).toEqual([]);
    // One form only: fbtee's single line, as it prepared it.
    expect(lines(prepare("th-TH").translations[PARAM]!)).toEqual([{}]);
    expect(lines(prepare("de-DE").translations[PLURAL]!)).toEqual([{}]);
    expect(lines(prepare("de-DE").translations[PARAM]!)).toEqual([{ 0: 4 }, { 0: 24 }]);
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
    const e = prepare("pl-PL", old).translations[PARAM]!;
    expect(e.status).toBe("new");
    expect(e.translations!.map((l) => l.translation)).toEqual(Array(4).fill("noce: {count}"));
  });
});

// fbtee#83, fixed in fbtee 6: a plural that doesn't show its count still varies by it.
describe('a hidden count (showCount="no")', () => {
  const HIDDEN = `import { fbt } from "fbtee";
const left = (n) => <fbt desc="seats left, count hidden"><fbt:plural count={n} many="seats are left" showCount="no">One seat is left</fbt:plural></fbt>;
`;
  const ph = JSON.parse(collectSync("h.jsx", HIDDEN, { collectPackager: "text" }).output!).phrases;
  const prepared = JSON.parse(
    addVariants(
      prepareTranslationsBatchSync(JSON.stringify({ phrases: ph }), [{ locale: "ar-EG" }])[0]!,
      pluralSlots(ph),
      "ar-EG",
    ),
  ) as { "fb-locale": string; translations: Record<string, PluralEntry> };

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
      if (!e.translations![0]!.variations || !Object.keys(e.translations![0]!.variations).length)
        e.translations = [{ translation: "مقعد واحد" }];
      else {
        expect(e.translations!.map((l) => Number(l.variations![0]))).toEqual(
          (["zero", "two", "few", "many", "other"] as const).map((c) => CATEGORY_CODE[c]),
        );
        for (const l of e.translations!) l.translation = forms[Number(l.variations![0])]!;
      }
      e.status = "translated";
    }
    const table = JSON.parse(
      translateSync(JSON.stringify({ phrases: ph, translationGroups: [prepared] }), true),
    )["ar-EG"];
    const { fbt } = createFbteeRuntime({ locale: "ar-EG", translations: { "ar-EG": table } });
    const code = transformSync("h.jsx", HIDDEN, { lang: "jsx" }).code.replace(/^import .*$/m, "");
    // oxlint-disable-next-line no-implied-eval
    const fn = new Function("fbt", `${code}; return left;`)(fbt);
    expect([0, 1, 2, 3, 11, 100].map((n) => fn(n))).toEqual([
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
  const ph = JSON.parse(collectSync("p.jsx", PEOPLE, { collectPackager: "text" }).output!).phrases;
  const prepared = JSON.parse(
    addVariants(
      prepareTranslationsBatchSync(JSON.stringify({ phrases: ph }), [{ locale: "ar-EG" }])[0]!,
      pluralSlots(ph),
      "ar-EG",
    ),
  ) as { "fb-locale": string; translations: Record<string, PluralEntry> };
  const G: Record<number, string> = { 1: "he", 2: "she", 3: "they" };

  test("a line per gender, and per gender and plural form, each keyed by its own token", () => {
    const shapes = Object.values(prepared.translations)
      .filter((e) => e.tokens?.includes("name"))
      .map((e) => ({ tokens: e.tokens, lines: e.translations!.length, status: e.status }));
    expect(shapes).toContainEqual({ tokens: ["name"], lines: 3, status: "new" });
    // Arabic's five forms besides exactly one, times three genders.
    expect(shapes).toContainEqual({ tokens: ["name", "number"], lines: 15, status: "new" });
  });

  test("fbtee's runtime picks the line for the person's gender and the count", () => {
    for (const e of Object.values(prepared.translations)) {
      for (const l of e.translations!) {
        const v = l.variations ?? {};
        const who = G[Number(v[0])] ?? "x";
        l.translation = e.tokens?.includes("number")
          ? `${who} {name} ${Number(v[1])} {number}`
          : `${who} {name}`;
      }
      e.status = "translated";
    }
    const table = JSON.parse(
      translateSync(JSON.stringify({ phrases: ph, translationGroups: [prepared] }), true),
    )["ar-EG"];
    const { fbt } = createFbteeRuntime({ locale: "ar-EG", translations: { "ar-EG": table } });
    const code = transformSync("p.jsx", PEOPLE, { lang: "jsx" }).code.replace(/^import .*$/m, "");
    // oxlint-disable-next-line no-implied-eval
    const [booked, seats] = new Function("fbt", `${code}; return [booked, seats];`)(fbt);
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
