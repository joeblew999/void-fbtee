// The language picker's list, with the example's three languages and with a hundred.
import { describe, expect, test } from "vite-plus/test";
import { languageEntries, normalize, visitorsOwn } from "../../src/language-list";
import { resolveLocales, type Locale } from "../../src/locales";
import { got } from "./got";

const as = (tags: Array<string>): Array<Locale> => resolveLocales(got(tags[0]), tags).locales;
const EXAMPLE = as(["en-US", "th-TH", "ar-EG"]);

test("each named in itself and in the page's language, by the language alone", () => {
  const th = got(languageEntries(EXAMPLE, "en-US").find((e) => e.locale === "th-TH"));
  // "ไทย", not "ไทย (ไทย)" as Intl names th-TH.
  expect(th.name).toBe("ไทย");
  expect(th.pageName).toBe("Thai");
  const ar = got(languageEntries(EXAMPLE, "th-TH").find((e) => e.locale === "ar-EG"));
  expect(ar.name).toBe("العربية");
  expect(ar.pageName).toBe("อาหรับ");
});

test("in the page language's order", () => {
  expect(languageEntries(EXAMPLE, "en-US").map((e) => e.pageName)).toEqual([
    "Arabic",
    "English",
    "Thai",
  ]);
});

test("by the whole tag where the app has two of a language, and an app's own name wins", () => {
  const two = languageEntries(as(["en-US", "en-GB", "th-TH"]), "en-US", { "th-TH": "ภาษาไทย" });
  expect(two.map((e) => e.name).sort()).toEqual(
    ["American English", "British English", "ภาษาไทย"].sort(),
  );
});

test("the visitor's own languages the app has, best first, no fallback", () => {
  const app = EXAMPLE.map((l) => l.locale);
  expect(visitorsOwn(app, ["th", "en-GB", "th-TH"])).toEqual(["th-TH", "en-US"]);
  expect(visitorsOwn(app, ["fr", "de"])).toEqual([]);
  expect(visitorsOwn(app, ["ar-SA"])).toEqual(["ar-EG"]);
});

describe("with a hundred languages", () => {
  // Two-letter languages, the first 99 in alphabetical order, and Thai.
  const codes =
    "aa ab af ak am an ar as av ay az ba be bg bi bm bn bo br bs ca ce ch co cr cs cu cv cy da de dv dz ee el en eo es et eu fa ff fi fj fo fr fy ga gd gl gn gu gv ha he hi ho hr ht hu hy hz ia id ie ig ii ik io is it iu ja jv ka kg ki kj kk kl km kn ko kr ks ku kv kw ky la lb lg li ln lo lt lu lv mg mh mi mk ml mn mr ms mt my na nb nd ne ng nl nn no nr nv ny oc oj om or os pa pi pl ps pt qu rm rn ro ru rw sa sc sd se sg si sk sl sm sn so sq sr ss st su sv sw ta te tg th ti tk tl tn to tr ts tt tw ty ug uk ur uz ve vi vo wa wo xh yi yo za zh zu".split(
      " ",
    );
  const hundred = as([...codes.slice(0, 99), "th"]);
  const entries = languageEntries(hundred, "en");

  test("every one listed once, in English order", () => {
    expect(entries).toHaveLength(100);
    expect(new Set(entries.map((e) => e.locale)).size).toBe(100);
    const names = entries.map((e) => e.pageName);
    expect(names).toEqual([...names].sort(new Intl.Collator("en").compare));
  });

  test("search finds any of them by either name or the code, ignoring case and accents", () => {
    const find = (q: string) => entries.filter((e) => e.search.includes(normalize(q)));
    expect(find("thai").map((e) => e.locale)).toContain("th");
    expect(find("ไทย").map((e) => e.locale)).toEqual(["th"]);
    expect(find("FR").map((e) => e.locale)).toContain("fr");
    expect(find("espanol").map((e) => e.locale)).toEqual(["es"]);
    for (const e of entries) {
      expect(find(e.pageName).map((x) => x.locale)).toContain(e.locale);
    }
  });
});
