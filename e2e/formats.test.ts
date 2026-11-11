// Production build: the formats page. Every row is formatted by the Worker (the loader) and again
// by the browser; they must be identical, in every language. That agreement is what rendering with
// Intl on the server and hydrating in the browser depends on (plan #1, decision 49).
import { expect, test } from "vite-plus/test";
import type { Page } from "playwright";
import { browser, collectErrors, seeText, text, untilText } from "./helpers";
import { LOCALES } from "./locales";

const page = browser("prod");

/** Load the formats page and return the rows where the browser differs from the Worker. */
async function differences(p: Page, locale: string) {
  await p.goto(`/${locale}/formats`);
  await untilText(p, '[data-testid="formats-match"]', "not", "…");
  return p.$$eval("tr[data-row]", (rows) =>
    rows
      .map((r) => [
        (r as HTMLElement).dataset.row,
        r.querySelector('[data-side="worker"]')!.textContent,
        r.querySelector('[data-side="browser"]')!.textContent,
      ])
      .filter(([, worker, browser]) => worker !== browser),
  );
}

for (const locale of LOCALES) {
  test(`${locale}: every row the same on the Worker and in the browser`, async () => {
    const p = await page();
    const errors = collectErrors(p);
    expect(await differences(p, locale)).toEqual([]);
    expect(await p.locator("tr[data-row]").count()).toBeGreaterThan(130);
    expect(errors).toEqual([]);
  });
}

test("Temporal rows match with the polyfill too (Safari's path)", async () => {
  const p = await page();
  await p.addInitScript(() => delete (globalThis as { Temporal?: unknown }).Temporal);
  const diff = await differences(p, "th-TH");
  expect(diff).toEqual([]);
  expect(await text(p, "formats-title")).toBe("รูปแบบ");
});

test("in your time zone: the browser's own zone, after hydration", async () => {
  const p = await page({ timezoneId: "America/New_York", locale: "en-US" });
  await p.goto("/en-US/formats");
  await seeText(p, "your-time", "In your time zone: Saturday, July 4, 2026 at 11:30:45 AM EDT");
});

test("ar-EG: a number typed in Arabic digits, read back and formatted by the Worker", async () => {
  const p = await page();
  const errors = collectErrors(p);
  await p.goto("/ar-EG/formats");
  await untilText(p, '[data-testid="formats-match"]', "not", "…");
  await p.getByTestId("try-number").fill("٢٬٥٠٠٫٧٥");
  await p.getByTestId("try-server").click();
  const row = (name: string) => p.locator(`[data-try="${name}"]`);
  await untilText(p, '[data-try="value"] [data-side="worker"]', "is", "2500.75");
  for (const name of ["value", "default", "currency", "compact", "plural", "words"])
    expect(await row(name).locator('[data-side="worker"]').textContent(), name).toBe(
      await row(name).locator('[data-side="browser"]').textContent(),
    );
  expect(await row("default").locator('[data-side="worker"]').textContent()).toBe("٢٬٥٠٠٫٧٥");
  expect(errors).toEqual([]);
});
