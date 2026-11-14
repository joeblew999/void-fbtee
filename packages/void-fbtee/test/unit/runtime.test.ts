// What void-fbtee hands fbtee's runtime, checked with fbtee's real runtime: regional locales fall
// back per message (de-AT -> de -> source text) in the browser and on the server.
import { describe, expect, test, vi } from "vite-plus/test";
import { collectSync, transformSync, translateSync } from "@nkzw/fbtee-compiler";
import { fbt, runWithFbtee, setupLocaleContext } from "fbtee/server";
import { resolveLocales } from "../../src/locales";
import {
  allTranslations,
  localeContextOptions,
  reportMissing,
  translationsFor,
  type CatalogLoaders,
} from "../../src/runtime";

const SOURCE = `import { fbt } from "fbtee";
const cart = () => <fbt desc="Shopping cart">Cart</fbt>;
const save = () => <fbt desc="Save button">Save</fbt>;
const hello = () => <fbt desc="Greeting">Hello</fbt>;
`;
const phrases = JSON.parse(
  collectSync("s.jsx", SOURCE, { collectPackager: "text" }).output!,
).phrases;
const hash: Record<string, string> = Object.fromEntries(
  phrases.flatMap((p: any) => Object.entries(p.hashToLeaf).map(([h, l]: any) => [l.text, h])),
);
/** fbtee's runtime table for a locale, from editable entries by source text. */
const compile = (locale: string, texts: Record<string, string>) => {
  const translations = Object.fromEntries(
    Object.entries(texts).map(([source, translation]) => [
      hash[source],
      {
        status: "translated",
        tokens: [],
        types: [],
        translations: [{ translation, variations: {} }],
      },
    ]),
  );
  const group = { "fb-locale": locale, translations };
  return JSON.parse(translateSync(JSON.stringify({ phrases, translationGroups: [group] }), true));
};
// The plugin's catalog modules: one lazy loader per translated locale.
const catalogs: CatalogLoaders = {
  "de-AT": async () => ({ default: compile("de-AT", { Cart: "Einkaufswagerl" }) }),
  de: async () => ({ default: compile("de", { Cart: "Warenkorb", Save: "Speichern" }) }),
};
const config = resolveLocales("en-US", ["en-US", "de-AT", "de"]);

const code = transformSync("s.jsx", SOURCE, { lang: "jsx" }).code.replace(/^import .*$/m, "");
const strings = () =>
  // Runs fbtee's compiled output for the strings above.
  // oxlint-disable-next-line no-implied-eval
  new Function("fbt", `${code}; return [cart(), save(), hello()].map(String);`)(fbt) as string[];
// Austrian, then German, then the source text.
const DE_AT = ["Einkaufswagerl", "Speichern", "Hello"];

describe("de-AT falls back to de, then the source text", () => {
  test("server: runWithFbtee with every catalog", async () => {
    const translations = await allTranslations(catalogs);
    const out = runWithFbtee({ locale: "de-AT", sourceLocale: "en-US", translations }, strings);
    expect(out).toEqual(DE_AT);
    // With only its own catalog, as void-fbtee did before, "Save" showed in English.
    const own = (await catalogs["de-AT"]!()).default;
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
  const texts = Object.fromEntries(
    JSON.parse(collectSync("s.jsx", SOURCE, { collectPackager: "both" }).output!).phrases.map(
      (p: any) => [p.hash_key, p.jsfbt.t.text],
    ),
  );
  const missing = reportMissing(texts);
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  try {
    // Two requests in German, each its own fbtee runtime, as the server makes one per request.
    for (let i = 0; i < 2; i++)
      runWithFbtee({ locale: "de", translations, onMissingTranslation: missing }, strings);
    expect(warn.mock.calls).toEqual([['void-fbtee: no de translation for "Hello"']]);
  } finally {
    warn.mockRestore();
  }
});

test("text in one language loads that language's catalogs only, with its fallbacks", async () => {
  const loaded: string[] = [];
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
