// void-fbtee's Link: within a language, Void's normal client navigation; into another
// language, a fresh page load (Void's client navigation would keep the old language).
import { test, expect } from "@playwright/test";
import { collectErrors } from "./helpers";

test("same language stays client-side", async ({ page }) => {
  const errors = collectErrors(page);
  let loads = 0;
  page.on("load", () => loads++);
  await page.goto("/th-TH/stream");
  await page.waitForLoadState("networkidle");
  await page.getByTestId("to-time").click();
  await page.waitForURL("**/th-TH/time");
  await expect(page.getByTestId("booking")).toBeVisible();
  expect(loads).toBe(1);
  await expect(page.locator("html")).toHaveAttribute("lang", "th-TH");
  expect(errors).toEqual([]);
});

test("another language loads a fresh page in that language", async ({ page }) => {
  const errors = collectErrors(page);
  let loads = 0;
  page.on("load", () => loads++);
  await page.goto("/th-TH/stream");
  await page.waitForLoadState("networkidle");
  await page.getByTestId("to-de").click();
  await page.waitForURL("**/de-DE/stream");
  await expect(page.getByTestId("title")).toHaveText("Hallo Welt");
  expect(loads).toBe(2);
  await expect(page.locator("html")).toHaveAttribute("lang", "de-DE");
  expect(errors).toEqual([]);
});
