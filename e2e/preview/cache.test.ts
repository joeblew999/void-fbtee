// Production build: changes clear Void's page cache. Posting, booking and deleting each clear the
// pages they change, in every language (revalidate() from void-fbtee/server), so the next visitor
// gets the change, not the cached page. And a page showing an event in a language it isn't
// translated into yet isn't cached at all (awaitsTranslation, src/events/translations.ts), so the
// cache never holds it in the wrong language. Read through Void's own cache header, `x-isr-cache`
// (@void/isr): HIT from the cache, MISS when built afresh and stored, none when built afresh and not
// stored (Void's isr runtime.mjs: an uncacheable render is returned as it is). Only the production build has the cache
// (Void's runtime/isr.mjs: none in dev), so this runs on the preview. Fetches send no cookie: a
// request with one skips the cache (guide/edge/revalidation.md).
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

/** Visits twice: built afresh both times, and never stored. */
async function notCached(path: string) {
  expect((await visit(path)).cache).toBeNull();
  expect((await visit(path)).cache).toBeNull();
}

test.skipIf(onLiveSite())(
  "posting, booking and deleting clear the cached pages they change; untranslated pages aren't cached",
  async () => {
    const title = `Cache check ${crypto.randomUUID().slice(0, 8)}`;
    await cached("/en-US/events");
    await cached("/th-TH/events");

    const p = await page();
    // On the preview, Workers AI doesn't run (plans/plain-stage-compass.md, "Found while building"),
    // so the event stays untranslated: its pages in English, the language it's posted in, are
    // cached; in the other languages they wait for a translation, so they never are.
    const event = await postEvent(p, { title, local: "2027-01-20T18:00", seats: 5 });

    // Posting: the events list, in each language, built afresh with the new event in it.
    const list = await visit("/en-US/events");
    expect(list.cache).toBe("MISS");
    expect(list.html).toContain(title);
    expect((await visit("/en-US/events")).cache).toBe("HIT");
    await notCached("/th-TH/events");

    // The event's page: cached in English; in Arabic, not yet translated, built afresh each time.
    await cached(`/en-US${event.path}`);
    await notCached(`/ar-EG${event.path}`);

    // Booking: the event's page, built afresh with one seat fewer.
    await book(p, "Cache", "cache@example.com");
    const after = await visit(`/en-US${event.path}`);
    expect(after.cache).toBe("MISS");
    expect(after.html).toContain("4 seats left");

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
