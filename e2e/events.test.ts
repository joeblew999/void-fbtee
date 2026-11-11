// Production build: the events app's own part. Each event's start on its city's clock and on the
// reader's, in the reader's language; an event posted in Arabic, then read in English. Void's
// forms, database and cache are Void's to test; this checks what void-fbtee and the app add.
import { expect, test } from "vite-plus/test";
import { browser, collectErrors, seeText, started, untilText } from "./helpers";
import { SOURCE } from "./locales";

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
 * Post a new event through the app's form, so a test that books has its own seats on any database
 * (a fresh local one or the live site's). Returns its path without the language, "/events/<id>".
 */
async function postEvent(seats: number): Promise<string> {
  const p = await page();
  await p.goto(`/${SOURCE}/events`);
  await started(p);
  await p.getByTestId("event-title-input").fill(`Test event ${crypto.randomUUID().slice(0, 8)}`);
  await p.getByTestId("event-description-input").fill("Posted by the tests.");
  await p.getByTestId("event-local-input").fill(TEST_START);
  await p.getByTestId("event-seats-input").fill(String(seats));
  await p.getByTestId("event-post").click();
  await p.waitForURL(/\/events\/[0-9a-f-]{36}$/);
  return new URL(p.url()).pathname.replace(`/${SOURCE}`, "");
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

test("ar-EG: post an event (a missing title first); it is saved neutral and reads the same in English", async () => {
  const p = await page({ timezoneId: "Africa/Cairo" });
  const errors = collectErrors(p);
  await p.goto("/ar-EG/events");
  // Void's form works once the page has hydrated.
  await started(p);
  await p.getByTestId("event-post").click();
  await seeText(p, "error-title", "أعطِها عنوانًا.");
  await p.getByTestId("event-title-input").fill("أمسية شعر");
  await p.getByTestId("event-description-input").fill("قراءات شعرية على السطح.");
  await p.getByTestId("event-local-input").fill(TEST_START);
  await p.getByTestId("event-post").click();
  await p.waitForURL(/\/ar-EG\/events\/[0-9a-f-]{36}$/);
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
  await p.goto(p.url().replace("/ar-EG/", "/en-US/"));
  await untilText(p, '[data-testid="event-local"]', "has", "8:00 PM");
  expect(await stored()).toBe(saved);
  expect(errors).toEqual([]);
});

test("an event written in Arabic, read in English: its translation, and the original", async () => {
  const p = await page();
  await goToEvent(p, "en-US", "An evening of Arabic calligraphy");
  expect(await p.getByTestId("event-title").getAttribute("lang")).toBe("en-US");
  await seeText(p, "event-translated", "Translated by machine from Arabic (Egypt)");
  expect(await p.getByTestId("event-original").getAttribute("lang")).toBe("ar-EG");
  expect(await p.getByTestId("event-original").textContent()).toContain("أمسية خط عربي");
});

test("book in Thai; an Arabic page open on the event sees the seat go, live", async () => {
  const event = await postEvent(12);
  const thai = await page();
  const arabic = await page();
  const errors = [...collectErrors(thai), ...collectErrors(arabic)];
  await open(arabic, "ar-EG", event);
  await seeText(arabic, "seats-left", "تبقّى ١٢ مقعدًا");
  await open(thai, "th-TH", event);
  await thai.getByTestId("book-name").fill("Somchai");
  await thai.getByTestId("book-email").fill("somchai@example.com");
  await thai.getByTestId("book").click();
  await seeText(thai, "booked", "จองเรียบร้อยแล้ว แล้วเจอกันนะ!");
  await seeText(thai, "seats-left", "เหลือ 11 ที่นั่ง");
  // Arabic's "many" form, for 11.
  await seeText(arabic, "seats-left", "تبقّى ١١ مقعدًا");
  expect(errors).toEqual([]);
});

test("two people book the last seat at once: one gets it, the other is told, in Arabic", async () => {
  const event = await postEvent(1);
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
});
