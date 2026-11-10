// Dev server: a smoke check (a translated page, an island hydrating), then what only dev does:
// catalog edits reach the server and the open page with no restart, and the browser console
// names each untranslated string. Catalog files are put back after each test.
import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import { browser, collectErrors, hydrated, seeText, url } from "./helpers";
import { EXAMPLE } from "./setup";

const page = browser("dev");
const catalog = (locale: string) => join(EXAMPLE, "i18n/translations", `${locale}.json`);
// The "Hello world" title string (desc "Page title of the i18n spike").
const TITLE = "kpz/9JXVX1WbALbJcnrUZg==";
const RELOAD = 20_000;

test("smoke: a translated page and an island", async () => {
  const p = await page();
  const errors = collectErrors(p);
  await p.goto("/de-DE/about");
  await hydrated(p, "_Signup");
  await seeText(p, "about-title", "Tisch in Sekunden buchen");
  expect(errors).toEqual([]);
});

test("editing a catalog updates the server and the open page", async () => {
  const file = catalog("th-TH");
  const original = readFileSync(file, "utf8");
  const p = await page();
  const errors = collectErrors(p);
  try {
    await p.goto("/th-TH/stream");
    // Edit once the page has loaded, as a person would: a file changed while the page is still
    // loading its modules gives a hydration mismatch in any SSR dev server.
    await p.waitForLoadState("networkidle");
    const json = JSON.parse(original);
    json.translations[TITLE].translations[0].translation = "สวัสดี (แก้แล้ว)";
    writeFileSync(file, JSON.stringify(json, null, 2) + "\n");
    await seeText(p, "title", "สวัสดี (แก้แล้ว)", RELOAD);
    expect(await (await fetch(url("dev") + "/th-TH/stream")).text()).toContain("สวัสดี (แก้แล้ว)");
  } finally {
    writeFileSync(file, original);
  }
  await seeText(p, "title", "สวัสดีชาวโลก", RELOAD);
  expect(errors).toEqual([]);
});

test("removing and putting back a locale's catalog", async () => {
  const file = catalog("pl-PL");
  const p = await page();
  const errors = collectErrors(p);
  await p.goto("/pl-PL/stream");
  await p.waitForLoadState("networkidle");
  renameSync(file, file + ".off");
  try {
    await seeText(p, "title", "Hello world", RELOAD);
    // Removing a catalog reloads the page; let that load finish before the next change.
    await p.waitForLoadState("networkidle");
  } finally {
    renameSync(file + ".off", file);
  }
  await seeText(p, "title", "Witaj, świecie", RELOAD);
  expect(errors).toEqual([]);
});

test("the browser console names each string a page shows untranslated", async () => {
  const file = catalog("th-TH");
  const original = readFileSync(file, "utf8");
  const p = await page();
  const warnings: string[] = [];
  p.on("console", (m) => m.type() === "warning" && warnings.push(m.text()));
  try {
    const json = JSON.parse(original);
    delete json.translations[TITLE];
    writeFileSync(file, JSON.stringify(json, null, 2) + "\n");
    await p.goto("/th-TH/stream");
    await seeText(p, "title", "Hello world", RELOAD);
    await expect
      .poll(() => warnings)
      .toContain('void-fbtee: no th-TH translation for "Hello world"');
  } finally {
    writeFileSync(file, original);
  }
  await seeText(p, "title", "สวัสดีชาวโลก", RELOAD);
});
