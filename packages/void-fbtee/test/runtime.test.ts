// What void-fbtee hands fbtee's runtime, checked with fbtee's real runtime: regional locales fall
// back per message (de-AT -> de -> source text) in the browser and on the server.
import { describe, expect, test } from "vite-plus/test";
import { collectSync, transformSync, translateSync } from "@nkzw/fbtee-compiler";
import { fbt, runWithFbtee, setupLocaleContext } from "fbtee/server";
import { resolveLocales } from "../src/locales";
import { allTranslations, localeContextOptions, type CatalogLoaders } from "../src/runtime";

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
