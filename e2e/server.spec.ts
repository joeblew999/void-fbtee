// What the middleware does at the HTTP level: the language redirect at "/", its cache headers,
// <html lang dir>, hreflang alternates, the i18n <meta> for islands, and files and API routes.
import { test, expect } from "@playwright/test";

const LOCALES = ["en-US", "th-TH", "de-DE", "ar-EG", "pl-PL"];

for (const [accept, to] of [
  ["th,en;q=0.5", "/th-TH"],
  ["de-AT,de;q=0.9", "/de-DE"],
  ["fr-FR", "/en-US"],
]) {
  test(`"/" with Accept-Language ${accept} → ${to}`, async ({ request }) => {
    const res = await request.get("/", {
      headers: { "accept-language": accept },
      maxRedirects: 0,
    });
    expect(res.status()).toBe(302);
    expect(new URL(res.headers().location, "http://x").pathname).toBe(to);
    expect(res.headers()["cache-control"]).toBe("private, no-store");
    expect(res.headers().vary?.toLowerCase()).toContain("accept-language");
  });
}

test("page head: lang, dir, hreflang alternates, i18n meta", async ({ request, baseURL }) => {
  const html = await (await request.get("/ar-EG/stream")).text();
  expect(html).toContain('<html lang="ar-EG" dir="rtl"');
  for (const l of LOCALES) expect(html).toContain(`hreflang="${l}" href="${baseURL}/${l}/stream"`);
  const meta = html.match(/<meta name="void-fbtee" content="([^"]*)"/)?.[1];
  const i18n = JSON.parse(meta!.replaceAll("&quot;", '"'));
  expect(i18n).toMatchObject({ locale: "ar-EG", dir: "rtl" });
  expect(Number.isNaN(Date.parse(i18n.now))).toBe(false);
});

test("files and API routes are served", async ({ request }) => {
  expect((await request.get("/void.svg")).status()).toBe(200);
  expect((await request.get("/api/hello")).status()).toBe(200);
  expect((await request.get("/favicon.ico")).status()).toBeLessThan(500);
});
