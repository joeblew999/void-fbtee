// Production build: the events app's own part. Each event's start on its city's clock and on the
// reader's, in the reader's language; an event posted in Arabic, then read in English. Void's
// forms, database and cache are Void's to test; this checks what void-fbtee and the app add.
import { afterAll, expect, test } from "vite-plus/test";
import {
  book,
  browser,
  collectErrors,
  confirmDelete,
  deleteEvent,
  deleteInPage,
  onLiveSite,
  postEvent,
  seeText,
  started,
  untilText,
  url,
  type Posted,
} from "../helpers";
import { SOURCE } from "../locales";

const page = browser("prod");

/** A sample event's page in a language, found by its English title (db/migrations/*_sample_events.sql). */
async function goToEvent(p: import("playwright").Page, locale: string, englishTitle: string) {
  await p.goto(`/${SOURCE}/events`);
  const href = await p
    .getByTestId("events-list")
    .locator("a")
    .filter({ hasText: englishTitle })
    .getAttribute("href");
  await p.goto(href!.replace(`/${SOURCE}/`, `/${locale}/`));
  // Void's form works once the page has hydrated.
  await started(p);
}
const WHEN: Intl.DateTimeFormatOptions = {
  weekday: "long",
  day: "numeric",
  month: "long",
  hour: "numeric",
  minute: "2-digit",
  timeZoneName: "longGeneric",
};
const SWIM = "2027-03-06T19:00:00Z"; // Harbour sunrise swim: 6:00 on 7 March in Sydney

/**
 * When the tests' events start: already past, so on the live site they never show in the list of
 * upcoming events (its loader lists only those still to come), yet posting and booking run for real.
 */
const TEST_START = "2026-01-01T20:00";

/**
 * The events these tests post, each with the key from its poster's private delete link: deleted
 * when the file ends, as their poster would, so no test leaves an event behind on the live site.
 */
const posted: Posted[] = [];

/**
 * The event the page just posted: once the page has its key (the address's "#key=…", the private
 * delete link), it's kept for deleting. Its path without the language, "/events/<id>".
 */
async function kept(p: import("playwright").Page): Promise<string> {
  await p.waitForURL(/\/events\/[0-9a-f-]{36}#key=/);
  const at = new URL(p.url());
  const path = at.pathname.replace(/^\/[^/]+/, "");
  posted.push({
    id: at.pathname.split("/").pop()!,
    key: new URLSearchParams(at.hash.slice(1)).get("key")!,
    path,
  });
  return path;
}

afterAll(async () => {
  for (const event of posted)
    expect(await deleteEvent(event), `deleting the test event ${event.id}`).toBe(true);
});

/** A random title, so each test's event is its own. */
const testTitle = () => `Test event ${crypto.randomUUID().slice(0, 8)}`;

/**
 * A new event, so a test that books has its own seats on any database (a fresh local one or the
 * live site's); deleted when the file ends. Returns its path without the language, "/events/<id>".
 */
async function ownEvent(seats: number): Promise<string> {
  const event = await postEvent(await page(), { title: testTitle(), local: TEST_START, seats });
  posted.push(event);
  return event.path;
}

/** That event's page in a language, ready to use. */
async function open(p: import("playwright").Page, locale: string, path: string) {
  await p.goto(`/${locale}${path}`);
  await started(p);
}
const at = (locale: string, timeZone: string) =>
  new Intl.DateTimeFormat(locale, { ...WHEN, timeZone }).format(new Date(SWIM));

test("th-TH, in New York: Sydney's clock, the reader's, and how far off, in Thai", async () => {
  const p = await page({ timezoneId: "America/New_York" });
  const errors = collectErrors(p);
  await p.clock.install({ time: new Date("2027-03-05T12:00:00Z") });
  await goToEvent(p, "th-TH", "Harbour sunrise swim");
  const swim = p.locator("article");
  await untilText(p, 'article [data-testid="event-yours"]', "has", at("th-TH", "America/New_York"));
  expect(await swim.getByTestId("event-local").textContent()).toBe(at("th-TH", "Australia/Sydney"));
  expect(await swim.getByTestId("event-when").textContent()).toBe("พรุ่งนี้");
  expect(errors).toEqual([]);
});

test('a page left open past midnight: "tomorrow" becomes "today" with no reload', async () => {
  const p = await page({ timezoneId: "Australia/Sydney" });
  const errors = collectErrors(p);
  // 23:59 on 6 March in Sydney; the swim starts at 6:00 on 7 March.
  await p.clock.install({ time: new Date("2027-03-06T12:59:00Z") });
  await goToEvent(p, "en-US", "Harbour sunrise swim");
  await untilText(p, 'article [data-testid="event-when"]', "is", "tomorrow");
  // useNow({ updateInterval: 60_000 }) reads the clock again each minute.
  await p.clock.runFor(120_000);
  await untilText(p, 'article [data-testid="event-when"]', "is", "today");
  expect(errors).toEqual([]);
});

test.skipIf(onLiveSite())(
  "an event named </script><script>…: its structured data holds the name, and runs nothing",
  async () => {
    const p = await page();
    const errors = collectErrors(p);
    const name = "</script><script>window.pwned = 1</script> & party";
    await p.goto(`/${SOURCE}/events/new`);
    await started(p);
    await p.getByTestId("event-title-input").fill(name);
    await p.getByTestId("event-description-input").fill("Posted by the tests.");
    await p.getByTestId("event-local-input").fill(TEST_START);
    await p.getByTestId("event-post").click();
    await kept(p);
    // The page as the server sends it, as a search engine reads it: Void updates titles and meta
    // tags when moving between pages in the browser, not scripts (its head guide), so this one
    // comes with a full load.
    await p.reload();
    await started(p);
    await seeText(p, "event-title", name);
    expect(await p.evaluate(() => (window as { pwned?: number }).pwned)).toBeUndefined();
    const data = JSON.parse(
      (await p.locator('script[type="application/ld+json"]').textContent()) ?? "{}",
    );
    expect(data).toMatchObject({ "@type": "Event", name });
    expect(errors).toEqual([]);
  },
);

test.skipIf(onLiveSite())(
  "ar-EG: post an event (a missing title first); it is saved neutral and reads the same in English",
  async () => {
    const p = await page({ timezoneId: "Africa/Cairo" });
    const errors = collectErrors(p);
    await p.goto("/ar-EG/events/new");
    // Void's form works once the page has hydrated.
    await started(p);
    await p.getByTestId("event-post").click();
    await seeText(p, "error-title", "أعطِها عنوانًا.");
    await p.getByTestId("event-title-input").fill("أمسية شعر");
    await p.getByTestId("event-description-input").fill("قراءات شعرية على السطح.");
    await p.getByTestId("event-local-input").fill(TEST_START);
    await p.getByTestId("event-post").click();
    await kept(p);
    expect(new URL(p.url()).pathname).toMatch(/^\/ar-EG\/events\//);
    await seeText(p, "event-title", "أمسية شعر");
    // Saved neutral: the time on Cairo's clock with its zone, the same moment in UTC, a plain number.
    const stored = () => p.getByTestId("event-stored").textContent();
    const saved = await stored();
    expect(saved).toBe(
      "starts_at2026-01-01T20:00:00+02:00[Africa/Cairo]" +
        "starts_at_utc2026-01-01T18:00:00Z" +
        "seats20" +
        "localear-EG",
    );
    // The same event in English: the page in English, the stored record unchanged.
    await p.goto(p.url().replace("/ar-EG/", "/en-US/").replace(/#.*/, ""));
    await untilText(p, '[data-testid="event-local"]', "has", "8:00 PM");
    expect(await stored()).toBe(saved);
    expect(errors).toEqual([]);
  },
);

test.skipIf(onLiveSite())(
  "the poster deletes their event with its private link; a wrong key is refused",
  async () => {
    const p = await page();
    const errors = collectErrors(p);
    await postEvent(p, {
      title: testTitle(),
      local: TEST_START,
      description: "Posted by the tests, to delete.",
    });
    const link = await p.getByTestId("delete-link").inputValue();
    expect(link).toBe(p.url());
    const path = new URL(link).pathname;
    // Someone without the link sees nothing of it; with a wrong key, deleting is refused.
    const other = await page();
    await other.goto(path);
    await started(other);
    expect(await other.getByTestId("your-event").count()).toBe(0);
    await other.goto(`${path}#key=wrong`);
    await started(other);
    await confirmDelete(other);
    await seeText(other, "delete-wrong", "This link's key isn't this event's.");
    // The poster, with the link: deleted, then the list, and the event's page is gone.
    await deleteInPage(p);
    expect(new URL(p.url()).pathname).toBe(`/${SOURCE}/events`);
    expect((await fetch(`${url("prod")}${path}`)).status).toBe(404);
    expect(errors).toEqual([]);
  },
);

test("an event written in Arabic, read in English: its translation, and the original", async () => {
  const p = await page();
  await goToEvent(p, "en-US", "An evening of Arabic calligraphy");
  expect(await p.getByTestId("event-title").getAttribute("lang")).toBe("en-US");
  await seeText(p, "event-translated", "Translated by machine from Arabic (Egypt)");
  expect(await p.getByTestId("event-original").getAttribute("lang")).toBe("ar-EG");
  expect(await p.getByTestId("event-original").textContent()).toContain("أمسية خط عربي");
});

test.skipIf(onLiveSite())(
  "book in Thai; an Arabic page open on the event sees the seat go, live",
  async () => {
    const event = await ownEvent(12);
    const thai = await page();
    const arabic = await page();
    const errors = [...collectErrors(thai), ...collectErrors(arabic)];
    await open(arabic, "ar-EG", event);
    await seeText(arabic, "seats-left", "تبقّى ١٢ مقعدًا");
    await open(thai, "th-TH", event);
    await book(thai, "Somchai", "somchai@example.com");
    await seeText(thai, "booked", "จองเรียบร้อยแล้ว แล้วเจอกันนะ!");
    await seeText(thai, "seats-left", "เหลือ 11 ที่นั่ง");
    // Arabic's "many" form, for 11.
    await seeText(arabic, "seats-left", "تبقّى ١١ مقعدًا");
    expect(errors).toEqual([]);
  },
);

test.skipIf(onLiveSite())(
  "two people book the last seat at once: one gets it, the other is told, in Arabic",
  async () => {
    const event = await ownEvent(1);
    const [a, b] = [await page(), await page()];
    for (const p of [a, b]) {
      await open(p, "ar-EG", event);
      await p.getByTestId("book-name").fill("Laila");
      await p.getByTestId("book-email").fill("laila@example.com");
    }
    await Promise.all([a.getByTestId("book").click(), b.getByTestId("book").click()]);
    const outcome = async (p: import("playwright").Page) => {
      await p.locator('[data-testid="booked"], [data-testid="sold-out-error"]').waitFor();
      return (await p.getByTestId("booked").count()) ? "booked" : "sold out";
    };
    expect([await outcome(a), await outcome(b)].sort()).toEqual(["booked", "sold out"]);
    for (const p of [a, b]) await seeText(p, "seats-left", "اكتمل الحجز");
  },
);
