// Browser helpers for the e2e tests: Playwright's library inside Vitest, as voidzero-dev/void
// does (test/browser-helpers.ts).
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { afterAll, afterEach, beforeAll, expect, inject } from "vite-plus/test";

export const url = (mode: "prod" | "dev") => inject(mode as never) as string;

/** One browser per test file; each `page()` gets a fresh context, closed after its test. */
export function browser(mode: "prod" | "dev") {
  let b: Browser;
  const contexts: BrowserContext[] = [];
  beforeAll(async () => {
    b = await chromium.launch();
  });
  afterEach(async () => {
    for (const c of contexts.splice(0)) await c.close();
  });
  afterAll(() => b?.close());
  return async (): Promise<Page> => {
    const context = await b.newContext({ baseURL: url(mode) });
    contexts.push(context);
    return context.newPage();
  };
}

/** The text of `[data-testid=id]`, once it's there. */
export async function text(page: Page, id: string) {
  const el = page.getByTestId(id);
  await el.waitFor();
  return el.textContent();
}

/** Wait until `[data-testid=id]` shows `want` (live reload, hydration). */
export const seeText = (page: Page, id: string, want: string, timeout = 5000) =>
  expect.poll(() => page.getByTestId(id).textContent(), { timeout }).toBe(want);

/**
 * Wait for an island (by the end of its name; any island without one) to hydrate. Each island
 * hydrates on its own (void's waitForIslandsHydrated).
 */
export const hydrated = (page: Page, name?: string) =>
  page
    .locator(`[data-island${name ? `$="${name}"` : ""}][data-hydrated="true"]`)
    .first()
    .waitFor();

/**
 * Records every text each `[data-testid]` element ever shows, from the first byte of HTML
 * until the test reads it, so a flash of untranslated text is caught even if it's fixed a
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
  return (): Promise<Record<string, string[]>> =>
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
 * production). It happens on a page with no fbtee too (plan #1, decision 8), so it's expected
 * there and only there.
 */
export const VOID_DEFER_MESSAGE = /Switched to client rendering|Minified React error #419/;
