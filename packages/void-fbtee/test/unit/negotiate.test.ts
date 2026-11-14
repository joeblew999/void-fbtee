// negotiate() gives fbtee's own answer: each case is run through fbtee's public
// setupLocaleContext({ clientLocales, fallbackLocale }).getLocale() (here, where its global setup
// does no harm) and through negotiate(), and the two must be equal. An fbtee upgrade that changes
// its rule then fails here instead of drifting.
import { setupLocaleContext } from "fbtee";
import { describe, expect, test } from "vite-plus/test";
import { acceptedLanguages, negotiate } from "../../src/negotiate";

const fbtee = (visitor: string[], locales: string[], fallbackLocale: string) =>
  setupLocaleContext({
    availableLanguages: new Map(locales.map((l) => [l, l])),
    clientLocales: visitor,
    fallbackLocale,
    sourceLocale: "en-US",
    loadLocale: async () => ({}),
  }).getLocale();

const EXAMPLE = ["en-US", "th-TH", "ar-EG"];
const MANY = [
  "en-US",
  "en-GB",
  "es-ES",
  "es-419",
  "pt-BR",
  "pt-PT",
  "zh-Hans",
  "zh-Hant",
  "sr-Cyrl",
  "sr-Latn",
  "th-TH",
  "ar-EG",
  "fr-FR",
];
const VISITORS = [
  ["th"],
  ["ar-SA"],
  ["ar-MA"],
  ["en-GB"],
  ["en-AU"],
  ["es-MX"],
  ["pt-AO"],
  ["zh-HK"],
  ["zh-Hant"],
  ["sr-Latn"],
  ["fr"],
  ["de"],
  [],
  // Whole lists: the first the site can serve wins.
  ["fr", "th"],
  ["en-GB", "th"],
  ["ar-MA", "en"],
  ["de", "ja", "ar"],
];

describe("negotiate() equals fbtee's setupLocaleContext().getLocale()", () => {
  for (const [name, locales] of [
    ["the example's languages", EXAMPLE],
    ["a site with many", MANY],
  ] as const)
    for (const fallback of ["en-US", "th-TH"])
      for (const visitor of VISITORS)
        test(`${name}, fallback ${fallback}: [${visitor.join(", ")}]`, () => {
          expect(negotiate(visitor, locales, fallback)).toBe(
            fbtee(visitor, [...locales], fallback),
          );
        });
});

test("the example: inherited languages and ones it doesn't have", () => {
  expect(negotiate(["th"], EXAMPLE, "en-US")).toBe("th-TH");
  expect(negotiate(["ar-SA"], EXAMPLE, "en-US")).toBe("ar-EG");
  expect(negotiate(["en-GB"], EXAMPLE, "en-US")).toBe("en-US");
  expect(negotiate(["fr", "th"], EXAMPLE, "en-US")).toBe("th-TH");
  expect(negotiate(["fr"], EXAMPLE, "th-TH")).toBe("th-TH");
  expect(negotiate([], EXAMPLE, "en-US")).toBe("en-US");
});

describe("reading Accept-Language", () => {
  test("best first, by q, the header's own order breaking ties", () => {
    expect(acceptedLanguages("th-TH,th;q=0.9,en;q=0.8")).toEqual(["th-TH", "th", "en"]);
    expect(acceptedLanguages("en;q=0.5, fr, th;q=0.5")).toEqual(["fr", "en", "th"]);
  });
  test("*, q=0 and malformed tags are skipped", () => {
    expect(acceptedLanguages("*, fr;q=0, th;q=0.4, not a tag!, ar")).toEqual(["ar", "th"]);
  });
  test("none, or an empty header", () => {
    expect(acceptedLanguages(null)).toEqual([]);
    expect(acceptedLanguages("")).toEqual([]);
  });
  test("only the first 20 entries are read", () => {
    const header = [...Array.from({ length: 20 }, () => "de"), "th"].join(",");
    expect(acceptedLanguages(header)).not.toContain("th");
    expect(acceptedLanguages(header)).toHaveLength(20);
  });
});

test("negotiate() keeps nothing between calls", async () => {
  // fbtee's own getLocaleHierarchy stores every tag in a Map; this module's state is only its
  // constants, so many different tags leave nothing behind (no module-level Map or Set to grow).
  const source = await import("node:fs").then((fs) =>
    fs.readFileSync(new URL("../../src/negotiate.ts", import.meta.url), "utf8"),
  );
  expect(source).not.toMatch(/^(const|let|var) \w+ = (\/\* @__PURE__ \*\/ )?new (Map|Set)/m);
});
