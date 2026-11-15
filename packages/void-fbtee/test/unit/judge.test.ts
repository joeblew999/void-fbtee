// The judge's checks (judge.ts), without Void's AI.
import { expect, test } from "vite-plus/test";
import { inScript, keptTerms, problemsWith } from "../../src/judge";

const line = (translation: string) => [{ translation, variations: {} }];

test("a line is in its language's script, and has no English sentence left in it", () => {
  expect(inScript("vp dev แปลด้วย Void's AI หรือ Claude Code", "th-TH")).toBe(true);
  expect(inScript("The app's AGENTS.md tells your coding agent what to do.", "ar-EG")).toBe(false);
  expect(inScript("يترجم vp dev ما هو جديد", "ar-EG")).toBe(true);
  expect(inScript("保存", "ja-JP")).toBe(true);
  expect(inScript("저장 tells your coding agent what", "ko-KR")).toBe(false);
  // Latin-script languages: nothing to tell apart here (the unchanged-text check covers English).
  expect(inScript("Speichern", "de-DE")).toBe(true);
});

test("the wrong script is a problem", () => {
  const src = "The app's AGENTS.md tells your coding agent what to do.";
  expect(problemsWith(line(src), ["AGENTS.md is the agent's file."], "ar-EG")[0]).toMatch(
    /isn't written in Arabic/,
  );
  expect(problemsWith(line(src), ["يخبر ملف AGENTS.md وكيل البرمجة بما يفعله."], "ar-EG")).toEqual(
    [],
  );
});

test("kept terms: commands, file names and paths, without a sentence's full stop", () => {
  expect(keptTerms("Run vp dev, then read AGENTS.md in i18n/translations.")).toEqual([
    "vp dev",
    "AGENTS.md",
    "i18n/translations",
  ]);
});
