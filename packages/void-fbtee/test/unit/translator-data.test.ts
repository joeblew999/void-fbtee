// The translator test's own data (test/translator/), before anything is sent to Void's AI: every
// language's catalog has every test string translated, each translation passes the judge in its
// script (judge.ts problemsWith), and every language has a model (models.ts).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import { catalogFile, collect, missing } from "../../src/catalogs";
import { loadProject } from "../../src/commands";
import { problemsWith } from "../../src/judge";
import { CANDIDATES, CHOICES, choiceFor, modelById, modelFor } from "../../src/models";

const APP = join(import.meta.dirname, "../translator/app");
const p = await loadProject(APP);
const { texts, builtinHashes } = collect(p);
const locales = p.config.locales.map((l) => l.locale).filter((l) => l !== p.config.sourceLocale);

test("every catalog has every string translated", () => {
  expect(missing(p).filter((m) => m.app.length || m.builtin || m.noCatalog)).toEqual([]);
});

for (const locale of locales) {
  test(`${locale}: each test string's translation passes the judge, and the language has a model`, () => {
    const cat = JSON.parse(readFileSync(catalogFile(p, locale), "utf8")) as {
      translations: Record<
        string,
        { translations: { translation: string; variations: Record<string, number> }[] }
      >;
    };
    for (const [hash, e] of Object.entries(cat.translations)) {
      if (builtinHashes.has(hash)) continue;
      const source = e.translations.map((l) => ({
        translation: texts[hash]!,
        variations: l.variations,
      }));
      expect(
        problemsWith(
          source,
          e.translations.map((l) => l.translation),
          locale,
        ),
        `${locale} ${texts[hash]}`,
      ).toEqual([]);
    }
    expect(choiceFor(locale), `${locale} has its own entry in models.json`).toBeDefined();
    expect(modelFor(locale).id).toMatch(/^@cf\//);
  });
}

test("models.json: one entry per language, each naming one of its models, with its source", () => {
  const languages = CHOICES.map((c) => c.language);
  expect(new Set(languages).size, "no language twice").toBe(languages.length);
  expect(CANDIDATES.every((m) => m.id.startsWith("@cf/"))).toBe(true);
  for (const c of CHOICES) {
    expect(() => modelById(c.model), c.language).not.toThrow();
    expect(c.why, c.language).not.toBe("");
  }
});
