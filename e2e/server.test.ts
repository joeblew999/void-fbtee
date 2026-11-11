// Production build, over HTTP: what the middleware does ("/" to the source language, <html lang
// dir>, hreflang with x-default, the i18n <meta> for islands, leaving files and API routes alone),
// per-request state under concurrency, and the built worker.
import { globSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import { url } from "./helpers";
import { EXAMPLE } from "./setup";
import { LOCALES } from "./locales";

const get = (path: string, init?: RequestInit) => fetch(url("prod") + path, init);

test('"/" always redirects to the source language, whatever the browser asks for', async () => {
  for (const accept of ["th,en;q=0.5", "ar-EG", ""]) {
    const res = await get("/", { headers: { "accept-language": accept }, redirect: "manual" });
    expect(res.status, accept).toBe(301);
    expect(new URL(res.headers.get("location")!, "http://x").pathname, accept).toBe("/en-US");
    expect(res.headers.get("vary") ?? "").not.toMatch(/accept-language/i);
  }
});

test("page head: lang, dir, hreflang alternates with x-default, i18n meta", async () => {
  const html = await (await get("/ar-EG/docs/formats")).text();
  // The <html> attributes, in any order (Void's own, class and data-theme, come first).
  const htmlTag = html.match(/<html\b[^>]*>/)?.[0] ?? "";
  expect(htmlTag).toContain('lang="ar-EG"');
  expect(htmlTag).toContain('dir="rtl"');
  for (const l of LOCALES)
    expect(html).toContain(`hreflang="${l}" href="${url("prod")}/${l}/docs/formats"`);
  expect(html).toContain(`hreflang="x-default" href="${url("prod")}/en-US/docs/formats"`);
  const meta = html.match(/<meta name="void-fbtee" content="([^"]*)"/)?.[1];
  const i18n = JSON.parse(meta!.replaceAll("&quot;", '"'));
  expect(i18n).toMatchObject({ locale: "ar-EG", dir: "rtl" });
  expect(Number.isNaN(Date.parse(i18n.now))).toBe(false);
});

test("the middleware leaves files and API routes alone", async () => {
  expect((await get("/void.svg")).status).toBe(200);
  expect((await get("/api/hello")).status).toBe(200);
});

test("built worker: one fbtee core, no native Temporal in app code, temporal flag on", () => {
  const read = (f: string) => readFileSync(f, "utf8");
  const worker = globSync(join(EXAMPLE, "dist/ssr/**/*.js"));
  expect(worker.length).toBeGreaterThan(0);
  // One copy of fbtee's per-request state (plan #1, decision 2).
  expect(worker.filter((f) => read(f).includes("runWithFbtee"))).toHaveLength(1);
  // App code uses the polyfill on the server (decision 17), never the native global.
  expect(worker.filter((f) => /globalThis\.Temporal\b/.test(read(f)))).toEqual([]);
  // Cloudflare's temporal flag reaches the Worker config `void deploy` uploads (decision 15).
  const config = JSON.parse(
    read(join(EXAMPLE, ".cloudflare/output/v0/workers/default/worker.config.json")),
  );
  expect(config.compatibilityFlags).toContain("temporal");
});
