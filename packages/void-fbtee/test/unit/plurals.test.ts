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
  addPluralForms,
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
    addPluralForms(
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
    expect(prepare("th-TH").translations[PARAM]!.tokens).toEqual([]);
    expect(prepare("de-DE").translations[PLURAL]!.tokens).toEqual([]);
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
