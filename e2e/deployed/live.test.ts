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
import { browser, started, url } from "../helpers";
import { SOURCE, TRANSLATED } from "../locales";

const site = url("prod");
const page = browser("prod");
let posted: { id: string; key: string } | undefined;

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
    await p.goto(`/${SOURCE}/events/new`);
    await started(p);
    await p.getByTestId("event-title-input").fill("Live check: pottery class");
    await p
      .getByTestId("event-description-input")
      .fill("A pottery class for beginners. Clay is provided.");
    await p.getByTestId("event-local-input").fill("2027-01-20T18:00");
    await p.getByTestId("event-post").click();
    await p.waitForURL(/\/events\/[0-9a-f-]{36}#key=/);
    const at = new URL(p.url());
    posted = {
      id: at.pathname.split("/").pop()!,
      key: new URLSearchParams(at.hash.slice(1)).get("key")!,
    };

    // The Thai page, open while the queue translates: it reloads itself when the translation lands
    // (its live stream's "translated"), and its title turns Thai, whatever the wording.
    const thai = await page();
    await thai.goto(`/th-TH/events/${posted.id}`);
    await started(thai);
    await thai.waitForFunction(() => /[฀-๿]/.test(document.querySelector("h1")?.textContent ?? ""));

    await p.getByTestId("delete").click();
    await p.getByTestId("delete-sure").click();
    await p.waitForURL(new RegExp(`/${SOURCE}/events$`));
    expect((await fetch(`${site}/${SOURCE}/events/${posted.id}`)).status).toBe(404);
    posted = undefined;
  });
});

// If the test stopped before deleting it, the event is deleted here, as its page would.
afterAll(async () => {
  if (!posted) return;
  const r = await fetch(`${site}/${SOURCE}/events/${posted.id}?delete`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-VoidPages": "true", origin: site },
    body: JSON.stringify({ key: posted.key }),
    redirect: "manual",
  });
  expect(r.status, `deleting the check's event ${posted.id}`).toBe(302);
});
