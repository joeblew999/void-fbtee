// Production build: the events app's own part. Each event's start on its city's clock and on the
// reader's, in the reader's language; an event posted in Arabic, then read in English. Void's
// forms, database and cache are Void's to test; this checks what void-fbtee and the app add.
import { expect, test } from "vite-plus/test";
import { browser, collectErrors, hydrated, seeText } from "./helpers";

const page = browser("prod");
const WHEN: Intl.DateTimeFormatOptions = {
  weekday: "long",
  day: "numeric",
  month: "long",
  hour: "numeric",
  minute: "2-digit",
  timeZoneName: "longGeneric",
};
const SWIM = "2027-03-06T19:00:00Z"; // Harbour sunrise swim: 6:00 on 7 March in Sydney
const at = (locale: string, timeZone: string) =>
  new Intl.DateTimeFormat(locale, { ...WHEN, timeZone }).format(new Date(SWIM));

test("th-TH, in New York: Sydney's clock, the reader's, and how far off, in Thai", async () => {
  const p = await page({ timezoneId: "America/New_York" });
  const errors = collectErrors(p);
  await p.clock.install({ time: new Date("2027-03-05T12:00:00Z") });
  await p.goto("/th-TH/events");
  const swim = p
    .getByTestId("events-list")
    .locator("li")
    .filter({ hasText: "Harbour sunrise swim" });
  await expect
    .poll(() => swim.getByTestId("event-yours").textContent())
    .toContain(at("th-TH", "America/New_York"));
  expect(await swim.getByTestId("event-local").textContent()).toBe(at("th-TH", "Australia/Sydney"));
  expect(await swim.getByTestId("event-when").textContent()).toBe("พรุ่งนี้");
  expect(errors).toEqual([]);
});

test("ar-EG: post an event (a missing title first), then read it in English", async () => {
  const p = await page({ timezoneId: "Africa/Cairo" });
  const errors = collectErrors(p);
  await p.goto("/ar-EG/events");
  // Void's form works once the page has hydrated.
  await p.waitForLoadState("networkidle");
  await p.getByTestId("event-post").click();
  await seeText(p, "error-title", "أعطِها عنوانًا.");
  await p.getByTestId("event-title-input").fill("أمسية شعر");
  await p.getByTestId("event-description-input").fill("قراءات شعرية على السطح.");
  await p.getByTestId("event-local-input").fill("2027-04-01T20:00");
  await p.getByTestId("event-post").click();
  await p.waitForURL(/\/ar-EG\/events\/[0-9a-f-]{36}$/);
  await seeText(p, "event-title", "أمسية شعر");
  await p.goto(p.url().replace("/ar-EG/", "/en-US/"));
  await seeText(p, "event-written-in", "Written in Arabic (Egypt)");
  expect(errors).toEqual([]);
});

test("the tour (Markdown): its event time is an island, formatted in each language and zone", async () => {
  const p = await page({ timezoneId: "America/New_York" });
  const errors = collectErrors(p);
  const MARKET = new Date("2027-03-06T11:30:00Z"); // the night market: 18:30 in Bangkok
  for (const locale of ["en-US", "th-TH", "ar-EG"]) {
    const at = (timeZone: string) =>
      new Intl.DateTimeFormat(locale, { ...WHEN, timeZone }).format(MARKET);
    await p.goto(`/${locale}/tour`);
    await hydrated(p, "EventTime");
    expect(await p.getByTestId("event-local").textContent(), locale).toBe(at("Asia/Bangkok"));
    await expect
      .poll(() => p.getByTestId("event-yours").textContent())
      .toContain(at("America/New_York"));
  }
  expect(errors).toEqual([]);
});

/** The page of the sample event with this title. */
async function eventPage(p: import("playwright").Page, locale: string, title: string) {
  await p.goto(`/${locale}/events`);
  await p.getByTestId("events-list").locator("a").filter({ hasText: title }).click();
  await p.waitForURL(/\/events\/[0-9a-f-]{36}$/);
  // Void's form works once the page has hydrated.
  await p.waitForLoadState("networkidle");
}

test("book in Thai; an Arabic page open on the event sees the seat go, live", async () => {
  const thai = await page();
  const arabic = await page();
  const errors = [...collectErrors(thai), ...collectErrors(arabic)];
  await eventPage(arabic, "ar-EG", "Harbour sunrise swim");
  await seeText(arabic, "seats-left", "تبقّى ١٢ مقعدًا");
  await eventPage(thai, "th-TH", "Harbour sunrise swim");
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
  const [a, b] = [await page(), await page()];
  for (const p of [a, b]) {
    await eventPage(p, "ar-EG", "Supper for one");
    await p.getByTestId("book-name").fill("Laila");
    await p.getByTestId("book-email").fill("laila@example.com");
  }
  await Promise.all([a.getByTestId("book").click(), b.getByTestId("book").click()]);
  const outcome = async (p: import("playwright").Page) => {
    await expect
      .poll(
        async () =>
          (await p.getByTestId("booked").count()) + (await p.getByTestId("sold-out-error").count()),
      )
      .toBe(1);
    return (await p.getByTestId("booked").count()) ? "booked" : "sold out";
  };
  expect([await outcome(a), await outcome(b)].sort()).toEqual(["booked", "sold out"]);
  for (const p of [a, b]) await seeText(p, "seats-left", "اكتمل الحجز");
});
