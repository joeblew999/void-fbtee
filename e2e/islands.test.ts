// Production build: islands in Markdown pages. Each island hydrates on its own, without the layout
// or Void's shared data, and must render in the page's language from its first render.
import { globSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import { fmt } from "../apps/example/src/docs/fmt";
import { browser, hydrated, untilText } from "./helpers";
import { EXAMPLE } from "./setup";

const page = browser("prod");

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
      // A <Fmt> that renders nothing is a mistake in the page, not a match.
      expect(want, `${url} ${JSON.stringify(props)}`).not.toBe("");
      await untilText(p, "[data-fmt]", "is", want, i);
    }
  }
});
