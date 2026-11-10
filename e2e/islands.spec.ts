// Island pages and markdown pages: each island hydrates on its own, without the layout or
// Void's shared data, and must still render in the page's language from its first render.
import { test, expect } from "@playwright/test";
import { watchTexts, collectErrors } from "./helpers";

const ABOUT = {
  "en-US": {
    title: "Book a table in seconds",
    seats: ["4 seats left", "3 seats left"],
    take: "Take a seat",
    countdown: "Launch: in",
  },
  "th-TH": {
    title: "จองโต๊ะได้ในไม่กี่วินาที",
    seats: ["เหลือ 4 ที่นั่ง", "เหลือ 3 ที่นั่ง"],
    take: "จองที่นั่ง",
    countdown: "เปิดตัว: ในอีก",
  },
  "de-DE": {
    title: "Tisch in Sekunden buchen",
    seats: ["Noch 4 Plätze frei", "Noch 3 Plätze frei"],
    take: "Platz nehmen",
    countdown: "Start: in",
  },
};

for (const [locale, w] of Object.entries(ABOUT)) {
  test(`${locale} island page: islands hydrate in the page's language`, async ({ page }) => {
    const errors = collectErrors(page);
    const seen = await watchTexts(page);
    await page.goto(`/${locale}/about`);
    await expect(page.locator('[data-island$="_Signup"]')).toHaveAttribute("data-hydrated", "true");
    await page.getByTestId("countdown").scrollIntoViewIfNeeded();
    await expect(page.locator('[data-island$="_Countdown"]')).toHaveAttribute(
      "data-hydrated",
      "true",
    );
    await page.getByTestId("signup-take").click();
    await expect(page.getByTestId("signup-text")).toHaveText(w.seats[1]);
    await expect(page.getByTestId("about-title")).toHaveText(w.title);
    await expect(page.getByTestId("signup-take")).toHaveText(w.take);
    await expect(page.getByTestId("countdown")).toContainText(w.countdown);
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    const texts = await seen();
    expect(texts["about-title"]).toEqual([w.title]);
    expect(texts["signup-take"]).toEqual([w.take]);
    expect(texts["signup-text"]).toEqual(w.seats);
    expect(texts.countdown?.every((t) => t.startsWith(w.countdown))).toBe(true);
    expect(errors).toEqual([]);
  });
}

test("ar-EG island page is right-to-left with Arabic digits", async ({ page }) => {
  await page.goto("/ar-EG/about");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByTestId("signup-number")).toHaveText("٤٬٩٣٨");
});

const POSTS = {
  "en-US": { date: "November 1, 2026", minutes: "4 minutes", like: ["Like (0)", "Like (1)"] },
  "th-TH": { date: "1 พฤศจิกายน 2569", minutes: "4 นาที", like: ["ถูกใจ (0)", "ถูกใจ (1)"] },
  "de-DE": {
    date: "1. November 2026",
    minutes: "4 Minuten",
    like: ["Gefällt mir (0)", "Gefällt mir (1)"],
  },
};

for (const [locale, w] of Object.entries(POSTS)) {
  test(`${locale} markdown post: frontmatter island in the page's language`, async ({ page }) => {
    const errors = collectErrors(page);
    const seen = await watchTexts(page);
    await page.goto(`/${locale}/blog/hello`);
    await expect(page.locator("[data-island]")).toHaveAttribute("data-hydrated", "true");
    await page.getByTestId("post-like").click();
    await expect(page.getByTestId("post-like")).toHaveText(w.like[1]);
    await expect(page.getByTestId("post-date")).toHaveText(w.date);
    await expect(page.getByTestId("post-minutes")).toHaveText(w.minutes);
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    const texts = await seen();
    expect(texts["post-date"]).toEqual([w.date]);
    expect(texts["post-like"]).toEqual(w.like);
    expect(errors).toEqual([]);
  });

  test(`${locale} blog index lists only this language's posts`, async ({ page }) => {
    await page.goto(`/${locale}/blog`);
    const links = page.getByTestId("blog-posts").locator("a");
    await expect(links).toHaveCount(1);
    await expect(links).toHaveAttribute("href", `/${locale}/blog/hello`);
  });
}

test("useNow(): server's now while hydrating, the browser's clock after", async ({ page }) => {
  // A cached page carries an old "now". With the browser's clock on 20 December, the countdown
  // first matches the server HTML, then counts from the browser's day: 4 days to 24 December.
  const errors = collectErrors(page);
  await page.clock.install({ time: new Date("2026-12-20T12:00:00Z") });
  await page.goto("/en-US/about");
  await page.getByTestId("countdown").scrollIntoViewIfNeeded();
  await expect(page.locator('[data-island$="_Countdown"]')).toHaveAttribute(
    "data-hydrated",
    "true",
  );
  await expect(page.getByTestId("countdown")).toHaveText("Launch: in 4 days");
  expect(errors).toEqual([]);
});

test("void-fbtee's Link inside an island (no Void router there)", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/th-TH/about");
  await expect(page.locator('[data-island$="_Signup"]')).toHaveAttribute("data-hydrated", "true");
  await page.getByTestId("signup-to-blog").click();
  await page.waitForURL("**/th-TH/blog");
  await expect(page.getByTestId("blog-title")).toBeVisible();
  await page.goto("/th-TH/about");
  await expect(page.locator('[data-island$="_Signup"]')).toHaveAttribute("data-hydrated", "true");
  await page.getByTestId("signup-to-de").click();
  await page.waitForURL("**/de-DE/about");
  await expect(page.getByTestId("about-title")).toHaveText("Tisch in Sekunden buchen");
  await expect(page.locator("html")).toHaveAttribute("lang", "de-DE");
  expect(errors).toEqual([]);
});
