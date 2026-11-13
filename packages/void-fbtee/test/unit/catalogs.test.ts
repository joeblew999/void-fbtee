// The shared catalog logic and the plugin's build check, on a tiny fixture app (test/unit/fixture):
// two strings, "Hello" translated into German, "Goodbye" not.
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vite-plus/test";
import { build } from "vite";
import { voidFbtee } from "../../src/plugin";
import { collect, missing, runtimeCatalog, runtimeTexts, type Project } from "../../src/catalogs";
import { resolveLocales } from "../../src/locales";

const fixture = join(import.meta.dirname, "fixture");
let root: string;
// The fixture is copied for every test, so tests can change catalogs. fbtee resolves from this
// package, so the copy lives next to it.
beforeEach(() => {
  root = mkdtempSync(join(import.meta.dirname, ".tmp-"));
  cpSync(fixture, root, { recursive: true });
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
