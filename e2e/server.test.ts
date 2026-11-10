// Production build, over HTTP: what the middleware does (the language redirect, <html lang dir>,
// hreflang, the i18n <meta> for islands, leaving files and API routes alone), per-request state
// under concurrency, and the built worker.
import { globSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import { url } from "./helpers";
import { EXAMPLE } from "./setup";

const get = (path: string, init?: RequestInit) => fetch(url("prod") + path, init);

test('"/" redirects by Accept-Language, uncached', async () => {
  for (const [accept, to] of [
    ["th,en;q=0.5", "/th-TH"],
    ["de-AT,de;q=0.9", "/de-DE"],
    ["fr-FR", "/en-US"],
  ]) {
    const res = await get("/", { headers: { "accept-language": accept }, redirect: "manual" });
    expect(res.status, accept).toBe(302);
    expect(new URL(res.headers.get("location")!, "http://x").pathname, accept).toBe(to);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(res.headers.get("vary")?.toLowerCase()).toContain("accept-language");
  }
});

test("page head: lang, dir, hreflang alternates, i18n meta", async () => {
  const html = await (await get("/ar-EG/stream")).text();
  expect(html).toContain('<html lang="ar-EG" dir="rtl"');
  for (const l of ["en-US", "th-TH", "de-DE", "ar-EG", "pl-PL"])
    expect(html).toContain(`hreflang="${l}" href="${url("prod")}/${l}/stream"`);
  const meta = html.match(/<meta name="void-fbtee" content="([^"]*)"/)?.[1];
  const i18n = JSON.parse(meta!.replaceAll("&quot;", '"'));
  expect(i18n).toMatchObject({ locale: "ar-EG", dir: "rtl" });
  expect(Number.isNaN(Date.parse(i18n.now))).toBe(false);
});

test("the middleware leaves files and API routes alone", async () => {
  expect((await get("/void.svg")).status).toBe(200);
  expect((await get("/api/hello")).status).toBe(200);
});

test("60 concurrent requests in 3 languages don't mix", async () => {
  const want = {
    "en-US": ["Hello world", "Streamed after the shell"],
    "th-TH": ["สวัสดีชาวโลก", "ส่งตามมาหลังเชลล์"],
    "de-DE": ["Hallo Welt", "Nach der Shell gestreamt"],
  };
  const locales = Object.keys(want) as (keyof typeof want)[];
  const results = await Promise.all(
    Array.from({ length: 60 }, async (_, i) => {
      const locale = locales[i % 3]!;
      const html = await (await get(`/${locale}/stream`)).text();
      const [title, streamed] = want[locale];
      return (
        html.includes(`<html lang="${locale}"`) &&
        html.includes(`data-testid="title">${title}<`) &&
        html.includes(`data-testid="streamed">${streamed}<`)
      );
    }),
  );
  expect(results.filter((ok) => !ok)).toHaveLength(0);
});

test("built worker: one fbtee core, no native Temporal in app code, temporal flag on", () => {
  const read = (f: string) => readFileSync(f, "utf8");
  const worker = globSync(join(EXAMPLE, "dist/ssr/**/*.js"));
  expect(worker.length).toBeGreaterThan(0);
  // One copy of fbtee's per-request state (plan #1, decision 2).
  expect(worker.filter((f) => read(f).includes("runWithFbtee"))).toHaveLength(1);
  // App code uses the polyfill on the server (decision 16); only the example's comparison route
  // reads the native global, on purpose.
  const nativeReads = worker.filter((f) => /globalThis\.Temporal\b/.test(read(f)));
  expect(nativeReads.every((f) => f.includes("temporal-native"))).toBe(true);
  // Cloudflare's temporal flag reaches the Worker config `void deploy` uploads (decision 15).
  const config = JSON.parse(
    read(join(EXAMPLE, ".cloudflare/output/v0/workers/default/worker.config.json")),
  );
  expect(config.compatibilityFlags).toContain("temporal");
});
