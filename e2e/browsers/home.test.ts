// "/" in real browsers: each opens the site's own address and lands in its own language, as the
// browser sets Accept-Language from its locale (plans/their-own-language.md).
import { describe, expect, test } from "vite-plus/test";
import { browser, collectErrors, VOID_DEFER_MESSAGE } from "../helpers";

for (const engine of ["chromium", "webkit"] as const) {
  describe(engine, () => {
    const open = browser("prod", engine);
    for (const [locale, lands, dir] of [
      ["th-TH", "/th-TH", "ltr"],
      ["ar-SA", "/ar-EG", "rtl"],
      ["fr-FR", "/en-US", "ltr"],
    ] as const)
      test(`a browser in ${locale} opening "/" lands on ${lands}`, async () => {
        const p = await open({ locale });
        const errors = collectErrors(p);
        await p.goto("/");
        expect(new URL(p.url()).pathname).toBe(lands);
        expect(await p.locator("html").getAttribute("dir")).toBe(dir);
        expect(errors.filter((e) => !VOID_DEFER_MESSAGE.test(e))).toEqual([]);
      });
  });
}
