// Dev only: editing, adding and removing i18n/translations/<locale>.json updates the server
// and the open page, with no restart (plan #1, check 17). The files are put back afterwards.
import { test, expect } from "@playwright/test";
import { readFileSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { AppMetadata } from "./projects";
import { collectErrors } from "./helpers";

// The "Hello world" title string (desc "Page title of the i18n spike").
const TITLE = "kpz/9JXVX1WbALbJcnrUZg==";

const dir = () => join((test.info().project.metadata as AppMetadata).dir, "i18n/translations");
const entry = (translation: string) => ({
  description: "Page title of the i18n spike",
  status: "translated",
  tokens: [],
  translations: [{ translation, variations: {} }],
  types: [],
});

test.describe.configure({ mode: "serial" });

test("editing a catalog updates the server and the open page", async ({ page, request }) => {
  const file = join(dir(), "th-TH.json");
  const original = readFileSync(file, "utf8");
  const errors = collectErrors(page);
  try {
    await page.goto("/th-TH/stream");
    // Edit only once the page has loaded and hydrated, as a person would. (A file changed while
    // the page is still loading its modules gives a hydration mismatch in any SSR dev server.)
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("title")).toHaveText("สวัสดีชาวโลก");
    const json = JSON.parse(original);
    json.translations[TITLE] = entry("สวัสดี (แก้แล้ว)");
    writeFileSync(file, JSON.stringify(json, null, 2) + "\n");
    await expect(page.getByTestId("title")).toHaveText("สวัสดี (แก้แล้ว)", { timeout: 20_000 });
    expect(await (await request.get("/th-TH/stream")).text()).toContain("สวัสดี (แก้แล้ว)");
    expect(errors, "after the edit").toEqual([]);
  } finally {
    writeFileSync(file, original);
  }
  await expect(page.getByTestId("title")).toHaveText("สวัสดีชาวโลก", { timeout: 20_000 });
  await page.waitForTimeout(1000);
  expect(errors, "after putting it back").toEqual([]);
});

test("adding and removing a locale's catalog", async ({ page }) => {
  const file = join(dir(), "pl-PL.json");
  expect(existsSync(file)).toBe(false);
  const errors = collectErrors(page);
  try {
    await page.goto("/pl-PL/stream");
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("title")).toHaveText("Hello world");
    writeFileSync(
      file,
      JSON.stringify({ "fb-locale": "pl-PL", translations: { [TITLE]: entry("Witaj świecie") } }),
    );
    await expect(page.getByTestId("title")).toHaveText("Witaj świecie", { timeout: 20_000 });
    // Adding a catalog reloads the page; let that load finish before the next change.
    await page.waitForLoadState("networkidle");
    expect(errors, "after adding").toEqual([]);
  } finally {
    rmSync(file, { force: true });
  }
  await expect(page.getByTestId("title")).toHaveText("Hello world", { timeout: 20_000 });
  await page.waitForTimeout(1000);
  expect(errors, "after removing").toEqual([]);
});
