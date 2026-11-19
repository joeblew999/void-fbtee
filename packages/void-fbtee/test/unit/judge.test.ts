// The one check left (judge.ts problemsWith): what would break the app, a line missing or a
// placeholder lost or made up. The rest is tested on Gemini's own answers in
// translate-entries.test.ts.
import { expect, test } from "vite-plus/test";
import { problemsWith } from "../../src/judge";

const forms = (text: string, codes: Array<Array<number>>) =>
  codes.map((c) => ({
    translation: text,
    variations: Object.fromEntries(c.map((v, i) => [i, v])),
  }));

test("Russian's one form is also 21, so its line keeps {number}", () => {
  const src = forms("{who} booked {seats} seats.", [[4], [20]]);
  expect(
    problemsWith(
      src,
      ["{who} забронировал одно место.", "{who} забронировал {seats} места."],
      "ru-RU",
    ).join(),
  ).toMatch(/keep the placeholder \{seats\}/);
});

test("German's one form is 1 alone, so its line may say it in words", () => {
  const src = forms("{seats} seats left", [[4], [24]]);
  expect(problemsWith(src, ["Ein Platz frei", "{seats} Plätze frei"], "de-DE")).toEqual([]);
});

test("a line too many or too few is the first problem", () => {
  const src = forms("{seats} seats left", [[4], [24]]);
  expect(problemsWith(src, ["{seats} Plätze frei"], "de-DE")).toEqual([
    "Give exactly 2 line(s), one per source line.",
  ]);
});
