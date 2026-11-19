// What void-fbtee hands fbtee's runtime, checked with fbtee's real runtime: regional locales fall
// back per message (de-AT -> de -> source text) in the browser and on the server.
import { describe, expect, test, vi } from "vite-plus/test";
import { collectSync } from "@nkzw/fbtee-compiler";
import { fbt, runWithFbtee, setupLocaleContext } from "fbtee/server";
import { resolveLocales } from "../../src/locales";
import {
  allTranslations,
  fallbacksOf,
  localeContextOptions,
  reportMissing,
  translationsFor,
  type CatalogLoaders,
} from "../../src/runtime";
import { field, parseJson, textField } from "../../src/guards";
import { compiledTables, compiledWith, hashByText, phrasesFrom } from "./fbtee-run";
import { got } from "./got";

const SOURCE = `import { fbt } from "fbtee";
const cart = () => <fbt desc="Shopping cart">Cart</fbt>;
const save = () => <fbt desc="Save button">Save</fbt>;
const hello = () => <fbt desc="Greeting">Hello</fbt>;
`;
const phrases = phrasesFrom("s.jsx", SOURCE);
const hash = hashByText(phrases);
/** fbtee's runtime table for a locale, from editable entries by source text. */
const compile = (locale: string, texts: Record<string, string>) => {
  const translations = Object.fromEntries(
    Object.entries(texts).map(([source, translation]) => [
      got(hash[source], `the hash of "${source}"`),
      {
        status: "translated",
        tokens: [],
        types: [],
        translations: [{ translation, variations: {} }],
      },
    ]),
  );
  return compiledTables(phrases, { "fb-locale": locale, translations });
};
// The plugin's catalog modules: one lazy loader per translated locale.
const catalogs: CatalogLoaders = {
  "de-AT": async () => ({ default: compile("de-AT", { Cart: "Einkaufswagerl" }) }),
  de: async () => ({ default: compile("de", { Cart: "Warenkorb", Save: "Speichern" }) }),
};
const config = resolveLocales("en-US", ["en-US", "de-AT", "de"]);

const strings = () => {
  const fn = compiledWith("s.jsx", SOURCE, ["cart", "save", "hello"], fbt);
  return [fn("cart")(), fn("save")(), fn("hello")()].map(String);
};
// Austrian, then German, then the source text.
const DE_AT = ["Einkaufswagerl", "Speichern", "Hello"];

describe("de-AT falls back to de, then the source text", () => {
  test("server: runWithFbtee with every catalog", async () => {
    const translations = await allTranslations(catalogs);
    const out = runWithFbtee({ locale: "de-AT", sourceLocale: "en-US", translations }, strings);
    expect(out).toEqual(DE_AT);
    // With only its own catalog, as void-fbtee did before, "Save" showed in English.
    const own = (await got(catalogs["de-AT"])()).default;
    expect(runWithFbtee({ locale: "de-AT", translations: own }, strings)[1]).toBe("Save");
  });

  test("browser: setupLocaleContext loads the fallback catalogs", async () => {
    const out = await runWithFbtee({ locale: "en-US", translations: {} }, async () => {
      const context = setupLocaleContext(localeContextOptions(config, catalogs, "de-AT"));
      await context.preloadLocale("de-AT");
      return strings();
    });
    expect(out).toEqual(DE_AT);
  });
});

test("a missing translation is logged once per language and string, however many requests", async () => {
  const translations = await allTranslations(catalogs);
  // Source text by fbtee's runtime hash, the key fbtee reports (the plugin's texts module).
  const both = field(
    parseJson(got(collectSync("s.jsx", SOURCE, { collectPackager: "both" }).output)),
    "phrases",
  );
  const texts = Object.fromEntries(
    (Array.isArray(both) ? both : []).map((p: unknown) => [
      got(textField(p, "hash_key"), "a phrase's hash_key"),
      got(textField(field(field(p, "jsfbt"), "t"), "text"), "a phrase's text"),
    ]),
  );
  expect(Object.keys(texts)).toHaveLength(3);
  const missing = reportMissing(texts);
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  try {
    // Two requests in German, each its own fbtee runtime, as the server makes one per request.
    for (let i = 0; i < 2; i++) {
      runWithFbtee({ locale: "de", translations, onMissingTranslation: missing }, strings);
    }
    expect(warn.mock.calls).toEqual([['void-fbtee: no de translation for "Hello"']]);
  } finally {
    warn.mockRestore();
  }
});

test("text in one language loads that language's catalogs only, with its fallbacks", async () => {
  const loaded: Array<string> = [];
  const spied: CatalogLoaders = Object.fromEntries(
    Object.entries({
      ...catalogs,
      fr: async () => ({ default: compile("fr", { Cart: "Panier" }) }),
    }).map(([l, load]) => [l, () => (loaded.push(l), load())]),
  );
  const t = await translationsFor(spied, "de-AT", {
    sourceLocale: "en-US",
    fallbackLocales: { "de-AT": ["de"] },
  });
  expect(loaded.sort()).toEqual(["de", "de-AT"]);
  expect(Object.keys(t).sort()).toEqual(["de", "de-AT"]);
});

test("fallbacksOf: a locale's natural parents first, as fbtee's own lookup tries them", () => {
  // fr-CA falls back to fr before any configured fallback.
  expect(fallbacksOf("fr-CA", undefined)).toContain("fr");
  expect(fallbacksOf("fr-CA", ["en-US"]).indexOf("fr")).toBeLessThan(
    fallbacksOf("fr-CA", ["en-US"]).indexOf("en-US"),
  );
  // A parent's own fallbacks follow it; "default" applies to every locale.
  expect(fallbacksOf("de-AT", { de: ["nl-NL"], default: ["en-US"] })).toEqual(
    expect.arrayContaining(["de", "nl-NL", "en-US"]),
  );
  // Never to another script: zh-Hant-TW doesn't fall back to zh, which is Hans.
  expect(fallbacksOf("zh-Hant-TW", undefined)).not.toContain("zh");
  expect(fallbacksOf("zh-Hant-TW", undefined)).toContain("zh-Hant");
  // The locale itself isn't its own fallback.
  expect(fallbacksOf("th-TH", undefined)).not.toContain("th-TH");
});
