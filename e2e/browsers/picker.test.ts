// void-fbtee's language picker in the example's header, in real
// Chromium and WebKit: on a code page, an island page and a markdown page, in English and Arabic,
// with JavaScript and without.
import { describe, expect, test } from "vite-plus/test";
import { browser, collectErrors, started, VOID_DEFER_MESSAGE } from "../helpers";
import { LOCALES } from "../locales";

const PAGES = [
  ["a code page", "/docs/intl", true],
  ["an island page", "/docs", false],
  ["a markdown page", "/docs/tour", false],
] as const;
const item = (locale: string) => `[data-part="list"] a[hreflang="${locale}"]`;

for (const engine of ["chromium", "webkit"] as const) {
  describe(engine, () => {
    const open = browser("prod", engine);

    for (const [kind, path, hydrated] of PAGES)
      for (const page of ["en-US", "ar-EG"])
        test(`${kind} in ${page}: every language, each linking to this page, nothing stored`, async () => {
          const p = await open({ locale: "th-TH" });
          const errors = collectErrors(p);
          await p.goto(`/${page}${path}`);
          // Code pages hydrate the root layout; markdown and island pages don't, so there's
          // nothing to wait for but the page.
          if (hydrated) await started(p);
          // Closed, it names the page's language in itself.
          const summary = p.locator('[data-part="summary"]');
          expect(await summary.textContent()).toBe(page === "en-US" ? "English" : "العربية");
          await summary.click();
          expect(await p.locator('[data-part="root"]').getAttribute("open")).toBe("");
          for (const l of LOCALES) {
            const a = p.locator(item(l));
            expect(await a.getAttribute("href"), l).toBe(`/${l}${path}`);
            // Each name in its own language and direction; the row itself follows the page's,
            // so Arabic's name sits where every other language's does.
            const name = a.locator('[data-part="name"]');
            expect(await name.getAttribute("lang"), l).toBe(l);
            expect(await name.getAttribute("dir"), l).toBe(l === "ar-EG" ? "rtl" : "ltr");
            expect(await a.getAttribute("dir"), l).toBeNull();
          }
          expect(await p.locator(item(page)).getAttribute("aria-current")).toBe("true");
          // A Thai browser: Thai first, marked as theirs, where the page is hydrated; the plain
          // full list where it isn't (markdown and island pages' layouts).
          const yours = p.locator('[data-part="yours"] a');
          if (hydrated) {
            expect(
              await yours.evaluateAll((as) => as.map((a) => a.getAttribute("hreflang"))),
            ).toEqual(["th-TH"]);
            expect(await p.locator('[data-part="root"]').getAttribute("data-yours-elsewhere")).toBe(
              "",
            );
            expect(await p.locator('[data-part="yours-label"]').textContent()).toBe(
              page === "en-US" ? "Your language" : "لغتك",
            );
          } else expect(await yours.count()).toBe(0);
          await p.locator(item("th-TH")).click();
          await p.waitForURL(`**/th-TH${path}`);
          expect(await p.locator("html").getAttribute("lang")).toBe("th-TH");
          // Nothing of the language's is stored. (Void keeps scroll positions in sessionStorage,
          // "void:scroll:…", void/dist/pages/client.mjs: its own, not a choice of language.)
          const stored = await p.evaluate(() => ({
            cookie: document.cookie,
            local: Object.keys(localStorage),
            session: Object.keys(sessionStorage).filter((k) => !k.startsWith("void:scroll:")),
          }));
          expect(stored).toEqual({ cookie: "", local: [], session: [] });
          expect(errors.filter((e) => !VOID_DEFER_MESSAGE.test(e))).toEqual([]);
        });

    test("search finds a language by either name or its code, in the page's words", async () => {
      const p = await open({ locale: "en-US" });
      await p.goto("/en-US/docs/intl");
      await started(p);
      await p.locator('[data-part="summary"]').click();
      const search = p.locator('[data-part="search"]');
      expect(await search.getAttribute("placeholder")).toBe("Search languages");
      const visible = () =>
        p
          .locator('[data-part="list"] li:not([hidden]) a')
          .evaluateAll((as) => as.map((a) => a.getAttribute("hreflang")));
      for (const q of ["thai", "ไทย", "th", "THAI"]) {
        await search.fill(q);
        expect(await visible(), q).toEqual(["th-TH"]);
      }
      await search.fill("");
      // In the page language's order: Arabic, English, Thai.
      expect(await visible()).toEqual(["ar-EG", "en-US", "th-TH"]);
      // An English browser on an English page: English is theirs and the page's, so no mark.
      expect(await p.locator('[data-part="root"]').getAttribute("data-yours-elsewhere")).toBeNull();
    });

    test("with JavaScript off it opens, lists every language and its links work", async () => {
      const p = await open({ locale: "th-TH", javaScriptEnabled: false });
      await p.goto("/en-US/docs/intl");
      await p.locator('[data-part="summary"]').click();
      expect(await p.locator('[data-part="search"]').count()).toBe(0);
      for (const l of LOCALES) expect(await p.locator(item(l)).isVisible(), l).toBe(true);
      await p.locator(item("ar-EG")).click();
      await p.waitForURL("**/ar-EG/docs/intl");
      expect(await p.locator("html").getAttribute("dir")).toBe("rtl");
    });
  });
}
