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

test("page head: lang, dir, hreflang alternates with x-default, canonical, og:locale, i18n meta", async () => {
  const html = await (await get("/ar-EG/docs/intl")).text();
  // The <html> attributes, in any order (Void's own, class and data-theme, come first).
  const htmlTag = html.match(/<html\b[^>]*>/)?.[0] ?? "";
  expect(htmlTag).toContain('lang="ar-EG"');
  expect(htmlTag).toContain('dir="rtl"');
  for (const l of LOCALES)
    expect(html).toContain(`hreflang="${l}" href="${url("prod")}/${l}/docs/intl"`);
  expect(html).toContain(`hreflang="x-default" href="${url("prod")}/en-US/docs/intl"`);
  // Its own address as canonical, and Open Graph's locale as language_TERRITORY (no
  // og:locale:alternate: Void keeps one meta tag per property, src/middleware.ts says more).
  expect(html).toContain(`rel="canonical" href="${url("prod")}/ar-EG/docs/intl"`);
  expect(html.match(/<link rel="canonical"/g)).toHaveLength(1);
  expect(html).toContain('property="og:locale" content="ar_EG"');
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

test("a page under a language the app doesn't have is not found", async () => {
  for (const path of ["/xx-XX", "/xx-XX/events", "/xx-XX/docs/intl", "/no-such-page"])
    expect((await get(path, { redirect: "manual" })).status, path).toBe(404);
});

test("booking an event that doesn't exist is not found, not sold out", async () => {
  const res = await get(`/${SOURCE}/events/${crypto.randomUUID()}`, {
    method: "POST",
    redirect: "manual",
    // A page action from the page itself (Void refuses cross-origin ones).
    headers: { origin: url("prod"), "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ name: "A", email: "a@example.com", time_zone: "Asia/Bangkok" }),
  });
  expect(res.status).toBe(404);
});

// The tour uses every feature @void/md has (packages/md/src/compile.ts in Void 1.8.0), so each is
// seen working in every language. Each box's title is written in the page's language: @void/md
// marks a box left with its English default title ("TIP", "WARNING") custom-block-title-default.
// Not here: task lists (the theme styles them, the compiler doesn't make them; reported as
// voidzero-dev/void#802) and snippet imports (removed from @void/md).
test("the tour: every @void/md feature, in every language, every title in that language", async () => {
  const features = {
    "containers: tip, info, warning, danger, details": [
      'class="tip custom-block"',
      'class="info custom-block"',
      'class="warning custom-block"',
      'class="danger custom-block"',
      'class="details custom-block"',
    ],
    "alerts: note, tip, important, warning, caution": [
      "note custom-block github-alert",
      "tip custom-block github-alert",
      "important custom-block github-alert",
      "warning custom-block github-alert",
      "caution custom-block github-alert",
    ],
    "code: highlighted, line numbers, marked lines": [
      'class="shiki',
      "line-numbers",
      "highlighted",
    ],
    "code: diff, focus, error, warning": [
      "diff add",
      "diff remove",
      "has-focused",
      "highlighted error",
      "highlighted warning",
    ],
    "contents, table, footnote": ["table-of-contents", "<table", 'class="footnotes"'],
    "HTML: kbd, mark, definition list": ["<kbd>", "<mark>", "<dl>"],
    "image (lazy), emoji, attributes": [
      'loading="lazy"',
      "🎉",
      'class="lead"',
      'id="times"',
      'id="stored"',
    ],
    "a .md link, a client script, the layout's useFrontmatter()": [
      'href="./tour#times"',
      "data-your-zone",
      'data-testid="docs-updated"',
    ],
  };
  const updated = { "en-US": "Updated", "th-TH": "อัปเดตเมื่อ", "ar-EG": "آخر تحديث" } as Record<
    string,
    string
  >;
  for (const l of LOCALES) {
    const html = await (await get(`/${l}/docs/tour`)).text();
    for (const [what, marks] of Object.entries(features))
      expect(
        marks.filter((m) => !html.includes(m)),
        `${l}: ${what}`,
      ).toEqual([]);
    expect(html, `${l}: a box with its English default title`).not.toContain(
      "custom-block-title-default",
    );
    expect(html, `${l}: the details box's own title`).not.toMatch(/<summary>\s*Details/);
    expect(html, `${l}: [[toc]] left as text`).not.toContain("[[toc]]");
    expect(html, `${l}: "updated" from the frontmatter, in this language`).toContain(updated[l]);
  }
});

test("every page has a title and a description, in its own language", async () => {
  const pages = [
    "",
    "/events",
    "/events/new",
    "/docs",
    "/docs/intl",
    "/docs/temporal",
    "/docs/tour",
  ];
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

// Void's page cache skips any response with Set-Cookie, or a Vary on a request header other than
// its own X-VoidPages ones (docs/guide/edge/revalidation.md, "How revalidation works"): silently,
// the page just stops being cached. void-fbtee's middleware runs on every page, so it must add
// neither.
test("no page sets a cookie or varies by a request header, so Void can cache it", async () => {
  const pages = [
    "",
    "/events",
    "/events/new",
    "/docs",
    "/docs/intl",
    "/docs/temporal",
    "/docs/tour",
  ];
  const voids = new Set(["x-voidpages", "x-voidpages-version"]);
  for (const l of LOCALES)
    for (const page of pages) {
      const res = await get(`/${l}${page}`);
      expect(res.headers.get("set-cookie"), `${l}${page}`).toBeNull();
      const vary = (res.headers.get("vary") ?? "")
        .split(",")
        .map((h) => h.trim().toLowerCase())
        .filter((h) => h && !voids.has(h));
      expect(vary, `${l}${page}`).toEqual([]);
    }
});

// Posting is its own page: the list links to it, and /events/new is that page in every language,
// never read as an event's id (in Void's routing a static segment beats [id]).
test("the events list links to /events/new, the form for posting one", async () => {
  const heading: Record<string, string> = {
    "en-US": "Post an event",
    "th-TH": "โพสต์กิจกรรม",
    "ar-EG": "انشر فعالية",
  };
  for (const l of LOCALES) {
    const list = await (await get(`/${l}/events`)).text();
    expect(list, `${l}: the list links to the form`).toContain(`href="/${l}/events/new"`);
    expect(list, `${l}: the form isn't on the list`).not.toContain('data-testid="event-post"');
    const res = await get(`/${l}/events/new`);
    expect(res.status, `${l}/events/new`).toBe(200);
    const form = await res.text();
    expect(form).toContain('data-testid="event-post"');
    // "Events › Post an event": the first part goes back to the list.
    expect(form).toMatch(
      new RegExp(
        `data-testid="events-crumbs"[\\s\\S]*?href="/${l}/events"[^>]*data-testid="crumb-events"`,
      ),
    );
    expect(form).toMatch(new RegExp(`data-testid="new-event-title"[^>]*>${heading[l]}<`));
  }
});

// Void's typed routes check every link the example builds with routeUrl. This checks the result at
// run time too, and the one link built at run time (the language switcher): every page reachable
// from a language's home page, following its links, answers 200.
test("every link, on every page reachable in each language, leads to a page", async () => {
  const broken: string[] = [];
  for (const l of LOCALES) {
    const seen = new Set([`/${l}`]);
    const queue = [`/${l}`];
    while (queue.length) {
      const page = queue.shift()!;
      const html = await (await get(page)).text();
      // Every link on the site, relative ones (as markdown pages write theirs) resolved against
      // the page as the browser does; not other sites, mail and the like, or files.
      for (const [, href] of html.matchAll(/href="([^"#?]+)/g)) {
        if (/^([a-z]+:|\/\/)/i.test(href!)) continue;
        const link = new URL(href!, `https://site${page}`).pathname;
        if (/\.[a-z0-9]+$/i.test(link) || seen.has(link)) continue;
        seen.add(link);
        const res = await get(link, { redirect: "manual" });
        if (res.status !== 200) broken.push(`${page} → ${href} (${link}): ${res.status}`);
        // Follow this language's own pages; the other languages' are reached from their home.
        else if (link === `/${l}` || link.startsWith(`/${l}/`)) queue.push(link);
      }
    }
    expect(seen.size, l).toBeGreaterThan(10);
  }
  expect(broken).toEqual([]);
});

// What every site needs, from public/ (icons made by `vp run icons`) and void.config.ts's head:
// each file served as itself, with its own type, and linked from every page.
test("the site's icons, web app manifest and robots.txt", async () => {
  const files = {
    "/favicon.ico": /^image\/(x-icon|vnd\.microsoft\.icon)/,
    "/favicon.svg": /^image\/svg\+xml/,
    "/apple-touch-icon-180x180.png": /^image\/png/,
    "/pwa-192x192.png": /^image\/png/,
    "/pwa-512x512.png": /^image\/png/,
    "/maskable-icon-512x512.png": /^image\/png/,
    "/manifest.webmanifest": /^application\/manifest\+json/,
    "/robots.txt": /^text\/plain/,
  };
  for (const [file, type] of Object.entries(files)) {
    const res = await get(file);
    expect(res.status, file).toBe(200);
    expect(res.headers.get("content-type"), file).toMatch(type);
  }
  const manifest = await (await get("/manifest.webmanifest")).json();
  for (const icon of manifest.icons)
    expect((await get(icon.src)).headers.get("content-type"), icon.src).toMatch(/^image\/png/);
  const html = await (await get("/th-TH")).text();
  for (const link of [
    'href="/favicon.ico"',
    'href="/favicon.svg"',
    'rel="apple-touch-icon"',
    'rel="manifest" href="/manifest.webmanifest"',
    'name="theme-color"',
  ])
    expect(html, link).toContain(link);
});

test("the middleware leaves files and API routes alone", async () => {
  // The file itself, not a page: on Cloudflare the Worker sees every request first, and
  // pages/[lang]/ matches /void.svg (a page came back with 200 before the middleware handed files
  // to Void's not-found handler, which serves them). A file that isn't there is not found.
  const svg = await get("/void.svg");
  expect(svg.status).toBe(200);
  expect(svg.headers.get("content-type")).toMatch(/^image\/svg\+xml/);
  expect(await svg.text()).toMatch(/^\s*<svg/);
  expect((await get("/no-such-file.svg")).status).toBe(404);
  // An empty POST to the live stream's control route (routes/api/live.ts): Void's live code
  // rejects the missing body itself, with its own JSON (packages/void/src/runtime/live.ts,
  // readControlRequest), so the request reached the route rather than a redirect or not-found page.
  const res = await get("/api/live", { method: "POST", redirect: "manual" });
  expect(res.status).toBe(400);
  expect(await res.json()).toMatchObject({ accepted: false });
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
    // pre-bundling, so `fbtee` and `fbtee/server` share one core (packages/void-fbtee/src/plugin.ts).
    expect(worker.filter((f) => read(f).includes("runWithFbtee"))).toHaveLength(1);
    // The app's code gets Cloudflare's own Temporal (void-fbtee's Vite plugin, plugin.ts): the
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
