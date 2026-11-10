// Production build: translated text from the server, kept through hydration with no flash of
// another language; Temporal text the same on server and browser; void-fbtee's Link.
import { expect, test } from "vite-plus/test";
import { browser, collectErrors, seeText, text, VOID_DEFER_MESSAGE, watchTexts } from "./helpers";

const page = browser("prod");

test("th-TH: server text kept through hydration, on the defer() page and the streamed one", async () => {
  const p = await page();
  const errors = collectErrors(p);
  const seen = await watchTexts(p);
  await p.goto("/th-TH");
  await seeText(p, "deferred", "ภายหลัง: เหลืออีก 1 คืน");
  expect(await text(p, "title")).toBe("สวัสดีชาวโลก");
  expect(await text(p, "plural")).toBe("คุณจองไว้ 3 คืน");
  await p.goto("/th-TH/stream");
  await seeText(p, "streamed", "ส่งตามมาหลังเชลล์");
  const texts = await seen();
  // Only the last page's texts are recorded; "…" is its own Suspense fallback.
  expect(texts.title).toEqual(["สวัสดีชาวโลก"]);
  expect(texts.streamed?.filter((t) => t !== "…")).toEqual(["ส่งตามมาหลังเชลล์"]);
  expect(await p.locator("html").getAttribute("lang")).toBe("th-TH");
  expect(errors.filter((e) => !VOID_DEFER_MESSAGE.test(e))).toEqual([]);
});

test("Temporal text: the browser shows what the server sent, with the polyfill (as Safari)", async () => {
  const p = await page();
  const errors = collectErrors(p);
  const html = await (await p.request.get("/th-TH/time")).text();
  const ids = ["booking", "birthday", "length", "relative"];
  const server = ids.map((id) => html.match(new RegExp(`data-testid="${id}">([^<]*)`))?.[1]);
  await p.addInitScript(() => delete (globalThis as { Temporal?: unknown }).Temporal);
  await p.goto("/th-TH/time");
  await p.waitForLoadState("networkidle");
  expect(await Promise.all(ids.map((id) => text(p, id)))).toEqual(server);
  expect(errors).toEqual([]);
});

test("Link: same language stays client-side, another language loads a fresh page", async () => {
  const p = await page();
  const errors = collectErrors(p);
  let loads = 0;
  p.on("load", () => loads++);
  await p.goto("/th-TH/stream");
  await p.waitForLoadState("networkidle");
  await p.getByTestId("to-time").click();
  await p.waitForURL("**/th-TH/time");
  expect(loads).toBe(1);
  await p.goto("/th-TH/stream");
  await p.waitForLoadState("networkidle");
  await p.getByTestId("to-de").click();
  await p.waitForURL("**/de-DE/stream");
  await seeText(p, "title", "Hallo Welt");
  expect(loads).toBe(3);
  expect(await p.locator("html").getAttribute("lang")).toBe("de-DE");
  expect(errors).toEqual([]);
});
