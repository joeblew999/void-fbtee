// The quick check of a deployed site, after every push (`vp run test:deployed`, e2e/deployed.ts):
// the sitemap, a not-found page in Thai, and one event posted, translated by Workers AI and deleted
// with its private link. The full browser tests run locally (`vp test run`, `vp run test:browsers`).
import { afterAll, expect, test } from "vite-plus/test";
import { browser, started, url } from "../helpers";
import { SOURCE, TRANSLATED } from "../locales";

const page = browser("prod");
const TITLE = "Live check: pottery class";
let posted: { id: string; key: string } | undefined;

test("the sitemap lists every language's pages", async () => {
  const r = await fetch(`${url("prod")}/sitemap.xml`);
  expect(r.status).toBe(200);
  const xml = await r.text();
  for (const lang of [SOURCE, ...TRANSLATED]) expect(xml).toContain(`/${lang}</loc>`);
});

test("a page that doesn't exist answers 404 in its language", async () => {
  const r = await fetch(`${url("prod")}/th-TH/no-such-page`);
  expect(r.status).toBe(404);
  expect(await r.text()).toContain('lang="th-TH"');
});

test("an event is posted, translated by Workers AI, and deleted with its private link", async () => {
  const p = await page();
  await p.goto(`/${SOURCE}/events/new`);
  await started(p);
  await p.getByTestId("event-title-input").fill(TITLE);
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

  // Workers AI only on a deployed site: a local preview has no Cloudflare sign-in for it.
  if (process.env.E2E_URL) {
    // The Thai page shows a Thai title once the queue has translated it. A cookie skips the cache.
    let title = TITLE;
    while (title.includes("pottery")) {
      await new Promise((r) => setTimeout(r, 2000));
      const html = await (
        await fetch(`${url("prod")}/th-TH/events/${posted.id}`, { headers: { cookie: "check=1" } })
      ).text();
      title = /<h1[^>]*>([^<]*)/.exec(html)?.[1] ?? TITLE;
    }
  }

  await p.getByTestId("delete").click();
  await p.getByTestId("delete-sure").click();
  await p.waitForURL(new RegExp(`/${SOURCE}/events$`));
  expect((await fetch(`${url("prod")}/${SOURCE}/events/${posted.id}`)).status).toBe(404);
  posted = undefined;
});

// If the test stopped before deleting it, the event is deleted here, as its page would.
afterAll(async () => {
  if (!posted) return;
  const r = await fetch(`${url("prod")}/${SOURCE}/events/${posted.id}?delete`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-VoidPages": "true", origin: url("prod") },
    body: JSON.stringify({ key: posted.key }),
    redirect: "manual",
  });
  expect(r.status, `deleting the check's event ${posted.id}`).toBe(302);
});
