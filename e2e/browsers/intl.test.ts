// The Intl page, every language, in Chromium and WebKit. Each row is formatted by the Worker
// (the loader: the text the app's pages show) and again by the browser after hydration. Each
// engine ships its own locale data, so rows can differ, by design: the page must load without
// errors in each, and the rows that differ go to the report (and the GitHub job's summary), not
// a list kept here, so a new language needs no change. Hydration itself is hydration.test.ts.
import { appendFileSync } from "node:fs";
import { describe, expect, test } from "vite-plus/test";
import type { Page } from "playwright";
import { browser, collectErrors, untilText } from "../helpers";
import { LOCALES } from "../locales";

/**
 * Load the Intl page and return the rows it highlights as differing (as shown: invisible
 * characters by name, and for supported values only what differs).
 */
async function differences(p: Page, locale: string) {
  await p.goto(`/${locale}/docs/intl`);
  await untilText(p, '[data-testid="intl-match"]', "not", "");
  return p.$$eval("tr[data-differs]", (rows) =>
    rows.map((r) => [
      (r as HTMLElement).dataset.row,
      r.querySelector('[data-side="worker"]')!.textContent,
      r.querySelector('[data-side="browser"]')!.textContent,
    ]),
  );
}

for (const engine of ["chromium", "webkit"] as const) {
  describe(engine, () => {
    const open = browser("prod", engine);
    for (const locale of LOCALES) {
      test(`${locale}: no errors; engine differences reported`, async () => {
        const p = await open();
        const errors = collectErrors(p);
        const differs = await differences(p, locale);
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
