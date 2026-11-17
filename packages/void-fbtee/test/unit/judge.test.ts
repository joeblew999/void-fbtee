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

// The grammar checks (grammar.json), each on an answer Gemma 4 gave (2026-11-15), and on the
// right one.
const forms = (text: string, codes: number[][]) =>
  codes.map((c) => ({
    translation: text,
    variations: Object.fromEntries(c.map((v, i) => [i, v])),
  }));

test("a count's one and other lines differ where a noun is counted", () => {
  const src = forms("{who} booked {seats} seats.", [
    [1, 4],
    [1, 24],
  ]);
  const same = ["{who} hat {seats} Plätze gebucht.", "{who} hat {seats} Plätze gebucht."];
  expect(problemsWith(src, same, "de-DE", "en-US").join()).toMatch(
    /Lines 1 \(one\) and 2 \(other\)/,
  );
  expect(
    problemsWith(
      src,
      ["{who} hat {seats} Platz gebucht.", "{who} hat {seats} Plätze gebucht."],
      "de-DE",
      "en-US",
    ),
  ).toEqual([]);
  // No noun counted: "{number}+" is the same in every form.
  expect(
    problemsWith(forms("{number}+", [[4], [24]]), ["{number}+", "{number}+"], "de-DE", "en-US"),
  ).toEqual([]);
});

test("a male or female line has no word written for both", () => {
  const src = forms("{name} booked a seat.", [[1], [2], [3]]);
  const lines = [
    "{name} забронировал(а) место.",
    "{name} забронировала место.",
    "{name} забронировал(а) место.",
  ];
  expect(problemsWith(src, lines, "ru-RU", "en-US").join()).toMatch(/Line 1 is for a man/);
  lines[0] = "{name} забронировал место.";
  expect(problemsWith(src, lines, "ru-RU", "en-US")).toEqual([]);
});

test("no capital in the middle of a sentence, but Anda and names keep theirs", () => {
  const src = "Each language's catalog is in i18n/translations.";
  expect(
    problemsWith(
      line(src),
      ["El Catálogo de cada idioma está en i18n/translations."],
      "es-ES",
    ).join(),
  ).toMatch(/"Catálogo"/);
  expect(
    problemsWith(line(src), ["El catálogo de cada idioma está en i18n/translations."], "es-ES"),
  ).toEqual([]);
  expect(
    problemsWith(
      line("Ready to translate your app?"),
      ["Siap menerjemahkan aplikasi Anda?"],
      "id-ID",
    ),
  ).toEqual([]);
});

test("no English left in a language in another script, Korean particles both ways, Thai punctuation", () => {
  const agents = "The app's AGENTS.md tells your coding agent what to do.";
  expect(
    problemsWith(
      line(agents),
      ["应用的 AGENTS.md 会告知你的 coding agent 该做什么。"],
      "zh-CN",
    ).join(),
  ).toMatch(/"coding agent"/);
  expect(
    problemsWith(line(agents), ["应用的 AGENTS.md 会告诉你的编程助手该做什么。"], "zh-CN"),
  ).toEqual([]);
  expect(problemsWith(line("Open {pages}?"), ["{pages}를 여시겠습니까?"], "ko-KR").join()).toMatch(
    /을\(를\)/,
  );
  expect(problemsWith(line("Open {pages}?"), ["{pages}을(를) 열까요?"], "ko-KR")).toEqual([]);
  expect(problemsWith(line("Save"), ["บันทึก."], "th-TH").join()).toMatch(/full stop/);
});

test("Russian's one form is also 21, so its line keeps {number}", () => {
  const src = forms("{who} booked {seats} seats.", [[4], [20]]);
  expect(
    problemsWith(
      src,
      ["{who} забронировал одно место.", "{who} забронировал {seats} места."],
      "ru-RU",
      "en-US",
    ).join(),
  ).toMatch(/keep the placeholder \{seats\}/);
});

// Claude's review of Gemini's and Gemma's answers, and vp build checking every entry
// (plans/translation-rework.md, 2026-11-17).
test("kept terms: a dotted file name whole, a package name, not an English compound", () => {
  expect(keptTerms("Browser Run is a binding in void.config.ts.")).toEqual(["void.config.ts"]);
  expect(keptTerms("Add void-fbtee, then read it right-to-left.")).toEqual(["void-fbtee"]);
  expect(keptTerms("Each language has its copy under pages/ and the language.")).toEqual([
    "pages/",
  ]);
  const src = "Browser Run is a binding in void.config.ts.";
  expect(problemsWith(line(src), ["Browser Run ربط في config.ts."], "ar-EG").join(" ")).toMatch(
    /must keep "void.config.ts"/,
  );
});

test("a line needs no script of its own when it's only placeholders, marks or names", () => {
  expect(inScript("{number}+", "ar-EG")).toBe(true);
  expect(inScript("{previous items}; {following items}", "th-TH")).toBe(true);
  expect(inScript("Worker", "th-TH")).toBe(true);
  expect(inScript("PDFs", "th-TH")).toBe(true);
  expect(problemsWith(line("{number}+"), ["{number}+"], "ar-EG")).toEqual([]);
});

test("Arabic is Modern Standard Arabic: colloquial Egyptian is a problem", () => {
  const src = "vp build fails on any string still untranslated.";
  expect(
    problemsWith(line(src), ["بيفشل vp build مع أي نص لسه مش مترجم."], "ar-EG").join(" "),
  ).toMatch(/colloquial Arabic/);
  expect(problemsWith(line(src), ["يفشل vp build إذا بقي أي نص غير مترجم."], "ar-EG")).toEqual([]);
});

test("an English term in brackets after the word is a gloss, not text left in English", () => {
  const src = "Browser Run is a binding in void.config.ts.";
  expect(
    problemsWith(line(src), ["Browser Run ربط (binding) في void.config.ts."], "ar-EG"),
  ).toEqual([]);
});

test("product names are kept as written", () => {
  const src = "vp dev translates with Void's AI, then Claude Code.";
  expect(keptTerms(src)).toEqual(["vp dev", "Void's AI", "Claude Code"]);
  expect(
    problemsWith(
      line(src),
      ["يترجم vp dev باستخدام ذكاء Void الاصطناعي، ثم Claude Code."],
      "ar-EG",
    ).join(" "),
  ).toMatch(/must keep "Void's AI"/);
});
