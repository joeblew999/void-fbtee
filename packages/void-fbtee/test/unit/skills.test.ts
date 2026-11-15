// The skills and the code in harmony: what the dev server writes into a catalog (plurals.ts
// withVariants), the words Void's AI is told each line is for (plurals.ts MARKS, sent by ai.ts),
// and what the two skills say about them. A change to one that the others don't follow fails here.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import { CATEGORY_CODE, GENDER_CODE, MARKS } from "../../src/plurals";

const SKILLS = join(import.meta.dirname, "../../skills");
const translating = readFileSync(join(SKILLS, "void-fbtee-translate/SKILL.md"), "utf8");
const main = readFileSync(join(SKILLS, "void-fbtee/SKILL.md"), "utf8");
const section = (text: string, heading: string) => {
  const start = text.indexOf(`## ${heading}`);
  expect(start, `the skill has "## ${heading}"`).toBeGreaterThanOrEqual(0);
  const end = text.indexOf("\n## ", start + 3);
  return text.slice(start, end < 0 ? undefined : end);
};

test("every code a catalog line can be marked with has its word", () => {
  for (const code of [...Object.values(CATEGORY_CODE), ...Object.values(GENDER_CODE)])
    expect(MARKS[code], `code ${code}`).toBeTruthy();
});

test("the translating skill explains every word a line can be marked with", () => {
  const counts = section(translating, "Counts: one line per plural form");
  const people = section(translating, "People: one line per gender");
  // The skill's own list of marks, exactly the code's ("(zero, one, two, few, many, other)"): a
  // word that only shows up elsewhere in the section doesn't count.
  expect(counts).toContain(`(${Object.keys(CATEGORY_CODE).join(", ")})`);
  expect(people).toContain(`(${Object.keys(GENDER_CODE).join(", ")})`);
});

test("the void-fbtee skill gives the catalog's codes as the code writes them", () => {
  for (const [word, code] of Object.entries(CATEGORY_CODE))
    expect(main).toContain(`${code} ${word}`);
  for (const [word, code] of Object.entries(GENDER_CODE))
    expect(main).toContain(`\`{"0": ${code}}\` ${word}`);
});
