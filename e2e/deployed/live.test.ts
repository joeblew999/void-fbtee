// The quick check of a deployed site, after each deploy (`vp run test:deployed`, scripts/deployed.ts):
// the sitemap, a not-found page in Thai, and one event posted, translated by Workers AI and deleted
// with its private link. It emails no one (it posts without an address and books nothing).
//
// Void's own rule is that live tests are opt-in (voidzero-dev/void TESTING.md): they write data and
// call AI. This one runs in CI as an exception: CI deploys every push to main, and this one
// post, translated and deleted at once, is the only check that a deploy works end to end. Without a
// site to check (a plain `vp test run`), it skips itself. The full browser tests run on the preview
// (`vp run test:preview`, `vp run test:browsers`).
import { afterAll, describe, expect, test } from "vite-plus/test";
import {
  browser,
  deleteEvent,
  deleteInPage,
  postEvent,
  started,
  url,
  type Posted,
} from "../helpers";
import { SOURCE, TRANSLATED } from "../locales";

const site = url("prod");
const page = browser("prod");
let posted: Posted | undefined;

describe.skipIf(!site)("the live site (run with `vp run test:deployed`)", () => {
  test("the sitemap lists every language's pages", async () => {
    const r = await fetch(`${site}/sitemap.xml`);
    expect(r.status).toBe(200);
    const xml = await r.text();
    for (const lang of [SOURCE, ...TRANSLATED]) expect(xml).toContain(`/${lang}</loc>`);
  });

  test("a page that doesn't exist answers 404 in its language", async () => {
    const r = await fetch(`${site}/th-TH/no-such-page`);
    expect(r.status).toBe(404);
    expect(await r.text()).toContain('lang="th-TH"');
  });

  test("an event is posted, translated by Workers AI, and deleted with its private link", async () => {
    const p = await page();
    posted = await postEvent(p, {
      title: "Live check: pottery class",
      description: "A pottery class for beginners. Clay is provided.",
      local: "2027-01-20T18:00",
    });

    // The Thai page, open while the queue translates: it reloads itself when the translation lands
    // (its live stream's "translated"), and its title turns Thai, whatever the wording.
    const thai = await page();
    await thai.goto(`/th-TH/events/${posted.id}`);
    await started(thai);
    await thai.waitForFunction(() => /[฀-๿]/.test(document.querySelector("h1")?.textContent ?? ""));

    await deleteInPage(p);
    expect((await fetch(`${site}/${SOURCE}/events/${posted.id}`)).status).toBe(404);
    posted = undefined;
  });
});

// If the test stopped before deleting it, the event is deleted here, as its page would.
afterAll(async () => {
  if (posted)
    expect(await deleteEvent(posted), `deleting the check's event ${posted.id}`).toBe(true);
});
