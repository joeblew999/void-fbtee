// Translated text from the server, kept through hydration, never flashing another language:
// the page with defer() data and the page with text streamed after the shell.
import { test, expect } from "@playwright/test";
import { watchTexts, collectErrors, VOID_DEFER_MESSAGE } from "./helpers";

const WANT = {
  "en-US": {
    title: "Hello world",
    plural: "You booked 3 nights",
    deferred: "Deferred: 1 night left",
    streamed: "Streamed after the shell",
  },
  "th-TH": {
    title: "สวัสดีชาวโลก",
    plural: "คุณจองไว้ 3 คืน",
    deferred: "ภายหลัง: เหลืออีก 1 คืน",
    streamed: "ส่งตามมาหลังเชลล์",
  },
  "de-DE": {
    title: "Hallo Welt",
    plural: "Sie haben 3 Nächte gebucht",
    deferred: "Später: noch 1 Nacht",
    streamed: "Nach der Shell gestreamt",
  },
};

for (const [locale, want] of Object.entries(WANT)) {
  for (const [path, keys] of [
    ["", ["title", "plural", "deferred"]],
    ["/stream", ["title", "streamed"]],
  ] as const) {
    test(`${locale}${path || "/"}: translated, no flash`, async ({ page }) => {
      const errors = collectErrors(page);
      const seen = await watchTexts(page);
      await page.goto(`/${locale}${path}`);
      for (const k of keys) await expect(page.getByTestId(k)).toHaveText(want[k]);
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      const texts = await seen();
      for (const k of keys) {
        // "…" is the page's own Suspense fallback before the deferred data arrives.
        expect(
          texts[k]?.filter((t) => t !== "…"),
          k,
        ).toEqual([want[k]]);
      }
      const unexpected = path ? errors : errors.filter((e) => !VOID_DEFER_MESSAGE.test(e));
      expect(unexpected).toEqual([]);
    });
  }
}
