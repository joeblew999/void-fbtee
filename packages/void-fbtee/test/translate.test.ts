// `void-fbtee translate`'s task list and `stamp`, on copies of test/fixture ("Hello" translated
// into German, "Goodbye" not; no Thai catalog). Running claude itself is checked on the example
// app, by hand, as the plan's step 6; these tests don't call it.
import {
  cpSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { VOID_INIT_DIR } from "./void-init";
import { join } from "node:path";
import { afterEach, beforeEach, expect, test } from "vite-plus/test";
import type { Project } from "../src/catalogs";
import { check, markdownPages } from "../src/check";
import { loadProject, prepare } from "../src/commands";
import { init } from "../src/init";
import { stamp, translateTask } from "../src/translate";

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
const POST = `<script>\nimport Meta from "../../../components/Meta.tsx"\n</script>\n\n---\ntitle: Hello\ndate: "2026-11-01"\n---\n\n# Hello\n\n<Meta />\n\nA post.\n`;
const stateOf = (locale: string) => markdownPages(p).find((x) => x.locale === locale)?.state;

test("lists each catalog with new entries and each page to translate, with the skill to read", () => {
  prepare(p);
  write("pages/en-US/blog/hello.md", POST);
  const task = translateTask(p)!;
  // Not installed in the fixture, so the path is to the package itself.
  expect(task.prompt).toContain("/skills/void-fbtee/SKILL.md (the void-fbtee skill) and follow it");
  // German: "Goodbye" plus fbtee's 12 built-in strings; Thai: everything.
  expect(task.prompt).toContain(
    `- i18n/translations/de-DE.json (de-DE): 13 entries with "status": "new"`,
  );
  expect(task.prompt).toContain(
    `- i18n/translations/th-TH.json (th-TH): 14 entries with "status": "new"`,
  );
  expect(task.prompt).toContain(
    "- pages/de-DE/blog/hello.md (de-DE): new page: translate pages/en-US/blog/hello.md",
  );
  expect(task.pages.map((x) => x.locale)).toEqual(["de-DE", "th-TH"]);
});

test("stamp records the original's version, and check then sees the page as up to date", () => {
  write("pages/en-US/blog/hello.md", POST);
  write("pages/de-DE/blog/hello.md", POST.replace("A post.", "Ein Beitrag."));
  expect(stateOf("de-DE")).toBe("unrecorded");
  stamp(p, join(root, "pages/de-DE/blog/hello.md"));
  const text = readFileSync(join(root, "pages/de-DE/blog/hello.md"), "utf8");
  // In the frontmatter, after the leading <script> block, which stays first.
  expect(text.startsWith("<script>")).toBe(true);
  expect(text).toMatch(/date: "2026-11-01"\ntranslatedFrom: "[0-9a-f]{12}"\n---/);
  expect(stateOf("de-DE")).toBe("ok");

  // The original changes: the page is out of date until it's stamped again.
  write("pages/en-US/blog/hello.md", POST.replace("A post.", "A longer post."));
  expect(stateOf("de-DE")).toBe("stale");
  stamp(p, join(root, "pages/de-DE/blog/hello.md"));
  expect(
    readFileSync(join(root, "pages/de-DE/blog/hello.md"), "utf8").match(/translatedFrom/g),
  ).toHaveLength(1);
  expect(stateOf("de-DE")).toBe("ok");
});

test("check reports a copy whose components or their values differ from the original's", () => {
  const original = POST.replace("<Meta />", '<Fmt money="1299" currency="THB" />');
  write("pages/en-US/blog/hello.md", original);
  write("pages/de-DE/blog/hello.md", original.replace('money="1299"', 'money="1300"'));
  stamp(p, join(root, "pages/de-DE/blog/hello.md"));
  expect(check(p).filter((l) => l.includes("components differ"))).toEqual([
    'pages: de-DE: pages/de-DE/blog/hello.md: components differ: lacks <Fmt money="1299" currency="THB" />; has <Fmt money="1300" currency="THB" /> that the original doesn\'t',
  ]);
});

test("stamp adds frontmatter to a page without any", () => {
  write("pages/en-US/about.md", "# About\n");
  write("pages/de-DE/about.md", "# Über uns\n");
  stamp(p, join(root, "pages/de-DE/about.md"));
  expect(readFileSync(join(root, "pages/de-DE/about.md"), "utf8")).toMatch(
    /^---\ntranslatedFrom: "[0-9a-f]{12}"\n---\n\n# Über uns\n$/,
  );
});

test("nothing to do once everything is translated", () => {
  prepare(p);
  for (const locale of ["de-DE", "th-TH"]) {
    const file = join(root, `i18n/translations/${locale}.json`);
    const catalog = JSON.parse(readFileSync(file, "utf8"));
    for (const e of Object.values(catalog.translations) as { status: string }[])
      e.status = "translated";
    writeFileSync(file, JSON.stringify(catalog));
  }
  expect(translateTask(p)).toBeUndefined();
});

test("init links the skill for Claude Code like void init, once", async () => {
  // A void init app (test/void-init.ts) that has a .claude folder.
  const app = mkdtempSync(join(import.meta.dirname, ".tmp-"));
  try {
    cpSync(join(VOID_INIT_DIR, "vite-plus"), app, {
      recursive: true,
      filter: (src) =>
        !["node_modules", ".void", "pnpm-lock.yaml", ".git"].includes(src.split("/").pop() ?? ""),
    });
    mkdirSync(join(app, ".claude"));
    const o = { root: app, sourceLocale: "en-US", locales: ["en-US", "de-DE"] };
    expect((await init(o)).done).toContain(
      ".claude/skills/void-fbtee: linked void-fbtee's skill for Claude Code",
    );
    const link = join(app, ".claude/skills/void-fbtee");
    expect(lstatSync(link).isSymbolicLink()).toBe(true);
    expect(readlinkSync(link)).toBe("../../node_modules/void-fbtee/skills/void-fbtee");
    expect((await init(o)).done).toEqual([]);
  } finally {
    rmSync(app, { recursive: true, force: true });
  }
});
