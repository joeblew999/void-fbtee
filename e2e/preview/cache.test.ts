// Production build: changes clear Void's page cache. Posting, booking and deleting each clear the
// pages they change, in every language (revalidate() from void-fbtee/server), so the next visitor
// gets the change, not the cached page. A page showing an event in a language it isn't translated
// into yet isn't cached at all (awaitsTranslation, src/events/translations.ts), so the cache never
// holds it in the wrong language; once Workers AI's translation is in (the translate queue, which
// the preview runs: void.config.ts), it is. Read through Void's own cache header, `x-isr-cache`
// (@void/isr): HIT from the cache, MISS when built afresh and stored, none when built afresh and
// not stored (@void/isr's runtime.mjs returns an uncacheable render as it is). Only the production
// build has the cache (Void's runtime/isr.mjs: none in dev), so this runs on the preview. Fetches
// send no cookie: a request with one skips the cache (guide/edge/revalidation.md).
import { expect, test } from "vite-plus/test";
import { book, browser, onLiveSite, postEvent, started, url } from "../helpers";

const page = browser("prod");

/** A fresh visitor's request: the cache's answer, and the page. */
async function visit(path: string) {
  const r = await fetch(`${url("prod")}${path}`);
  return { cache: r.headers.get("x-isr-cache"), status: r.status, html: await r.text() };
}

/** Visits until the cache serves the page (the first visit fills it). */
async function cached(path: string) {
  await visit(path);
  expect((await visit(path)).cache).toBe("HIT");
}

/**
 * Visits a page in a language the event is being translated into, until the translation shows
 * (the page's "translated by machine" note). Every visit before that was built afresh and not
 * stored (none, if the translation was quicker than the first visit).
 */
async function untilTranslated(path: string) {
  const before: (string | null)[] = [];
  await expect
    .poll(
      async () => {
        const v = await visit(path);
        const done = v.html.includes('data-testid="event-translated"');
        if (!done) before.push(v.cache);
        return done;
      },
      { timeout: 60_000, interval: 500 },
    )
    .toBe(true);
  expect(before.filter((cache) => cache !== null)).toEqual([]);
}

test.skipIf(onLiveSite())(
  "posting, booking and deleting clear the cached pages they change; a page waits uncached for its translation",
  async () => {
    const title = `Cache check ${crypto.randomUUID().slice(0, 8)}`;
    await cached("/en-US/events");
    await cached("/th-TH/events");

    const p = await page();
    const event = await postEvent(p, { title, local: "2027-01-20T18:00", seats: 5 });

    // Translating: the Thai page isn't cached until Workers AI's Thai is in, then it is. Done first,
    // as the translation landing clears the event's pages and the list again.
    const thai = `/th-TH${event.path}`;
    await untilTranslated(thai);
    await cached(thai);
    expect((await visit(thai)).html).toContain('data-testid="event-translated"');

    // Posting: the events list, in each language, built afresh with the new event in it.
    const list = await visit("/en-US/events");
    expect(list.cache).not.toBe("HIT");
    expect(list.html).toContain(title);
    expect((await visit("/en-US/events")).cache).toBe("HIT");
    await cached("/th-TH/events");

    // Booking: the event's page, built afresh with one seat fewer, in every language.
    await cached(`/en-US${event.path}`);
    await book(p, "Cache", "cache@example.com");
    const after = await visit(`/en-US${event.path}`);
    expect(after.cache).toBe("MISS");
    expect(after.html).toContain("4 seats left");
    expect((await visit(thai)).cache).toBe("MISS");

    // Deleting: the event's page is gone and the list, built afresh, no longer has it.
    await p.reload();
    await started(p);
    await p.getByTestId("delete").click();
    await p.getByTestId("delete-sure").click();
    await p.waitForURL(/\/events$/);
    expect((await visit(`/en-US${event.path}`)).status).toBe(404);
    const gone = await visit("/en-US/events");
    expect(gone.cache).toBe("MISS");
    expect(gone.html).not.toContain(title);
  },
);
