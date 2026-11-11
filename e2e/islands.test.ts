// Production build: island pages and markdown pages (the docs). Each island hydrates on its own, without
// the layout or Void's shared data, and must render in the page's language from its first render.
import { globSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import { fmt } from "../apps/example/lib/fmt";
import { browser, collectErrors, hydrated, seeText } from "./helpers";
import { EXAMPLE } from "./setup";

const page = browser("prod");

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

test("Markdown pages: every <Fmt> value, formatted in the page's language and the reader's zone", async () => {
  // The pages that use <Fmt>, found in the files Void builds them from: no list of pages here.
  const files = globSync("pages/*/**/*.md", { cwd: EXAMPLE }).filter((f) =>
    readFileSync(join(EXAMPLE, f), "utf8").includes("<Fmt "),
  );
  expect(files.length).toBeGreaterThan(0);
  const p = await page({ timezoneId: "America/New_York" });
  const now = "2027-03-05T12:00:00Z";
  await p.clock.install({ time: new Date(now) });
  for (const file of files) {
    const url = "/" + file.replace(/^pages\//, "").replace(/(\/index)?\.md$/, "");
    const locale = url.split("/")[1];
    await p.goto(url);
    await hydrated(p, "Fmt");
    const values = p.locator("[data-fmt]");
    for (let i = 0; i < (await values.count()); i++) {
      const props = JSON.parse((await values.nth(i).getAttribute("data-fmt"))!);
      const want = fmt(props, locale, "America/New_York", now);
      await expect
        .poll(() => values.nth(i).textContent(), { message: `${url} ${JSON.stringify(props)}` })
        .toBe(want);
    }
  }
});
