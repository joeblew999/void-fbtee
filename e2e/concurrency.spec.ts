// 60 requests at once, mixing three languages: each comes back entirely in its own language,
// including the text streamed after the shell (fbtee's per-request state, decision 1).
import { test, expect } from "@playwright/test";

const WANT = {
  "en-US": { title: "Hello world", streamed: "Streamed after the shell" },
  "th-TH": { title: "สวัสดีชาวโลก", streamed: "ส่งตามมาหลังเชลล์" },
  "de-DE": { title: "Hallo Welt", streamed: "Nach der Shell gestreamt" },
};

test("60 concurrent requests in 3 languages don't mix", async ({ request }) => {
  const locales = Object.keys(WANT) as (keyof typeof WANT)[];
  const results = await Promise.all(
    Array.from({ length: 60 }, async (_, i) => {
      const locale = locales[i % 3];
      const html = await (await request.get(`/${locale}/stream`)).text();
      const w = WANT[locale];
      return (
        html.includes(`<html lang="${locale}"`) &&
        html.includes(`data-testid="title">${w.title}<`) &&
        html.includes(`data-testid="streamed">${w.streamed}<`)
      );
    }),
  );
  expect(results.filter((ok) => !ok).length).toBe(0);
});
