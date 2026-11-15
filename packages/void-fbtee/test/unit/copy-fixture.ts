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
 * Make a copy pass check(), so `vite build` runs (void-fbtee fails a build on anything check
 * finds): the setup init writes, every catalog entry marked translated (its text left as is: these
 * tests are about the build, not the words), and every markdown page copied and recorded. For
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
    for (const entry of Object.values(catalog.translations) as { status: string }[])
      entry.status = "translated";
    writeFileSync(path, JSON.stringify(catalog, null, 2));
  }
  for (const page of markdownPages(p)) {
    mkdirSync(dirname(page.file), { recursive: true });
    writeFileSync(page.file, readFileSync(page.original, "utf8"));
    stamp(p, page.file);
  }
  const left = check(p);
  if (left.length) throw new Error(`fixture still has problems:\n${left.join("\n")}`);
}
