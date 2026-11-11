// The Formats page, every language, in Chromium and WebKit. Each row is formatted by the Worker
// (the loader: the text the app's pages show) and again by the browser after hydration. Each
// engine ships its own locale data, so rows can differ, by design: the page must load without
// errors in each, and the rows that differ go to the report (and the GitHub job's summary), not
// a list kept here, so a new language needs no change. Hydration itself is pages.test.ts.
import { appendFileSync } from "node:fs";
import { describe, expect, test } from "vite-plus/test";
import type { Page } from "playwright";
import { browser, collectErrors, seeText, untilText } from "../helpers";
import { LOCALES } from "../locales";

const page = browser("prod");

/** Load the formats page and return the rows where the browser differs from the Worker. */
async function differences(p: Page, locale: string) {
  await p.goto(`/${locale}/docs/formats`);
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

for (const engine of ["chromium", "webkit"] as const) {
  describe(engine, () => {
    const open = browser("prod", engine);
    for (const locale of LOCALES) {
      test(`${locale}: no errors; engine differences reported`, async () => {
        const p = await open();
        const errors = collectErrors(p);
        const differs = (await differences(p, locale)).filter(
          ([row]) => !row!.startsWith("supported/"),
        );
        expect(await p.locator("tr[data-row]").count()).toBeGreaterThan(100);
        expect(errors).toEqual([]);
        report(`${engine}, ${locale}`, differs);
      });
    }
  });
}

/** Print the rows that differ, and add them to the GitHub job's summary when run there. */
function report(title: string, rows: (string | null | undefined)[][]) {
  const lines = rows.map(([row, worker, browser]) => `| ${row} | ${worker} | ${browser} |`);
  console.log(`${title}: ${rows.length} rows differ\n${lines.join("\n")}`);
  const summary = process.env.GITHUB_STEP_SUMMARY;
  if (summary)
    appendFileSync(
      summary,
      `### ${title}: ${rows.length} rows differ\n\n` +
        (rows.length
          ? `| Row | Worker | Browser |\n| --- | --- | --- |\n${lines.join("\n")}\n\n`
          : ""),
    );
}

test("in your time zone: the browser's own zone, after hydration", async () => {
  const p = await page({ timezoneId: "America/New_York", locale: "en-US" });
  await p.goto("/en-US/docs/formats");
  await seeText(p, "your-time", "In your time zone: Saturday, July 4, 2026 at 11:30:45 AM EDT");
});

test("ar-EG: a number typed in Arabic digits, read back in the browser, formatted by the Worker", async () => {
  const p = await page();
  const errors = collectErrors(p);
  await p.goto("/ar-EG/docs/formats");
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
