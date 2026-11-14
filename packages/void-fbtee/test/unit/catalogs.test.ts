// The shared catalog logic and the plugin's build check, on a tiny fixture app (test/unit/fixture):
// two strings, "Hello" translated into German, "Goodbye" not.
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vite-plus/test";
import { copyFixture } from "./copy-fixture";
import { build } from "vite";
import { voidFbtee } from "../../src/plugin";
import { collect, missing, runtimeCatalog, runtimeTexts, type Project } from "../../src/catalogs";
import { resolveLocales } from "../../src/locales";

let root: string;
// The fixture is copied for every test, so tests can change catalogs. fbtee resolves from this
// package, so the copy lives next to it.
beforeEach(() => {
  root = copyFixture();
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

const project = (): Project => ({
  root,
  config: resolveLocales("en-US", ["en-US", "de-DE", "th-TH"]),
  translations: "i18n/translations",
  src: ["src/**/*.tsx"],
});
const deFile = () => join(root, "i18n/translations/de-DE.json");

describe("missing translations", () => {
  test("lists the app's untranslated strings per locale, built-ins apart", () => {
    const report = missing(project());
    const de = report.find((r) => r.locale === "de-DE")!;
    const th = report.find((r) => r.locale === "th-TH")!;
    expect(de).toMatchObject({ app: ["Goodbye"], builtin: 12, noCatalog: false });
    expect(th).toMatchObject({ app: ["Hello", "Goodbye"], builtin: 12, noCatalog: true });
  });
});

describe("fbtee's built-in strings", () => {
  test("a translated built-in reaches the runtime catalog", () => {
    const { phrases, builtinHashes } = collect(project());
    const hash = [...builtinHashes][0]!;
    const json = JSON.parse(readFileSync(deFile(), "utf8"));
    json.translations[hash] = {
      status: "translated",
      tokens: [],
      translations: [{ translation: "eingebaut", variations: {} }],
      types: [],
    };
    writeFileSync(deFile(), JSON.stringify(json));
    expect(phrases.length).toBeGreaterThan(12);
    expect(JSON.stringify(runtimeCatalog(project(), "de-DE"))).toContain("eingebaut");
  });
});

describe("failOnMissing", () => {
  const run = (failOnMissing: boolean) =>
    build({
      root,
      // Only the plugin given here, not the fixture's vite.config.ts as well.
      configFile: false,
      logLevel: "silent",
      build: { write: false },
      plugins: voidFbtee({ ...project().config, src: ["src/**/*.tsx"], failOnMissing }),
    });

  test("fails the build when a locale has untranslated strings", async () => {
    await expect(run(true)).rejects.toThrow(/untranslated strings \(failOnMissing is on\)/);
  });

  test("off by default: the build passes", async () => {
    await expect(run(false)).resolves.toBeDefined();
  });
});

describe("runtime texts (dev naming)", () => {
  test("maps fbtee's runtime hashes to the source text", () => {
    expect(Object.values(runtimeTexts(project()))).toEqual(
      expect.arrayContaining(["Hello", "Goodbye"]),
    );
  });
});

// An app written in Arabic: a count has six forms in Arabic, and the code's <fbt:plural> can write
// two (the text, and `many`). So prepare makes a catalog for the source language too, holding only
// the counted strings, and fbtee reads each form from it (checked with fbtee 6.0.0).
describe("a source language with more plural forms than the code can write", () => {
  const arabic = (): Project => ({
    ...project(),
    config: resolveLocales("ar-EG", ["ar-EG", "en-US"]),
  });
  const withNights = () =>
    writeFileSync(
      join(root, "src/nights.tsx"),
      `import { fbt } from "fbtee";
export const nights = (count: number) => (
  <fbt desc="How many nights are booked">
    حجزت <fbt:plural count={count} many="ليالٍ" showCount="yes">ليلة</fbt:plural>
  </fbt>
);
`,
    );

  test("prepare makes the source's own catalog, with only the counted string, in all its forms", async () => {
    withNights();
    const { prepared, sourceNeedsCatalog } = await import("../../src/catalogs");
    expect(sourceNeedsCatalog(arabic())).toBe(true);
    const own = prepared(arabic()).find((c) => c.locale === "ar-EG")!;
    const texts = runtimeTexts(arabic());
    const entries = Object.entries(JSON.parse(own.json).translations) as [
      string,
      { translations: { translation: string; variations: Record<string, number> }[] },
    ][];
    // Only strings with a count: not "Hello" or "Goodbye".
    const lines = entries.flatMap(([, e]) => e.translations.map((l) => l.translation));
    expect(lines.some((l) => l.includes("Hello") || l.includes("Goodbye"))).toBe(false);
    expect(lines.some((l) => l.includes("ليال"))).toBe(true);
    expect(Object.keys(texts).length).toBeGreaterThan(0);
    // fbtee's codes: zero 16, two 8, few 20, many 12, other 24 (exactly 1 is its own string).
    const forms = entries
      .filter(([, e]) => e.translations.some((l) => l.translation.includes("ليال")))
      .map(([, e]) => e.translations.map((l) => Object.values(l.variations)[0]))
      .find((f) => f.length > 1);
    expect(forms?.sort((a, b) => a! - b!)).toEqual([8, 12, 16, 20, 24]);
  });

  test("an English or Thai source needs none", async () => {
    withNights();
    const { sourceNeedsCatalog } = await import("../../src/catalogs");
    expect(sourceNeedsCatalog(project())).toBe(false);
    expect(
      sourceNeedsCatalog({ ...project(), config: resolveLocales("th-TH", ["th-TH", "en-US"]) }),
    ).toBe(false);
  });
});
