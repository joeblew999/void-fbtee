// Every page, in every language, in each browser (engines.ts): it loads and hydrates with no
// errors, and fits a phone's width.
// A page whose server text and browser text disagree fails here (React error #418), which is what
// happens when text formatted while rendering isn't <Formatted>: each engine has its own locale
// data. The pages come from the site's own links (each language's home and docs index, one event
// page), so a new page or language needs no change here.
import { describe, expect, test } from "vite-plus/test";
import type { Page } from "playwright";
import { browser, collectErrors, VOID_DEFER_MESSAGE } from "../helpers";
import { LOCALES } from "../locales";
import { ENGINES, prepare } from "./engines";

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

/**
 * This language's pages, from its links: everything under /<locale>/, one event page. Read over
 * plain HTTP, not by visiting: a page left mid-load makes WebKit report its cancelled scripts as
 * errors ("Importing a module script failed"), which would land on the next page checked.
 */
async function pages(p: Page, locale: string): Promise<string[]> {
  const found = new Set<string>();
  for (const start of [`/${locale}`, `/${locale}/docs`, `/${locale}/events`]) {
    const html = await (await p.request.get(start)).text();
    const links = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]!);
    for (const href of [start, ...links])
      if (href === `/${locale}` || href.startsWith(`/${locale}/`)) found.add(href.split("#")[0]!);
  }
  const events = [...found].filter((h) => /\/events\/[^/]+$/.test(h));
  return [...found].filter((h) => !events.includes(h)).concat(events.slice(0, 1));
}

/** A phone: an iPhone's width. */
const PHONE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };

for (const e of ENGINES) {
  describe(e.name, () => {
    const open = browser("prod", e.engine);
    for (const locale of LOCALES) {
      test(`${locale}: every page hydrates with no errors, and fits a phone`, async () => {
        const p = await open({ ...PHONE, timezoneId: "Asia/Bangkok" });
        await prepare(p, e);
        const paths = await pages(p, locale);
        expect(paths.length).toBeGreaterThan(5);
        const failed: string[] = [];
        for (const path of paths) {
          // A blank page between pages: anything the last page reports as it's left (WebKit's
          // cancelled scripts) comes before the next page's errors are collected.
          await p.goto("about:blank");
          const errors = collectErrors(p);
          await p.goto(path);
          await settled(p);
          const real = errors.filter((x) => !VOID_DEFER_MESSAGE.test(x));
          if (real.length) failed.push(`${path}: ${real.join(" | ")}`);
          const { layout, content } = await p.evaluate(() => ({
            layout: window.innerWidth,
            content: document.documentElement.scrollWidth,
          }));
          if (layout !== 390 || content > 390)
            failed.push(`${path}: laid out ${layout}px, content ${content}px`);
          p.removeAllListeners("console");
          p.removeAllListeners("pageerror");
        }
        console.log(`${e.name}, ${locale}: ${paths.length} pages`);
        expect(failed).toEqual([]);
      });
    }
  });
}
