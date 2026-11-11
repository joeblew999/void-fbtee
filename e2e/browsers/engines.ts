// The browsers the GitHub-only run (e2e/browsers/) checks the site in. "iphone" is WebKit as
// today's iPhones have it: Playwright's WebKit is newer than iOS Safari and has Temporal built in,
// which iPhones don't yet, so it's removed before each page loads and the site's own code runs on
// temporal-polyfill there, as it does on real iPhones.
import type { Page } from "playwright";

export const ENGINES = [
  { name: "chromium", engine: "chromium" },
  { name: "webkit", engine: "webkit" },
  { name: "iphone", engine: "webkit", noTemporal: true },
] as const;

export type Engine = (typeof ENGINES)[number];

/** Make a page what this engine stands for: for "iphone", no built-in Temporal. */
export async function prepare(p: Page, e: Engine) {
  if ("noTemporal" in e)
    await p.addInitScript(() => delete (globalThis as { Temporal?: unknown }).Temporal);
}
