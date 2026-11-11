// Production build: translated text from the server, kept through hydration with no flash of
// another language (including text that arrives after the shell); void-fbtee's Link.
import { expect, test } from "vite-plus/test";
import { browser, collectErrors, seeText, text, VOID_DEFER_MESSAGE, watchTexts } from "./helpers";
import { LOCALES } from "./locales";

const page = browser("prod");

test("th-TH home: server text kept through hydration, and the defer() line", async () => {
  const p = await page();
  const errors = collectErrors(p);
  const seen = await watchTexts(p);
  await p.goto("/th-TH");
  await seeText(p, "deferred", "ภายหลัง: เหลืออีก 1 คืน");
  expect(await text(p, "title")).toBe("i18n สำหรับแอป Void");
  expect(await text(p, "plural")).toBe("คุณจองไว้ 3 คืน");
  // <fbt:list> inside a string, each language named in its own language, joined the Thai way.
  expect(await text(p, "intro")).toContain("ภาษาEnglish العربية และไทย");
  const texts = await seen();
  expect(texts.title).toEqual(["i18n สำหรับแอป Void"]);
  expect(await p.locator("html").getAttribute("lang")).toBe("th-TH");
  expect(errors.filter((e) => !VOID_DEFER_MESSAGE.test(e))).toEqual([]);
});

test("Link: same language stays client-side, another language loads a fresh page", async () => {
  const p = await page();
  const errors = collectErrors(p);
  let loads = 0;
  p.on("load", () => loads++);
  await p.goto("/th-TH");
  await p.waitForLoadState("networkidle");
  await p.getByTestId("nav-formats").click();
  await p.waitForURL("**/th-TH/formats");
  await seeText(p, "formats-title", "รูปแบบ");
  expect(loads).toBe(1);
  await p.getByTestId("to-ar-EG").click();
  await p.waitForURL("**/ar-EG/formats");
  await seeText(p, "formats-title", "التنسيقات");
  expect(loads).toBe(2);
  expect(await p.locator("html").getAttribute("dir")).toBe("rtl");
  expect(errors.filter((e) => !VOID_DEFER_MESSAGE.test(e))).toEqual([]);
});

test("every page fits a phone's width, in every language", async () => {
  // A phone, not a narrow desktop window: without the viewport meta tag a phone lays a page out
  // 980px wide and shrinks it, so everything looks tiny.
  const p = await page({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 3,
  });
  const wide: string[] = [];
  for (const locale of LOCALES)
    for (const path of ["", "/tour", "/events", "/formats", "/about", "/docs", "/docs/strings"]) {
      await p.goto(`/${locale}${path}`);
      const { layout, content } = await p.evaluate(() => ({
        layout: window.innerWidth,
        content: document.documentElement.scrollWidth,
      }));
      if (layout !== 390 || content > 390)
        wide.push(`/${locale}${path}: laid out ${layout}px, content ${content}px`);
    }
  expect(wide).toEqual([]);
});
