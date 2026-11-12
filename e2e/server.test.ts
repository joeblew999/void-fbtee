// Production build, over HTTP: what the middleware does ("/" to the source language, <html lang
// dir>, hreflang with x-default, the i18n <meta> for islands, leaving files and API routes alone),
// per-request state under concurrency, and the built worker.
import { globSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import { url } from "./helpers";
import { EXAMPLE } from "./setup";
import { LOCALES, SOURCE } from "./locales";

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
  const html = await (await get("/ar-EG/docs/intl")).text();
  // The <html> attributes, in any order (Void's own, class and data-theme, come first).
  const htmlTag = html.match(/<html\b[^>]*>/)?.[0] ?? "";
  expect(htmlTag).toContain('lang="ar-EG"');
  expect(htmlTag).toContain('dir="rtl"');
  for (const l of LOCALES)
    expect(html).toContain(`hreflang="${l}" href="${url("prod")}/${l}/docs/intl"`);
  expect(html).toContain(`hreflang="x-default" href="${url("prod")}/en-US/docs/intl"`);
  const meta = html.match(/<meta name="void-fbtee" content="([^"]*)"/)?.[1];
  const i18n = JSON.parse(meta!.replaceAll("&quot;", '"'));
  expect(i18n).toMatchObject({ locale: "ar-EG", dir: "rtl" });
  expect(Number.isNaN(Date.parse(i18n.now))).toBe(false);
});

test("the server never shows a stand-in for the reader's own time: those lines come empty", async () => {
  // Only the browser knows the reader's zone (useTimeZone), so the server leaves "your time",
  // "in N days" and "in your time zone" empty, their space kept, for the browser to fill once.
  const empty = (html: string, id: string) =>
    [...html.matchAll(new RegExp(`data-testid="${id}"[^>]*>(.*?)</`, "g"))].map((m) => m[1]);
  // The same in every language, so the source language is enough.
  for (const l of [SOURCE]) {
    const events = await (await get(`/${l}/events`)).text();
    const lines = [...empty(events, "event-yours"), ...empty(events, "event-when")];
    expect(lines.length, l).toBeGreaterThan(0);
    expect(
      lines.filter((t) => t !== ""),
      l,
    ).toEqual([]);
    const intl = await (await get(`/${l}/docs/intl`)).text();
    expect(empty(intl, "your-time"), l).toEqual([""]);
  }
});

test("every page has a title and a description, in its own language", async () => {
  const pages = ["", "/events", "/docs", "/docs/intl", "/docs/temporal", "/docs/setup"];
  pages.push("/docs/strings", "/docs/markdown-pages", "/docs/tour");
  const head = async (path: string) => {
    const html = await (await get(path)).text();
    return {
      title: html.match(/<title>([^<]*)<\/title>/)?.[1] ?? "",
      description: html.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? "",
    };
  };
  for (const page of pages) {
    const source = await head(`/${SOURCE}${page}`);
    for (const l of LOCALES) {
      const got = l === SOURCE ? source : await head(`/${l}${page}`);
      expect(got.title, `${l}${page}`).toMatch(/. · void-fbtee$/);
      expect(got.description, `${l}${page}`).not.toBe("");
      if (l !== SOURCE) expect(got.description, `${l}${page}`).not.toBe(source.description);
    }
  }
});

// Typed routes can't catch a wrong link here: with pages under [lang], Void's route types include
// `/${string}`, which TypeScript matches to any path. So every link on the main pages is fetched.
test("every link on the main pages leads to a page", async () => {
  const broken: string[] = [];
  for (const l of LOCALES)
    for (const start of [`/${l}`, `/${l}/docs`, `/${l}/events`]) {
      const html = await (await get(start)).text();
      const links = new Set(
        [...html.matchAll(/href="(\/[^"#]*)/g)]
          .map((m) => m[1]!)
          .filter((h) => !h.startsWith("//") && !/\.[a-z0-9]+$/i.test(h)),
      );
      for (const link of links) {
        const res = await get(link, { redirect: "manual" });
        if (res.status !== 200) broken.push(`${start} → ${link}: ${res.status}`);
      }
    }
  expect(broken).toEqual([]);
});

test("the middleware leaves files and API routes alone", async () => {
  expect((await get("/void.svg")).status).toBe(200);
  expect((await get("/api/hello")).status).toBe(200);
});

// It reads the build on disk, which the tests make only when they run the site themselves: against a
// deployed site (E2E_URL: test:deployed, test:production) there is no build of this commit here.
test.skipIf(!!process.env.E2E_URL)(
  "built worker: one fbtee core, Cloudflare's own Temporal (no polyfill but the Temporal page's), temporal flag on",
  () => {
    const read = (f: string) => readFileSync(f, "utf8");
    const worker = globSync(join(EXAMPLE, "dist/ssr/**/*.js"));
    expect(worker.length).toBeGreaterThan(0);
    // One copy of fbtee's per-request state: the Vite plugin keeps fbtee out of the server's
    // pre-bundling, so `fbtee` and `fbtee/server` share one core (packages/void-fbtee/src/vite.ts).
    expect(worker.filter((f) => read(f).includes("runWithFbtee"))).toHaveLength(1);
    // The app's code gets Cloudflare's own Temporal (void-fbtee's Vite plugin, vite.ts): the
    // polyfill's code is in the worker only for the Temporal reference page, which runs it beside
    // Cloudflare's to compare. So every file that imports the polyfill is the page's rows
    // (src/lib/temporal.ts) or imports them.
    expect(
      worker.filter((f) => read(f).includes("void-fbtee: no Temporal on the server")),
    ).toHaveLength(1);
    const name = (f: string) => f.split("/").pop()!;
    const polyfill = worker.filter((f) => read(f).includes("Mismatching Calendars")).map(name);
    expect(polyfill.length).toBeGreaterThan(0);
    const rows = worker
      .filter((f) =>
        read(f).includes('Temporal.Instant.from("2026-12-24T12:30:00Z").epochMilliseconds'),
      )
      .map(name);
    const importers = worker.filter(
      (f) => !polyfill.includes(name(f)) && polyfill.some((p) => read(f).includes(p)),
    );
    expect(
      importers.filter((f) => !rows.includes(name(f)) && !rows.some((r) => read(f).includes(r))),
    ).toEqual([]);
    // Cloudflare's temporal flag reaches the Worker config `void deploy` uploads (init adds it, check requires it).
    const config = JSON.parse(
      read(join(EXAMPLE, ".cloudflare/output/v0/workers/default/worker.config.json")),
    );
    expect(config.compatibilityFlags).toContain("temporal");
  },
);
