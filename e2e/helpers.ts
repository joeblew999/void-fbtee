// Browser helpers for the e2e tests: Playwright's library inside Vitest, as voidzero-dev/void
// does (test/browser-helpers.ts).
import {
  chromium,
  webkit,
  type Browser,
  type BrowserContext,
  type BrowserContextOptions,
  type Page,
} from "playwright";
import { afterAll, afterEach, beforeAll, inject } from "vite-plus/test";

export const url = (mode: "prod") => inject(mode as never) as string;

/**
 * One browser per test file; each `page()` gets a fresh context, closed after its test. Chromium
 * unless asked for WebKit, Safari's engine (its own Intl and locale data).
 */
export function browser(mode: "prod", engine: "chromium" | "webkit" = "chromium") {
  let b: Browser;
  const contexts: BrowserContext[] = [];
  beforeAll(async () => {
    b = await (engine === "webkit" ? webkit : chromium).launch();
  });
  afterEach(async () => {
    for (const c of contexts.splice(0)) await c.close();
  });
  afterAll(() => b?.close());
  return async (options: BrowserContextOptions = {}): Promise<Page> => {
    const context = await b.newContext({ baseURL: url(mode), ...options });
    // No time limits on Playwright's waits either (its default is 30s).
    context.setDefaultTimeout(0);
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

/**
 * Wait until the `nth` element matching `selector` has text that `is`, `has` or is `not` `want`
 * (hydration, live updates, an answer from the Worker). Playwright's wait, with no time limit.
 */
export async function untilText(
  page: Page,
  selector: string,
  kind: "is" | "has" | "not",
  want: string,
  nth = 0,
) {
  await page.waitForFunction(
    ([selector, kind, want, nth]) => {
      const text = document.querySelectorAll(selector as string)[nth as number]?.textContent;
      if (text == null) return false;
      return kind === "is"
        ? text === want
        : kind === "has"
          ? text.includes(want as string)
          : text !== want;
    },
    [selector, kind, want, nth] as const,
  );
}

/** Wait until `[data-testid=id]` shows `want`. */
export const seeText = (page: Page, id: string, want: string) =>
  untilText(page, `[data-testid="${id}"]`, "is", want);

/**
 * Wait until the page has started in the browser (the root layout's `<html data-hydrated>`), before
 * using a form or a link. Not `networkidle`, which voidzero-dev/void's TESTING.md says doesn't show
 * that the page is ready.
 */
export const started = (page: Page) =>
  page.locator('html[data-hydrated="true"]').waitFor({ state: "attached" });

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
 * production). It happens on a page with no fbtee too, so it's Void's and not ours: expected
 * there and only there.
 */
export const VOID_DEFER_MESSAGE = /Switched to client rendering|Minified React error #419/;
