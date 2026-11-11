// Production build: the reader's own zone, and neutral data going in. The Intl page's "in your time
// zone" is the browser's alone, after hydration; "Try it" reads a number typed the language's way
// back to a number in the browser, and only that number goes to the Worker.
import { expect, test } from "vite-plus/test";
import { browser, collectErrors, seeText, started, untilText } from "./helpers";

const page = browser("prod");

test("in your time zone: the browser's own zone, after hydration", async () => {
  const p = await page({ timezoneId: "America/New_York", locale: "en-US" });
  await p.goto("/en-US/docs/intl");
  await seeText(p, "your-time", "In your time zone: Saturday, July 4, 2026 at 11:30:45 AM EDT");
});

test("ar-EG: a number typed in Arabic digits, read back in the browser, formatted by the Worker", async () => {
  const p = await page();
  const errors = collectErrors(p);
  await p.goto("/ar-EG/docs/try-it");
  await started(p);
  await p.getByTestId("try-number").fill("٢٬٥٠٠٫٧٥");
  await p.getByTestId("try-server").click();
  const row = (name: string) => p.locator(`[data-try="${name}"]`);
  await untilText(p, '[data-try="value"] [data-side="worker"]', "is", "2500.75");
  for (const name of ["value", "default", "currency", "compact", "plural", "words"])
    expect(await row(name).locator('[data-side="worker"]').textContent(), name).toBe(
      await row(name).locator('[data-side="browser"]').textContent(),
    );
  expect(await row("default").locator('[data-side="worker"]').textContent()).toBe("٢٬٥٠٠٫٧٥");
  expect(errors).toEqual([]);
});
