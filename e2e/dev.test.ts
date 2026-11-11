// Dev server: what only dev does:
// catalog edits reach the server and the open page with no restart, and the browser console
// names each untranslated string. Catalog files are put back after each test.
import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import { browser, collectErrors, seeText, url, VOID_DEFER_MESSAGE, started } from "./helpers";
import { EXAMPLE } from "./setup";

const page = browser("dev");
const catalog = (locale: string) => join(EXAMPLE, "i18n/translations", `${locale}.json`);
// The home page heading, "i18n for Void apps".
const TITLE = "GT3+qur89p160RfLJ/9CmQ==";

test("editing a catalog updates the server and the open page", async () => {
  const file = catalog("th-TH");
  const original = readFileSync(file, "utf8");
  const p = await page();
  const errors = collectErrors(p);
  try {
    await p.goto("/th-TH");
    // Edit once the page has loaded, as a person would: a file changed while the page is still
    // loading its modules gives a hydration mismatch in any SSR dev server.
    await started(p);
    const json = JSON.parse(original);
    json.translations[TITLE].translations[0].translation = "i18n (แก้แล้ว)";
    writeFileSync(file, JSON.stringify(json, null, 2) + "\n");
    await seeText(p, "title", "i18n (แก้แล้ว)");
    expect(await (await fetch(url("dev") + "/th-TH")).text()).toContain("i18n (แก้แล้ว)");
  } finally {
    writeFileSync(file, original);
  }
  await seeText(p, "title", "i18n สำหรับแอป Void");
  // The home page has a defer() line (plan #1, decision 8).
  expect(errors.filter((e) => !VOID_DEFER_MESSAGE.test(e))).toEqual([]);
});

test("removing and putting back a locale's catalog", async () => {
  const file = catalog("ar-EG");
  const p = await page();
  const errors = collectErrors(p);
  await p.goto("/ar-EG");
  await started(p);
  // Removing a catalog reloads the page; let that load finish before the next change.
  const reloaded = p.waitForEvent("load");
  renameSync(file, file + ".off");
  try {
    await reloaded;
    await seeText(p, "title", "i18n for Void apps");
    await started(p);
  } finally {
    renameSync(file + ".off", file);
  }
  await seeText(p, "title", "تدويل تطبيقات Void");
  // The home page has a defer() line (plan #1, decision 8).
  expect(errors.filter((e) => !VOID_DEFER_MESSAGE.test(e))).toEqual([]);
});

test("the browser console names each string a page shows untranslated", async () => {
  const file = catalog("th-TH");
  const original = readFileSync(file, "utf8");
  const p = await page();
  try {
    const json = JSON.parse(original);
    delete json.translations[TITLE];
    writeFileSync(file, JSON.stringify(json, null, 2) + "\n");
    const warned = p.waitForEvent(
      "console",
      (m) => m.text() === 'void-fbtee: no th-TH translation for "i18n for Void apps"',
    );
    await p.goto("/th-TH");
    await warned;
    await seeText(p, "title", "i18n for Void apps");
  } finally {
    writeFileSync(file, original);
  }
  await seeText(p, "title", "i18n สำหรับแอป Void");
});
