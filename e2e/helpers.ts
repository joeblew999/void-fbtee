import type { Page } from "@playwright/test";

/**
 * Records every text each `[data-testid]` element ever shows, from the first byte of HTML
 * until the test reads it, so a flash of untranslated text is caught even if it is fixed a
 * moment later. Call before page.goto.
 */
export async function watchTexts(page: Page) {
  await page.addInitScript(() => {
    const seen: Record<string, Set<string>> = {};
    (window as unknown as { __seen: typeof seen }).__seen = seen;
    new MutationObserver(() =>
      document.querySelectorAll<HTMLElement>("[data-testid]").forEach((el) => {
        (seen[el.dataset.testid!] ??= new Set()).add(el.textContent ?? "");
      }),
    ).observe(document, { subtree: true, childList: true, characterData: true });
  });
  return async (): Promise<Record<string, string[]>> =>
    page.evaluate(() =>
      Object.fromEntries(
        Object.entries((window as unknown as { __seen: Record<string, Set<string>> }).__seen).map(
          ([k, v]) => [k, [...v]],
        ),
      ),
    );
}

/** Console errors and uncaught page errors. Call before page.goto. */
export function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(String(e)));
  return errors;
}

/**
 * Void cuts the server stream at the shell on defer() pages, and React reports it (#419 in
 * production). It happens on a page with no fbtee too (plan #1, decision 8), so it is expected
 * there and only there.
 */
export const VOID_DEFER_MESSAGE = /Switched to client rendering|Minified React error #419/;
