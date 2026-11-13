// Production build: changes clear Void's page cache. Posting, booking and deleting each clear the
// pages they change, in every language (revalidate() from void-fbtee/server), so the next visitor
// gets the change, not the cached page. Read through Void's own cache header, `x-isr-cache`
// (@void/isr): HIT from the cache, MISS when built afresh. Only the production build has the cache
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

test.skipIf(onLiveSite())(
  "posting, booking and deleting each clear the cached pages they change, in every language",
  async () => {
    const title = `Cache check ${crypto.randomUUID().slice(0, 8)}`;
    await cached("/en-US/events");
    await cached("/th-TH/events");

    const p = await page();
    // On the preview, Workers AI doesn't run (plans/plain-stage-compass.md, "Found while building"),
    // so no translation lands later and clears the pages again while this reads the cache.
    const event = await postEvent(p, { title, local: "2027-01-20T18:00", seats: 5 });

    // Posting: the events list, in each language, built afresh with the new event in it.
    const list = await visit("/en-US/events");
    expect(list.cache).toBe("MISS");
    expect(list.html).toContain(title);
    expect((await visit("/th-TH/events")).cache).toBe("MISS");
    expect((await visit("/en-US/events")).cache).toBe("HIT");

    // Booking: the event's page, built afresh with one seat fewer.
    await cached(`/en-US${event.path}`);
    await cached(`/ar-EG${event.path}`);
    await book(p, "Cache", "cache@example.com");
    const after = await visit(`/en-US${event.path}`);
    expect(after.cache).toBe("MISS");
    expect(after.html).toContain("4 seats left");
    expect((await visit(`/ar-EG${event.path}`)).cache).toBe("MISS");

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
