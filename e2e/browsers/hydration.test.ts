// Every page, in every language, in Chromium and WebKit: it loads and hydrates with no errors.
// A page whose server text and browser text disagree fails here (React error #418), which is what
// happens when text formatted while rendering isn't <Formatted>: each engine has its own locale
// data. The pages come from the site's own links (each language's home and docs index, one event
// page), so a new page or language needs no change here.
import { describe, expect, test } from "vite-plus/test";
import type { Page } from "playwright";
import { browser, collectErrors, VOID_DEFER_MESSAGE } from "../helpers";
import { LOCALES } from "../locales";

/**
 * Wait until the page has come alive, if it has anything to bring alive: the layout marks a
 * hydrated page (<html data-hydrated>), islands mark themselves. A page without scripts has none.
 */
const settled = (p: Page) =>
  p.waitForFunction(() => {
    if (!document.querySelector('script[type="module"]')) return true;
    if (document.documentElement.dataset.hydrated === "true") return true;
    const islands = [...document.querySelectorAll<HTMLElement>("[data-island]")];
    return islands.length > 0 && islands.every((i) => i.dataset.hydrated === "true");
  });

/** This language's pages, from its links: everything under /<locale>/, one event page. */
async function pages(p: Page, locale: string): Promise<string[]> {
  const found = new Set<string>();
  for (const start of [`/${locale}`, `/${locale}/docs`, `/${locale}/events`]) {
    await p.goto(start);
    const links = await p.$$eval("a[href]", (as) => as.map((a) => a.getAttribute("href")!));
    for (const href of [start, ...links])
      if (href === `/${locale}` || href.startsWith(`/${locale}/`)) found.add(href.split("#")[0]!);
  }
  const events = [...found].filter((h) => /\/events\/[^/]+$/.test(h));
  return [...found].filter((h) => !events.includes(h)).concat(events.slice(0, 1));
}

for (const engine of ["chromium", "webkit"] as const) {
  describe(engine, () => {
    const open = browser("prod", engine);
    for (const locale of LOCALES) {
      test(`${locale}: every page hydrates with no errors`, async () => {
        const p = await open({ timezoneId: "Asia/Bangkok" });
        const paths = await pages(p, locale);
        expect(paths.length).toBeGreaterThan(5);
        const failed: string[] = [];
        for (const path of paths) {
          const errors = collectErrors(p);
          await p.goto(path);
          await settled(p);
          const real = errors.filter((e) => !VOID_DEFER_MESSAGE.test(e));
          if (real.length) failed.push(`${path}: ${real.join(" | ")}`);
          p.removeAllListeners("console");
          p.removeAllListeners("pageerror");
        }
        console.log(`${engine}, ${locale}: ${paths.length} pages`);
        expect(failed).toEqual([]);
      });
    }
  });
}
