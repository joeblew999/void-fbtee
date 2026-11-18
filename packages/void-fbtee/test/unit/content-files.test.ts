// What vp dev writes and vp build checks for voidFbtee({ content }) (content-files.ts), on copies of
// test/unit/fixture with a table of the app's own: never over the app's files, and every gap said.
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, expect, test } from "vite-plus/test";
import { copyFixture } from "./copy-fixture";
import type { Project } from "../../src/catalogs";
import { loadProject } from "../../src/commands";
import { contentProblems, writeContentFiles } from "../../src/content-files";

let root: string;
let p: Project;
beforeEach(async () => {
  root = copyFixture();
  p = {
    ...(await loadProject(root)),
    content: { posts: { fields: ["body"] } },
  };
  mkdirSync(join(root, "db/schema"), { recursive: true });
  writeFileSync(
    join(root, "db/schema/posts.ts"),
    'import { sqliteTable, text } from "void/schema-d1";\nexport const postsTable = sqliteTable("posts", { id: text("id").primaryKey(), locale: text("locale").notNull(), body: text("body").notNull() });\n',
  );
  writeFileSync(join(root, "db/schema.ts"), 'export * from "./schema/posts";\n');
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

const snapshot = (tables: Record<string, Record<string, string>>) => {
  mkdirSync(join(root, "db/migrations/meta"), { recursive: true });
  writeFileSync(
    join(root, "db/migrations/meta/_journal.json"),
    JSON.stringify({ entries: [{ tag: "20261117000000_first" }] }),
  );
  writeFileSync(
    join(root, "db/migrations/meta/20261117000000_snapshot.json"),
    JSON.stringify({
      tables: Object.fromEntries(
        Object.entries(tables).map(([name, cols]) => [
          name,
          {
            name,
            columns: Object.fromEntries(Object.entries(cols).map(([c, type]) => [c, { type }])),
          },
        ]),
      ),
    }),
  );
};

test("writes the queue, the job and the translations table, with the table's own export name", () => {
  expect(writeContentFiles(p).sort()).toEqual([
    "crons/translations.ts",
    "db/schema.ts",
    "db/schema/posts_translations.ts",
    "queues/translate.ts",
  ]);
  const schema = readFileSync(join(root, "db/schema/posts_translations.ts"), "utf8");
  expect(schema).toContain('import { postsTable } from "./posts";');
  expect(schema).toContain("export const posts_translations = translationsOf(postsTable);");
  expect(readFileSync(join(root, "queues/translate.ts"), "utf8")).toMatch(/import "void\/ai";/);
  expect(readFileSync(join(root, "db/schema.ts"), "utf8")).toContain(
    'export * from "./schema/posts_translations";',
  );
  // Again: nothing more.
  expect(writeContentFiles(p)).toEqual([]);
});

test("never writes over the app's own files", () => {
  mkdirSync(join(root, "queues"), { recursive: true });
  const mine =
    'import "void/ai";\nexport { default } from "void-fbtee/queues/translate"; // mine\n';
  writeFileSync(join(root, "queues/translate.ts"), mine);
  writeContentFiles(p);
  expect(readFileSync(join(root, "queues/translate.ts"), "utf8")).toBe(mine);
});

test("vp build says what's missing, then nothing once it's all there", () => {
  expect(contentProblems(p).join("\n")).toMatch(/no queues\/translate\.ts/);
  expect(contentProblems(p).join("\n")).toMatch(/no job in crons\//);
  expect(contentProblems(p).join("\n")).toMatch(/posts_translations has no migration/);
  writeContentFiles(p);
  snapshot({ posts: { id: "text", locale: "text", body: "integer" } });
  expect(contentProblems(p)).toEqual([
    "content: posts.body is integer, not text, which voidFbtee({ content }) needs",
    expect.stringMatching(/posts_translations has no migration/),
  ]);
  snapshot({
    posts: { id: "text", locale: "text", body: "text" },
    posts_translations: { id: "text" },
  });
  expect(contentProblems(p)).toEqual([]);
  // A job Void wouldn't run (a name starting with "_") isn't one.
  rmSync(join(root, "crons/translations.ts"));
  writeFileSync(
    join(root, "crons/_translations.ts"),
    'export const cron = "1 * * * *";\nexport { default } from "void-fbtee/crons/translations";\n',
  );
  expect(contentProblems(p).join("\n")).toMatch(/no job in crons\//);
});

test("an app with no content: nothing written, nothing to check", () => {
  const none = { ...p, content: {} };
  expect(writeContentFiles(none)).toEqual([]);
  expect(contentProblems(none)).toEqual([]);
  expect(existsSync(join(root, "queues"))).toBe(false);
});
