// Production build: translated text from the server, kept through hydration with no flash of
// another language (including text that arrives after the shell); void-fbtee's Link.
import { expect, test } from "vite-plus/test";
import {
  browser,
  collectErrors,
  seeText,
  text,
  VOID_DEFER_MESSAGE,
  watchTexts,
  started,
} from "./helpers";

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
  expect(await text(p, "intro")).toContain("ภาษา English العربية และไทย");
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
  await started(p);
  // The menu names the page it opens.
  expect(await p.getByTestId("nav-events").textContent()).toBe("กิจกรรม");
  await p.getByTestId("nav-events").click();
  await p.waitForURL("**/th-TH/events");
  await seeText(p, "events-title", "กิจกรรมที่กำลังจะมาถึง");
  expect(loads).toBe(1);
  await p.getByTestId("to-ar-EG").click();
  await p.waitForURL("**/ar-EG/events");
  await seeText(p, "events-title", "الفعاليات القادمة");
  expect(await p.getByTestId("nav-events").textContent()).toBe("الفعاليات");
  expect(loads).toBe(2);
  expect(await p.locator("html").getAttribute("dir")).toBe("rtl");
  expect(errors.filter((e) => !VOID_DEFER_MESSAGE.test(e))).toEqual([]);
});

// The Intl page's "in your time zone": the browser's own zone, filled in after hydration.
test("in your time zone: the browser's own zone, after hydration", async () => {
  const p = await page({ timezoneId: "America/New_York", locale: "en-US" });
  await p.goto("/en-US/docs/intl");
  await seeText(p, "your-time", "In your time zone: Saturday, July 4, 2026 at 11:30:45 AM EDT");
});
