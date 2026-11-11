// The formats page, every language, in Chromium and WebKit: its own run (`vp run test:formats`, and
// in CI against the deployed site), apart from `vp test run`, because it grows with every language.
// Every row is formatted by the Worker (the loader) and again by the browser. In Chromium (V8 with
// ICU, as the Worker) they must be identical: what rendering with Intl on the server and hydrating
// in the browser depends on (plan #1, decision 49). WebKit has Apple's locale data, so some rows
// differ there by design: it must load without errors, and its differences are reported, not
// listed here (no per-language list to keep up as languages are added).
import { appendFileSync } from "node:fs";
import { describe, expect, test } from "vite-plus/test";
import type { Page } from "playwright";
import { browser, collectErrors, seeText, text, untilText } from "../helpers";
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

for (const locale of LOCALES) {
  test(`${locale}: every row the same on the Worker and in the browser`, async () => {
    const p = await page();
    const errors = collectErrors(p);
    expect(await differences(p, locale)).toEqual([]);
    expect(await p.locator("tr[data-row]").count()).toBeGreaterThan(130);
    expect(errors).toEqual([]);
  });
}

describe("WebKit", () => {
  const safari = browser("prod", "webkit");
  for (const locale of LOCALES) {
    test(`${locale}: no errors; engine differences reported`, async () => {
      const p = await safari();
      const errors = collectErrors(p);
      const differs = (await differences(p, locale)).filter(
        ([row]) => !row!.startsWith("supported/"),
      );
      expect(await p.locator("tr[data-row]").count()).toBeGreaterThan(130);
      expect(errors).toEqual([]);
      report(`WebKit, ${locale}`, differs);
    });
  }
});

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

test("Temporal rows match with the polyfill too (Safari's path)", async () => {
  const p = await page();
  await p.addInitScript(() => delete (globalThis as { Temporal?: unknown }).Temporal);
  const diff = await differences(p, "th-TH");
  expect(diff).toEqual([]);
  expect(await text(p, "formats-title")).toBe("รูปแบบ");
});

test("in your time zone: the browser's own zone, after hydration", async () => {
  const p = await page({ timezoneId: "America/New_York", locale: "en-US" });
  await p.goto("/en-US/docs/formats");
  await seeText(p, "your-time", "In your time zone: Saturday, July 4, 2026 at 11:30:45 AM EDT");
});

test("ar-EG: a number typed in Arabic digits, read back and formatted by the Worker", async () => {
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
