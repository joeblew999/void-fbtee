// Production build: island pages and markdown pages. Each island hydrates on its own, without
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

test("markdown post: the frontmatter island in the page's language", async () => {
  const p = await page();
  const errors = collectErrors(p);
  await p.goto("/th-TH/blog/hello");
  await hydrated(p);
  await p.getByTestId("post-like").click();
  await seeText(p, "post-like", "ถูกใจ (1)");
  expect(await text(p, "post-date")).toBe("1 พฤศจิกายน 2569");
  expect(await text(p, "post-minutes")).toBe("4 นาที");
  expect(errors).toEqual([]);
});

test("blog index lists only the page's language's posts", async () => {
  const p = await page();
  for (const locale of ["th-TH", "ar-EG"]) {
    await p.goto(`/${locale}/blog`);
    const links = p.getByTestId("blog-posts").locator("a");
    await links.first().waitFor();
    expect(await links.evaluateAll((as) => as.map((a) => a.getAttribute("href")))).toEqual([
      `/${locale}/blog/hello`,
    ]);
  }
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
  await p.getByTestId("signup-to-de").click();
  await p.waitForURL("**/de-DE/about");
  await seeText(p, "about-title", "Tisch in Sekunden buchen");
  expect(await p.locator("html").getAttribute("lang")).toBe("de-DE");
  expect(errors).toEqual([]);
});
