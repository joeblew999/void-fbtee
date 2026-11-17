// A fresh copy of the fixture app (test/unit/fixture) for a test to change: inside this folder, so
// fbtee and the rest resolve from the package's own node_modules. The caller removes it.
import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { check, markdownPages } from "../../src/check";
import { prepare } from "../../src/commands";
import { voidFbtee, type VoidFbteeApi, type VoidFbteeOptions } from "../../src/plugin";
import { stamp } from "../../src/translate";

export const FIXTURE = join(import.meta.dirname, "fixture");

export function copyFixture(): string {
  const root = mkdtempSync(join(import.meta.dirname, ".tmp-"));
  cpSync(FIXTURE, root, { recursive: true });
  return root;
}

/**
 * A made-up translation the build accepts: the source with a word in the catalog's language, and in
 * a language with its own script, no English words left in (only the placeholders).
 */
function madeUp(file: string, text: string): string {
  const word = ({ ar: "(مترجم)", th: "(แปลแล้ว)" } as Record<string, string>)[file.slice(0, 2)];
  if (!word) return `${text} (übersetzt)`;
  const kept = text
    .split(/(\{[^{}]+\})/)
    .map((part, i) => (i % 2 ? part : part.replace(/[A-Za-z']+/g, "")));
  return `${kept.join("").trim()} ${word}`;
}

/**
 * Make a copy pass check(), so `vite build` runs (void-fbtee fails a build on anything check
 * finds): the setup init writes, every catalog entry marked translated (with a made-up translation:
 * these tests are about the build, not the words), and every markdown page copied and recorded. For
 * the app the test's own voidFbtee(options) builds.
 */
export function makeBuildable(root: string, options: VoidFbteeOptions): void {
  mkdirSync(join(root, "middleware"), { recursive: true });
  writeFileSync(
    join(root, "middleware/99.i18n.ts"),
    `export { default } from "void-fbtee/middleware";\n`,
  );
  mkdirSync(join(root, "pages"), { recursive: true });
  writeFileSync(join(root, "pages/layout.tsx"), `// <I18nProvider> wraps every page.\n`);
  writeFileSync(
    join(root, "void.config.ts"),
    `export default { worker: { compatibility_flags: ["temporal"] } };\n`,
  );
  const api = (voidFbtee(options)[0] as { api: VoidFbteeApi }).api;
  const p = { ...api.project(), root };
  prepare(p);
  for (const file of readdirSync(join(root, p.translations))) {
    const path = join(root, p.translations, file);
    const catalog = JSON.parse(readFileSync(path, "utf8"));
    // Each line made a translation the build accepts (madeUp): not the source text left as it is (vp build
    // checks every entry as vp dev checks an answer, plans/translation-rework.md step 5).
    for (const entry of Object.values(catalog.translations) as {
      status: string;
      translations: { translation: string }[];
      translatedBy?: string;
    }[]) {
      // Who translated it, as the build asks (check.ts): a translation the test wrote itself
      // stays as it is, and says who only if it didn't.
      if (entry.status === "translated") {
        entry.translatedBy ??= "claude";
        continue;
      }
      entry.status = "translated";
      entry.translatedBy = "claude";
      for (const l of entry.translations) l.translation = madeUp(file, l.translation);
    }
    writeFileSync(path, JSON.stringify(catalog, null, 2));
  }
  for (const page of markdownPages(p)) {
    mkdirSync(dirname(page.file), { recursive: true });
    writeFileSync(page.file, readFileSync(page.original, "utf8"));
    stamp(p, page.file, { by: "claude" });
  }
  const left = check(p);
  if (left.length) throw new Error(`fixture still has problems:\n${left.join("\n")}`);
}
