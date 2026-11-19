// The dev server's translation task list, `markedDone` and `stamp`, on copies of
// test/unit/fixture ("Hello" translated into German, "Goodbye" not; no Thai catalog). Running claude itself is checked on the example
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
import { copyFixture } from "./copy-fixture";
import type { Project } from "../../src/dev/catalogs";
import { check, markdownPages, missingHead } from "../../src/dev/check";
import { loadProject, prepare } from "../../src/dev/commands";
import { init } from "../../src/dev/init";
import {
  agentProvenance,
  awaitsReview,
  markedDone,
  pageAwaitsReview,
  reviewTask,
  stamp,
  translateTask,
  waitingReview,
} from "../../src/dev/translate";
import { readCatalog } from "../../src/dev/catalog-file";
import { got } from "./got";

let root: string;
let p: Project;
beforeEach(async () => {
  root = copyFixture();
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
  const task = got(translateTask(p));
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

test("a page the agent marks done is unrecorded until the dev server stamps it", () => {
  write("pages/en-US/blog/hello.md", POST);
  write("pages/de-DE/blog/hello.md", POST.replace("date:", "translatedFrom: done\ndate:"));
  const text = readFileSync(join(root, "pages/de-DE/blog/hello.md"), "utf8");
  expect(markedDone(text)).toBe(true);
  expect(stateOf("de-DE")).toBe("unrecorded");
  stamp(p, join(root, "pages/de-DE/blog/hello.md"));
  const after = readFileSync(join(root, "pages/de-DE/blog/hello.md"), "utf8");
  expect(markedDone(after)).toBe(false);
  expect(after.match(/translatedFrom/g)).toHaveLength(1);
  expect(stateOf("de-DE")).toBe("ok");
  // The prompt tells the agent to mark pages done.
  write("pages/en-US/blog/other.md", POST);
  expect(got(translateTask(p)).prompt).toContain('set "translatedFrom: done"');
});

test("check reports a copy whose components or their values differ from the original's", () => {
  const original = POST.replace("<Meta />", '<Fmt money="1299" currency="THB" />');
  write("pages/en-US/blog/hello.md", original);
  write("pages/de-DE/blog/hello.md", original.replace('money="1299"', 'money="1300"'));
  stamp(p, join(root, "pages/de-DE/blog/hello.md"));
  expect(check(p).filter((l) => l.includes("must match"))).toEqual([
    'pages: de-DE: pages/de-DE/blog/hello.md: differs from the original where it must match: lacks <Fmt money="1299" currency="THB" />; has <Fmt money="1300" currency="THB" /> that the original doesn\'t',
  ]);
});

// What a copy must keep from the original besides its components: @void/md's markers, ids,
// footnote labels, code and link targets (relative, so the same in every copy).
const RICH = [
  "# Hello {#hello}",
  "",
  "[[toc]]",
  "",
  "::: tip A tip",
  "Text.[^n]",
  ":::",
  "",
  "> [!NOTE] A note",
  "> Text.",
  "",
  "```ts {1}",
  "const a = 1; // [!code ++]",
  "```",
  "",
  "[Events](../events)",
  "",
  "[^n]: A footnote.",
  "",
].join("\n");

test("check reports a copy that loses or changes what it must keep", () => {
  write("pages/en-US/blog/rich.md", RICH);
  const cases: Array<[string, string, string]> = [
    ["a box's marker", "::: tip A tip", "::: info Ein Tipp"],
    ["an alert's marker", "> [!NOTE] A note", "> [!TIP] Ein Hinweis"],
    ["a heading id", "{#hello}", "{#hallo}"],
    ["[[toc]]", "[[toc]]", ""],
    ["a footnote label", "[^n]:", "[^m]:"],
    ["the code", "const a = 1;", "const a = 2;"],
    ["a link's target", "(../events)", "(/de-DE/events)"],
  ];
  for (const [what, from, to] of cases) {
    write("pages/de-DE/blog/rich.md", RICH.replace(from, to));
    stamp(p, join(root, "pages/de-DE/blog/rich.md"));
    expect(
      check(p).filter((l) => l.includes("rich.md") && l.includes("must match")),
      what,
    ).toHaveLength(1);
  }
  // Translated text alone is fine.
  write(
    "pages/de-DE/blog/rich.md",
    RICH.replace("A tip", "Ein Tipp").replace("Text.", "Text auf Deutsch."),
  );
  stamp(p, join(root, "pages/de-DE/blog/rich.md"), { by: "claude" });
  expect(check(p).filter((l) => l.includes("de-DE/blog/rich.md"))).toEqual([]);
});

test("check reports a box or alert without a title, in the original and in a copy", () => {
  const bare = RICH.replace("::: tip A tip", "::: tip").replace("> [!NOTE] A note", "> [!NOTE]");
  write("pages/en-US/blog/rich.md", bare);
  write("pages/de-DE/blog/rich.md", bare);
  stamp(p, join(root, "pages/de-DE/blog/rich.md"));
  expect(check(p).filter((l) => l.includes("has no title"))).toEqual([
    "pages: en-US: pages/en-US/blog/rich.md: ::: tip has no title, so it shows @void/md's English one: give it a title",
    "pages: en-US: pages/en-US/blog/rich.md: > [!NOTE] has no title, so it shows @void/md's English one: give it a title",
    "pages: de-DE: pages/de-DE/blog/rich.md: ::: tip has no title, so it shows @void/md's English one: give it a title",
    "pages: de-DE: pages/de-DE/blog/rich.md: > [!NOTE] has no title, so it shows @void/md's English one: give it a title",
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
    const catalog = readCatalog(readFileSync(file, "utf8"), file);
    for (const e of Object.values(catalog.translations)) {
      e.status = "translated";
    }
    writeFileSync(file, JSON.stringify(catalog));
  }
  expect(translateTask(p)).toBeUndefined();
});

test("init links the skill for Claude Code like void init, once", async () => {
  // A void init app (test/unit/void-init.ts) that has a .claude folder.
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

test("check: a translated markdown copy keeps the original's title and description", () => {
  const original =
    "---\ntitle: Tour\ndescription: Post an event.\nupdated: 2026-11-12\n---\n\n# Tour\n";
  expect(missingHead(original, "---\ntitle: ทัวร์\ndescription: โพสต์กิจกรรม\n---\n")).toEqual([]);
  expect(missingHead(original, "---\ntitle: ทัวร์\n---\n")).toEqual(["description"]);
  expect(missingHead(original, "---\ntitle:\n---\n# ทัวร์\n")).toEqual(["title", "description"]);
  // The original without them asks nothing of its copies.
  expect(missingHead("# Tour\n", "# ทัวร์\n")).toEqual([]);
});

// A page with islands starts with its <script> block, then the frontmatter (@void/md's order, and
// every page in the example): check reads the frontmatter there too. Before frontmatter() it
// didn't, and a copy missing its title passed.
test("check: the title and description after a page's <script> block", () => {
  const script = '<script>\nimport Fmt from "./Fmt.tsx" with { island: "load" }\n</script>\n\n';
  const original = `${script}---\n\ntitle: Tour\ndescription: Post an event.\n---\n\n# Tour\n`;
  expect(missingHead(original, `${script}---\ntitle: ทัวร์\n---\n\n# ทัวร์\n`)).toEqual([
    "description",
  ]);
  expect(
    missingHead(original, `${script}---\r\ntitle: ทัวร์\r\ndescription: โพสต์\r\n---\r\n`),
  ).toEqual([]);
});

test("a translation waits for review when an AI wrote it and no one has reviewed it", () => {
  const ai = { status: "translated", translatedBy: "google/gemini-3.5-flash" };
  expect(awaitsReview(ai)).toBe(true);
  expect(
    awaitsReview({ ...ai, review: { by: "claude", at: "2026-11-17", verdict: "ok" as const } }),
  ).toBe(false);
  expect(awaitsReview({ status: "translated", translatedBy: "claude" })).toBe(false);
  // Nobody can say who: reviewed, as a machine's would be. A person's: not.
  expect(awaitsReview({ status: "translated", translatedBy: "unknown" })).toBe(true);
  expect(awaitsReview({ status: "translated", translatedBy: "Somchai" })).toBe(false);
  expect(awaitsReview({ status: "translated" })).toBe(false);
  expect(awaitsReview({ ...ai, status: "new" })).toBe(false);
});

test("a finished translation that would break the app fails the build, and is never set back to new", () => {
  prepare(p);
  const file = join(root, "i18n/translations/de-DE.json");
  const hello = "SSJ6IVWoQjvWr8iQwHsMTA==";
  const catalog = readCatalog(readFileSync(file, "utf8"), file);
  got(got(catalog.translations[hello]).translations?.[0]).translation = "Hallo {name}";
  writeFileSync(file, JSON.stringify(catalog, null, 2));
  const before = readFileSync(file, "utf8");
  expect(check(p).join("\n")).toMatch(
    /de-DE: "Hello": Line 1 has \{name\}, which the source hasn't/,
  );
  expect(readFileSync(file, "utf8")).toBe(before);
});

test("stamp records who translated a page, when, the request's gateway log and what it cost", () => {
  write("pages/en-US/blog/hello.md", POST);
  write("pages/de-DE/blog/hello.md", POST.replace("Hello", "Hallo"));
  const file = join(root, "pages/de-DE/blog/hello.md");
  const usage = { in: 2143, out: 2283, thinking: 0, usd: 0.020337 };
  stamp(p, file, {
    by: "google/gemini-4-hydrogen",
    at: "2026-11-18",
    gatewayLogId: "01abc",
    usage,
  });
  const text = readFileSync(file, "utf8");
  expect(text).toMatch(/^translatedBy: "google\/gemini-4-hydrogen"$/m);
  expect(text).toMatch(/^translatedAt: "2026-11-18"$/m);
  expect(text).toMatch(/^gatewayLogId: "01abc"$/m);
  expect(text).toMatch(/^usage: \{"in":2143,"out":2283,"thinking":0,"usd":0.020337\}$/m);
  // Stamped again by someone else: replaced, not added twice.
  stamp(p, file, { by: "claude", at: "2026-11-18" });
  const again = readFileSync(file, "utf8");
  expect(again.match(/^translatedBy:/gm)).toHaveLength(1);
  expect(again).toMatch(/^translatedBy: "claude"$/m);
  // Without a gateway log or cost now: the old ones aren't left saying a request made it.
  expect(again).not.toMatch(/^gatewayLogId:/m);
  expect(again).not.toMatch(/^usage:/m);
});

test("a finished entry that doesn't say who translated it fails the check", () => {
  prepare(p);
  const file = join(root, "i18n/translations/de-DE.json");
  const catalog = readCatalog(readFileSync(file, "utf8"), file);
  delete got(catalog.translations["SSJ6IVWoQjvWr8iQwHsMTA=="]).translatedBy;
  writeFileSync(file, JSON.stringify(catalog, null, 2));
  expect(check(p)).toContain(
    'strings: de-DE: "Hello": doesn\'t say who translated it (translatedBy)',
  );
});

test("a page an agent marked done says who it is, or unknown if it still names a model", () => {
  const page = (by: string) => `---\ntitle: Hallo\n${by}translatedFrom: done\n---\n\nText.\n`;
  expect(agentProvenance(page('translatedBy: "claude"\n'))).toEqual({ by: "claude" });
  expect(agentProvenance(page('translatedBy: "google/gemini-3.5-flash"\n'))).toEqual({
    by: "unknown",
  });
  expect(agentProvenance(page(""))).toEqual({ by: "unknown" });
});

test("a translated page an AI or no one known wrote waits for review, until it says who reviewed it", () => {
  prepare(p);
  write("pages/en-US/blog/hello.md", POST);
  write("pages/de-DE/blog/hello.md", POST.replace("Hello", "Hallo"));
  const file = join(root, "pages/de-DE/blog/hello.md");
  stamp(p, file, { by: "unknown", at: "2026-11-17" });
  expect(pageAwaitsReview(readFileSync(file, "utf8"))).toBe(true);
  expect(waitingReview(p)).toBe("1 page");
  expect(reviewTask(p)).toContain(
    "Pages:\n- pages/de-DE/blog/hello.md (de-DE), translated from pages/en-US/blog/hello.md",
  );
  // Reviewed: nothing left.
  writeFileSync(
    file,
    readFileSync(file, "utf8").replace(/^translatedAt:.*$/m, '$&\nreviewedBy: "claude"'),
  );
  expect(pageAwaitsReview(readFileSync(file, "utf8"))).toBe(false);
  expect(reviewTask(p)).toBeUndefined();
  // Translated again by a model: the review was of the old one, so it's gone.
  stamp(p, file, { by: "google/gemini-3.5-flash", at: "2026-11-18" });
  expect(readFileSync(file, "utf8")).not.toMatch(/^reviewedBy:/m);
  expect(waitingReview(p)).toBe("1 page");
  // Claude's own page isn't reviewed.
  stamp(p, file, { by: "claude", at: "2026-11-18" });
  expect(reviewTask(p)).toBeUndefined();
});
