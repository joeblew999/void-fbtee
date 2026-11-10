// Temporal values read the same in the server HTML and in the browser, before and after
// hydration: with the browser's native Temporal (Chrome) and without it (what Safari users get).
import { test, expect } from "@playwright/test";
import { watchTexts, collectErrors } from "./helpers";

const IDS = ["booking", "birthday", "length", "relative"];

for (const mode of ["native", "no-native"] as const) {
  for (const locale of ["th-TH", "de-DE", "ar-EG", "pl-PL"]) {
    test(`${locale}, ${mode} Temporal: browser text = server text`, async ({ page, request }) => {
      const html = await (await request.get(`/${locale}/time`)).text();
      const server = Object.fromEntries(
        IDS.map((k) => [k, html.match(new RegExp(`data-testid="${k}">([^<]*)`))?.[1]]),
      );
      for (const k of IDS) expect(server[k], `server ${k}`).toBeTruthy();

      if (mode === "no-native")
        await page.addInitScript(() => delete (globalThis as { Temporal?: unknown }).Temporal);
      const errors = collectErrors(page);
      const seen = await watchTexts(page);
      await page.goto(`/${locale}/time`);
      await page.waitForLoadState("networkidle");
      const engine = await page.evaluate(() => ("Temporal" in globalThis ? "native" : "polyfill"));
      expect(engine).toBe(mode === "native" ? "native" : "polyfill");
      const texts = await seen();
      for (const k of IDS) {
        await expect(page.getByTestId(k)).toHaveText(server[k]!);
        expect(texts[k] ?? [server[k]], k).toEqual([server[k]]);
      }
      expect(errors).toEqual([]);
    });
  }
}
