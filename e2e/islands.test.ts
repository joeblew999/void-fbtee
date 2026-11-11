// Production build: island pages and markdown pages (the docs). Each island hydrates on its own, without
// the layout or Void's shared data, and must render in the page's language from its first render.
import { expect, test } from "vite-plus/test";
import { browser, collectErrors, hydrated, seeText, text, watchTexts } from "./helpers";

const page = browser("prod");

test("th-TH island page: islands hydrate in the page's language", async () => {
  const p = await page();
  const errors = collectErrors(p);
  const seen = await watchTexts(p);
  await p.goto("/th-TH/about");
  await hydrated(p, "_Signup");
  await p.getByTestId("countdown").scrollIntoViewIfNeeded();
  await hydrated(p, "_Countdown");
  await p.getByTestId("signup-take").click();
  await seeText(p, "signup-text", "เหลือ 3 ที่นั่ง");
  expect(await text(p, "about-title")).toBe("จองโต๊ะได้ในไม่กี่วินาที");
  expect(await text(p, "countdown")).toMatch(/^เปิดตัว: ในอีก/);
  const texts = await seen();
  expect(texts["about-title"]).toEqual(["จองโต๊ะได้ในไม่กี่วินาที"]);
  expect(texts["signup-text"]).toEqual(["เหลือ 4 ที่นั่ง", "เหลือ 3 ที่นั่ง"]);
  expect(errors).toEqual([]);
});

test("ar-EG: right-to-left, Arabic digits and Arabic text in islands", async () => {
  const p = await page();
  const errors = collectErrors(p);
  await p.goto("/ar-EG/about");
  await hydrated(p, "_Signup");
  expect(await p.locator("html").getAttribute("dir")).toBe("rtl");
  expect(await text(p, "signup-number")).toBe("٤٬٩٣٨");
  expect(await text(p, "signup-take")).toBe("احجز مقعدًا");
  expect(errors).toEqual([]);
});

test("docs: markdown pages, one set per language", async () => {
  const p = await page();
  const sidebar = async (locale: string) => {
    await p.goto(`/${locale}/docs`);
    const links = p.getByTestId("docs-pages").locator("a");
    await links.first().waitFor();
    return links.evaluateAll((as) => as.map((a) => a.getAttribute("href")!));
  };
  // Each language's sidebar lists its own pages, and the same pages in every language.
  const english = (await sidebar("en-US")).map((h) => h.replace("/en-US/", "/"));
  for (const locale of ["th-TH", "ar-EG"])
    expect((await sidebar(locale)).map((h) => h.replace(`/${locale}/`, "/"))).toEqual(english);
  await p.goto("/th-TH/docs/strings");
  expect(await p.locator("h1").textContent()).toContain("การแปลข้อความในแอป Void");
  await p.goto("/en-US/docs/strings");
  expect(await p.locator("h1").textContent()).toContain("Translating strings in a Void app");
});

test("shadcn's menu in an island opens the language's way: from the right in Arabic", async () => {
  const p = await page();
  const errors = collectErrors(p);
  const edges = async (locale: string) => {
    await p.goto(`/${locale}/about`);
    await hydrated(p, "_Signup");
    await p.getByTestId("signup-menu").click();
    const menu = p.getByTestId("signup-menu-content");
    await menu.waitFor();
    const t = (await p.getByTestId("signup-menu").boundingBox())!;
    const m = (await menu.boundingBox())!;
    const dir = await menu.getAttribute("dir");
    await p.keyboard.press("Escape");
    return { start: Math.round(m.x - t.x), end: Math.round(m.x + m.width - (t.x + t.width)), dir };
  };
  // The menu starts where the trigger starts: its left edge in English, its right edge in Arabic.
  expect((await edges("en-US")).start).toBe(0);
  const ar = await edges("ar-EG");
  expect(ar.end).toBe(0);
  expect(ar.dir).toBe("rtl");
  // Choosing from the menu works in the island, with Arabic digits.
  await p.getByTestId("signup-menu").click();
  await p.getByTestId("signup-seats-2").click();
  await seeText(p, "signup-text", "تبقّى مقعدان");
  expect(errors).toEqual([]);
});

test("useNow(): the server's now while hydrating, the browser's clock after", async () => {
  // A cached page carries an old "now". With the browser's clock on 20 December, the countdown
  // first matches the server HTML, then counts from the browser's day: 4 days to 24 December.
  const p = await page();
  const errors = collectErrors(p);
  await p.clock.install({ time: new Date("2026-12-20T12:00:00Z") });
  await p.goto("/en-US/about");
  await p.getByTestId("countdown").scrollIntoViewIfNeeded();
  await hydrated(p, "_Countdown");
  await seeText(p, "countdown", "Launch: in 4 days");
  expect(errors).toEqual([]);
});

test("void-fbtee's Link inside an island (no Void router there)", async () => {
  const p = await page();
  const errors = collectErrors(p);
  await p.goto("/th-TH/about");
  await hydrated(p, "_Signup");
  await p.getByTestId("signup-to-ar").click();
  await p.waitForURL("**/ar-EG/about");
  await seeText(p, "about-title", "احجز طاولة في ثوانٍ");
  expect(await p.locator("html").getAttribute("lang")).toBe("ar-EG");
  expect(errors).toEqual([]);
});
