// The translator test's own data, before anything is sent to Void's AI (e2e/translator/): every
// language has a reference for every test string, a count one line per plural form the language
// uses, and each reference passes the checks the answers must pass (translate.ts problemsWith);
// and every language has a model (models.ts).
import { expect, test } from "vite-plus/test";
import { CHOICES, modelFor } from "../../src/models";
import { problemsWith } from "../../src/translate";
import { REFERENCES } from "../translator/references";
import { formsFor, STRINGS } from "../translator/strings";

for (const [locale, refs] of Object.entries(REFERENCES)) {
  test(`${locale}: a reference for every test string, each passing the checks`, () => {
    expect(Object.keys(refs).sort()).toEqual(STRINGS.map((s) => s.name).sort());
    for (const s of STRINGS) {
      const lines = s.plural ? formsFor(locale, s.lines[0]!.text) : s.lines;
      const source = lines.map((l) => ({ translation: l.text, variations: l.variations }));
      expect(problemsWith(source, refs[s.name]!), `${locale} ${s.name}`).toEqual([]);
    }
  });

  test(`${locale}: has its own model`, () => {
    expect(CHOICES[new Intl.Locale(locale).language], locale).toBeDefined();
    expect(modelFor(locale).id).toMatch(/^@cf\//);
  });
}
