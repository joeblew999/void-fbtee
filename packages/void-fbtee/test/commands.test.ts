// `void-fbtee prepare` and `check`, on copies of test/fixture (two strings: "Hello" translated
// into German, "Goodbye" not; no Thai catalog; none of void-fbtee's setup files).
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vite-plus/test";
import { check, markdownHash, TRANSLATED_FROM } from "../src/check";
import { loadProject, prepare } from "../src/commands";
import type { Project } from "../src/catalogs";

const fixture = join(import.meta.dirname, "fixture");
let root: string;
let p: Project;
beforeEach(async () => {
  root = mkdtempSync(join(import.meta.dirname, ".tmp-"));
  cpSync(fixture, root, { recursive: true });
  p = await loadProject(root);
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

const write = (path: string, text: string) => {
  mkdirSync(join(root, path, ".."), { recursive: true });
  writeFileSync(join(root, path), text);
};
const setUp = () => {
  write("middleware/i18n.ts", `export { default } from "void-fbtee/middleware";\n`);
  write(
    "pages/layout.tsx",
    `export default ({ children }) => <I18nProvider>{children}</I18nProvider>;\n`,
  );
  write("void.config.ts", `export default { worker: { compatibility_flags: ["temporal"] } };\n`);
};

test("loadProject reads the locales from vite.config.ts", () => {
  expect(p.config.sourceLocale).toBe("en-US");
  expect(p.config.locales.map((l) => l.locale)).toEqual(["en-US", "de-DE", "th-TH"]);
});

describe("check", () => {
  test("lists missing setup, untranslated strings and missing catalogs", () => {
    const problems = check(p);
    expect(problems.filter((l) => l.startsWith("setup:"))).toHaveLength(3);
    expect(problems).toContain('strings: de-DE: untranslated "Goodbye"');
    expect(problems).toContain("strings: th-TH: no catalog yet");
    expect(problems).not.toContain('strings: de-DE: untranslated "Hello"');
  });

  test("setup problems go once the app is set up", () => {
    setUp();
    expect(check(p).filter((l) => l.startsWith("setup:"))).toEqual([]);
  });

  test('reports showCount="no" with its file and line', () => {
    write(
      "src/plural.tsx",
      `\nexport const n = (c) => <fbt desc="d"><fbt:plural count={c} showCount="no">x</fbt:plural></fbt>;\n`,
    );
    expect(check(p)).toContain(
      'strings: src/plural.tsx:2: showCount="no" drops the count (fbtee#83)',
    );
  });

  test("markdown: missing, recorded, out of date, and unaffected by formatting", () => {
    const original = "---\ntitle: Hello\n---\n\n# Hello\n\nText.\n";
    write("pages/en-US/post.md", original);
    const pageProblems = () => check(p).filter((l) => l.includes("pages/de-DE/post.md"));
    expect(pageProblems()).toEqual(["pages: de-DE: pages/de-DE/post.md: not translated yet"]);

    write("pages/de-DE/post.md", "---\ntitle: Hallo\n---\n\n# Hallo\n");
    expect(pageProblems()[0]).toMatch(/doesn't record which original/);

    write(
      "pages/de-DE/post.md",
      `---\ntitle: Hallo\n${TRANSLATED_FROM}: ${markdownHash(original)}\n---\n\n# Hallo\n`,
    );
    expect(pageProblems()).toEqual([]);

    // The formatter adds a blank line after the frontmatter's opening `---`: not a change.
    write("pages/en-US/post.md", original.replace("---\n", "---\n\n"));
    expect(pageProblems()).toEqual([]);

    write("pages/en-US/post.md", original.replace("Text.", "New text."));
    expect(pageProblems()).toEqual([
      "pages: de-DE: pages/de-DE/post.md: out of date (the original changed)",
    ]);
  });
});

describe("prepare", () => {
  test("writes every catalog: new strings marked, finished kept, missing ones created", () => {
    expect(prepare(p).sort()).toEqual([
      "i18n/translations/de-DE.json",
      "i18n/translations/th-TH.json",
    ]);
    const read = (l: string) => readFileSync(join(root, `i18n/translations/${l}.json`), "utf8");
    const de = JSON.parse(read("de-DE"));
    const entries = Object.values(de.translations) as {
      status?: string;
      translations: { translation: string }[];
    }[];
    expect(entries.find((e) => e.translations[0]!.translation === "Hallo")!.status).not.toBe("new");
    expect(entries.filter((e) => e.status === "new")).toHaveLength(1 + 12);
    expect(read("de-DE")).toMatch(/^\{\n  "fb-locale": "de-DE",\n/);
    expect(read("de-DE").endsWith("}\n")).toBe(true);
    expect(Object.keys(JSON.parse(read("th-TH")).translations)).toHaveLength(2 + 12);
  });
});
