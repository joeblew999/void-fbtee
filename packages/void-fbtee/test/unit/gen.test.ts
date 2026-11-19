// The translations table void-fbtee keeps in an app (plans/like-better-auth.md): written by
// `gen translations`, made the package's current one by `vp dev` (keepTranslations with write),
// refused by `vp build` while it isn't (without), the app's list of fields kept, and the app's own
// files checked for their wiring.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import {
  genTranslations,
  keepTranslations,
  KEPT,
  sameCode,
  wiringProblems,
} from "../../src/dev/gen";

let root: string;
const at = (rel: string) => join(root, rel);
const TABLE = "db/schema/events_translations.ts";

beforeEach(() => {
  root = mkdtempSync(join(import.meta.dirname, ".tmp-"));
  mkdirSync(at("db/schema"), { recursive: true });
  writeFileSync(
    at("db/schema/events.ts"),
    [
      'import { integer, sqliteTable, text } from "void/schema-d1";',
      'export const events = sqliteTable("events", {',
      '  id: text("id").primaryKey(),',
      '  locale: text("locale").notNull(),',
      '  title: text("title").notNull(),',
      '  description: text("description").notNull(),',
      '  venue: text("venue"),',
      '  seats: integer("seats").notNull(),',
      "});",
      "",
    ].join("\n"),
  );
  writeFileSync(at("db/schema.ts"), 'export * from "./schema/events";\n');
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe("gen translations", () => {
  it("writes the kept table, re-exported, and the app's files, wired", () => {
    genTranslations(root, "events", ["title", "description"]);
    const text = readFileSync(at(TABLE), "utf8");
    expect(text.startsWith(KEPT)).toBe(true);
    expect(text).toContain(
      'export const events_translations_fields = ["title", "description"] as const;',
    );
    expect(readFileSync(at("db/schema.ts"), "utf8")).toContain(
      'export * from "./schema/events_translations";',
    );
    expect(keepTranslations(root, false)).toEqual({ rewritten: [], problems: [] });
    expect(wiringProblems(root)).toEqual([]);
  });

  it("refuses a column the table hasn't, or one that isn't text", () => {
    expect(() => genTranslations(root, "events", ["nope"])).toThrow('no "nope" column');
    expect(() => genTranslations(root, "events", ["seats"])).toThrow("not text");
  });

  it("leaves a translations file of the app's own alone", () => {
    writeFileSync(at(TABLE), "// the app's own\n");
    const { todo } = genTranslations(root, "events", ["title"]);
    expect(readFileSync(at(TABLE), "utf8")).toBe("// the app's own\n");
    expect(todo.join("\n")).toContain("not kept by void-fbtee");
    expect(keepTranslations(root, false).problems).toEqual([]);
  });
});

describe("keeping the table", () => {
  beforeEach(() => void genTranslations(root, "events", ["title", "description"]));

  it("takes the app's list as it is: nothing else in the file names the fields", () => {
    const text = readFileSync(at(TABLE), "utf8");
    const changed = text.replace('["title", "description"]', '["title", "venue"]');
    writeFileSync(at(TABLE), changed);
    expect(keepTranslations(root, true)).toEqual({ rewritten: [], problems: [] });
    expect(readFileSync(at(TABLE), "utf8")).toBe(changed);
  });

  it("undoes a change to the package's part, as an older table is brought up to date", () => {
    const text = readFileSync(at(TABLE), "utf8");
    const older = text.replace(/\n\s*gatewayLogId: text\("gateway_log_id"\),/, "");
    expect(older).not.toBe(text);
    writeFileSync(at(TABLE), older);
    expect(keepTranslations(root, false).problems).toHaveLength(1);
    keepTranslations(root, true);
    expect(readFileSync(at(TABLE), "utf8")).toBe(text);
  });

  it("isn't fooled by the app's formatter: quotes, semicolons, commas, arrows", () => {
    const text = readFileSync(at(TABLE), "utf8");
    const prettier = text
      .replace(/"/g, "'")
      .replace(/;$/gm, "")
      .replace(/\(t\) =>/g, "t =>")
      .replace(/,\n(\s*)\)/g, "\n$1)");
    expect(prettier).not.toBe(text);
    expect(sameCode(prettier, text)).toBe(true);
    writeFileSync(at(TABLE), prettier);
    expect(keepTranslations(root, true)).toEqual({ rewritten: [], problems: [] });
    expect(readFileSync(at(TABLE), "utf8")).toBe(prettier);
  });

  it("names a list it can't keep: a column that isn't there", () => {
    const text = readFileSync(at(TABLE), "utf8");
    writeFileSync(at(TABLE), text.replace('["title", "description"]', '["title", "nope"]'));
    expect(keepTranslations(root, true)).toEqual({
      rewritten: [],
      problems: [`content: ${TABLE}: events has no "nope" column`],
    });
  });
});

describe("the app's own files", () => {
  beforeEach(() => void genTranslations(root, "events", ["title"]));

  it("names each one missing or not wired", () => {
    unlinkSync(at("queues/translate.ts"));
    writeFileSync(at("crons/translations.ts"), "export const cron = '17 4 * * *';\n");
    const problems = wiringProblems(root).join("\n");
    expect(problems).toContain("queues/translate.ts doesn't run void-fbtee's queue");
    expect(problems).toContain("no job in crons/ runs void-fbtee's");
  });

  it("wants Void's AI imported by the queue", () => {
    const queue = readFileSync(at("queues/translate.ts"), "utf8");
    writeFileSync(at("queues/translate.ts"), queue.replace('import "void/ai";\n', ""));
    expect(wiringProblems(root)).toEqual([
      `content: queues/translate.ts doesn't import "void/ai", so Void doesn't connect its AI: add import "void/ai";`,
    ]);
  });

  it("asks for nothing when the app translates no table", () => {
    unlinkSync(at(TABLE));
    unlinkSync(at("queues/translate.ts"));
    expect(wiringProblems(root)).toEqual([]);
  });
});
