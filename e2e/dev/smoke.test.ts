// Dev server: the short dev-mode check Void runs beside its full production suite (voidzero-dev/void
// TESTING.md): a page loads and hydrates, every island on a Markdown page hydrates, and a link
// navigates on the client, with the page's language kept. The full browser contract runs on the
// production build (e2e/preview/).
import { globSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, inject, test } from "vite-plus/test";
import { browser, hydrated, seeText, started } from "../helpers";
import { EXAMPLE } from "../preview/setup";

const page = browser("prod");
const skip = inject("devSkip" as never) as string;

test.skipIf(!!skip)(
  "a page loads and hydrates in its language, and a link navigates on the client",
  async () => {
    const p = await page();
    let loads = 0;
    p.on("load", () => loads++);
    await p.goto("/th-TH");
    await started(p);
    expect(await p.locator("html").getAttribute("lang")).toBe("th-TH");
    await p.getByTestId("nav-events").click();
    await p.waitForURL("**/th-TH/events");
    await seeText(p, "events-title", "กิจกรรมที่กำลังจะมาถึง");
    expect(loads).toBe(1);
  },
);

test.skipIf(!!skip)("every island on a Markdown page hydrates", async () => {
  const [file] = globSync("pages/th-TH/**/*.md", { cwd: EXAMPLE }).filter((f) =>
    readFileSync(join(EXAMPLE, f), "utf8").includes("<Fmt "),
  );
  const p = await page();
  await p.goto("/" + file!.replace(/^pages\//, "").replace(/(\/index)?\.md$/, ""));
  const islands = readFileSync(join(EXAMPLE, file!), "utf8").match(/<Fmt /g)!.length;
  await hydrated(p, "Fmt", islands);
});
