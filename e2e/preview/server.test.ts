// Production build, over HTTP: what the middleware does ("/" to the source language, <html lang
// dir>, hreflang with x-default, the i18n <meta> for islands, leaving files and API routes alone),
// per-request state under concurrency, and the built worker.
import { globSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import { SITE } from "../../apps/example/src/site";
import { onLiveSite, url } from "../helpers";
import { EXAMPLE } from "./setup";
import { LOCALES, SOURCE } from "../locales";

const get = (path: string, init?: RequestInit) => fetch(url("prod") + path, init);

/** The app's own pages, under each language ("" is its home). */
const PAGES = [
  "",
  "/events",
  "/events/new",
  "/docs",
  "/docs/intl",
  "/docs/temporal",
  "/docs/strings",
  "/docs/markdown",
  "/docs/right-to-left",
  "/docs/translating",
  "/docs/emails",
  "/docs/pdfs",
  "/docs/tour",
];

/** The id of an event on the list. */
const firstEventId = async () =>
  (await (await get(`/${SOURCE}/events`)).text()).match(/\/events\/([0-9a-f-]{36})"/)![1]!;

/** A booking for `event` as a plain form post (not the page's JSON), from the site itself. */
const postBooking = (event: string, fields: Record<string, string>) =>
  get(`/${SOURCE}/events/${event}`, {
    method: "POST",
    redirect: "manual",
    // A page action from the page itself (Void refuses cross-origin ones).
    headers: { origin: url("prod"), "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      name: "A",
      email: "a@example.com",
      time_zone: "Asia/Bangkok",
      ...fields,
    }),
  });

test('"/" always redirects to the source language, whatever the browser asks for', async () => {
  for (const accept of ["th,en;q=0.5", "ar-EG", ""]) {
    const res = await get("/", { headers: { "accept-language": accept }, redirect: "manual" });
    expect(res.status, accept).toBe(301);
    expect(new URL(res.headers.get("location")!, "http://x").pathname, accept).toBe("/en-US");
    expect(res.headers.get("vary") ?? "").not.toMatch(/accept-language/i);
  }
});

// voidFbtee({ site }) in apps/example/vite.config.ts: every copy of the site (this one, the dev
// server, a Worker Preview) names the deployed address, SITE.
test("page head: lang, dir, hreflang alternates with x-default, canonical, og:url, og:locale, i18n meta", async () => {
  const html = await (await get("/ar-EG/docs/intl")).text();
  // The <html> attributes, in any order (Void's own, class and data-theme, come first).
  const htmlTag = html.match(/<html\b[^>]*>/)?.[0] ?? "";
  expect(htmlTag).toContain('lang="ar-EG"');
  expect(htmlTag).toContain('dir="rtl"');
  for (const l of LOCALES) expect(html).toContain(`hreflang="${l}" href="${SITE}/${l}/docs/intl"`);
  expect(html).toContain(`hreflang="x-default" href="${SITE}/en-US/docs/intl"`);
  // Its own address as canonical, and Open Graph's locale as language_TERRITORY (no
  // og:locale:alternate: Void keeps one meta tag per property, src/middleware.ts says more).
  expect(html).toContain(`rel="canonical" href="${SITE}/ar-EG/docs/intl"`);
  expect(html.match(/<link rel="canonical"/g)).toHaveLength(1);
  expect(html).toContain(`property="og:url" content="${SITE}/ar-EG/docs/intl"`);
  // A copy at another address (this test's local build, a Worker Preview, the dev server) stays
  // out of search results; the site itself doesn't.
  const robots = (await get("/ar-EG/docs/intl")).headers.get("x-robots-tag");
  expect(robots).toBe(new URL(url("prod")).origin === SITE ? null : "noindex");
  // Not on a page outside the languages: the same path under each language isn't a page.
  const outside = await (await get("/no-such-page")).text();
  expect(outside).not.toContain("hreflang=");
  expect(outside).not.toContain('rel="canonical"');
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
  const res = await postBooking(crypto.randomUUID(), { id: crypto.randomUUID() });
  expect(res.status).toBe(404);
});

// A plain form post (not the page's JSON) with the reminder box ticked books the seat: the
// checkbox arrives as "on". Booking the same id again is refused, which shows the first went in.
test("a plain form post with the reminder box ticked books the seat", async () => {
  const id = crypto.randomUUID();
  const event = await firstEventId();
  const book = () => postBooking(event, { id, ticket_in_reminder: "on" });
  expect((await book()).status).toBeLessThan(400);
  expect((await book()).status).toBe(400);
});

// The booking's id comes from the form: one already taken is refused, not a crash.
test("booking with an id that's already taken is refused", async () => {
  const id = crypto.randomUUID();
  const event = await firstEventId();
  const book = () => postBooking(event, { id });
  expect((await book()).status).toBeLessThan(400);
  expect((await book()).status).toBe(400);
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
  const head = async (path: string) => {
    const html = await (await get(path)).text();
    const got = {
      title: html.match(/<title>([^<]*)<\/title>/)?.[1] ?? "",
      description: html.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? "",
    };
    // Link previews carry the same two (pageHead, or the middleware for markdown pages), the title
    // without the site's name, which og:site_name carries.
    expect(html, `${path}: og:title`).toContain(
      `property="og:title" content="${got.title.replace(/ · void-fbtee$/, "")}"`,
    );
    expect(html, `${path}: og:description`).toContain(
      `property="og:description" content="${got.description}"`,
    );
    return got;
  };
  for (const page of PAGES) {
    const source = await head(`/${SOURCE}${page}`);
    for (const l of LOCALES) {
      const got = l === SOURCE ? source : await head(`/${l}${page}`);
      expect(got.title, `${l}${page}`).toMatch(/. · void-fbtee$/);
      expect(got.description, `${l}${page}`).not.toBe("");
      if (l !== SOURCE) expect(got.description, `${l}${page}`).not.toBe(source.description);
    }
  }
});

// The Emails page shows the app's own emails (src/events/emails.ts) in the page's language: the
// subject, and the HTML as a mail app gets it, in the email's direction on its content too.
test("the Emails page shows the app's emails in its own language", async () => {
  const ar = await (await get("/ar-EG/docs/emails")).text();
  expect(ar).toContain("مقعدك في أمسية خط عربي");
  expect(ar.match(/<iframe/g)).toHaveLength(2);
  expect(ar).toContain("lang=&quot;ar-EG&quot; dir=&quot;rtl&quot;");
  const th = await (await get("/th-TH/docs/emails")).text();
  expect(th).toContain("ที่นั่งของคุณใน أمسية خط عربي");
  // The Arabic title marked as Arabic inside the Thai email.
  expect(th).toContain("&lt;bdi lang=&quot;ar-EG&quot; dir=&quot;rtl&quot;&gt;");
});

// The reference pages show their feature at work in the page's language: the Strings page's
// plural in all six of Arabic's forms, each copy of the markdown pages, every catalog's count, and
// the same markup both ways round.
test("the reference pages show their feature at work", async () => {
  const strings = await (await get("/ar-EG/docs/strings")).text();
  for (const form of ["zero", "one", "two", "few", "many", "other"])
    expect(strings, form).toContain(`>${form}<`);
  expect(strings).toContain("حجزت ليلتين");
  const markdown = await (await get("/th-TH/docs/markdown")).text();
  expect(markdown).toContain("docs/tour.md");
  expect(markdown).toContain("translatedFrom: ");
  const translating = await (await get("/en-US/docs/translating")).text();
  for (const l of LOCALES.filter((l) => l !== SOURCE))
    expect(translating).toContain(`i18n/translations/${l}.json`);
  const rtl = await (await get("/ar-EG/docs/right-to-left")).text();
  expect(rtl).toContain('dir="ltr" data-testid="row-ltr"');
  expect(rtl).toContain('dir="rtl" data-testid="row-rtl"');
});

// Every feature on the home page links to its own docs page on this site, in the page's language.
test("every home page feature links to its docs page", async () => {
  const html = await (await get("/th-TH")).text();
  for (const page of [
    "strings",
    "temporal",
    "intl",
    "markdown",
    "translating",
    "right-to-left",
    "emails",
  ])
    expect(html, page).toContain(`href="/th-TH/docs/${page}"`);
});

// The PDFs page shows the app's own ticket, printed by Cloudflare Browser Run for the page's
// language (remote in the preview too: void.config.ts), and a ticket that isn't there is a 404.
test("the PDFs page shows a ticket printed for its language", async () => {
  const page = await (await get("/ar-EG/docs/pdfs")).text();
  // A picture of the ticket's page, which every phone shows, opening the PDF.
  expect(page).toContain('href="/samples/ticket/ar-EG"');
  expect(page).toContain('src="/samples/ticket-image/ar-EG"');
  const image = await get("/samples/ticket-image/ar-EG");
  expect(image.headers.get("content-type")).toBe("image/webp");
  const pdf = await get("/samples/ticket/ar-EG");
  expect(pdf.status).toBe(200);
  expect(pdf.headers.get("content-type")).toBe("application/pdf");
  expect(new TextDecoder().decode(new Uint8Array(await pdf.arrayBuffer()).slice(0, 5))).toBe(
    "%PDF-",
  );
  expect((await get(`/tickets/${crypto.randomUUID()}`)).status).toBe(404);
});

// Void's page cache skips any response with Set-Cookie, or a Vary on a request header other than
// its own X-VoidPages ones (docs/guide/edge/revalidation.md, "How revalidation works"): silently,
// the page just stops being cached. void-fbtee's middleware runs on every page, so it must add
// neither.
test("no page sets a cookie or varies by a request header, so Void can cache it", async () => {
  const voids = new Set(["x-voidpages", "x-voidpages-version"]);
  // Vite's local preview server adds "Vary: Origin" to every response that has no Vary of its own,
  // static files too (its built-in CORS; seen 2026-11-13 on /favicon.ico and the CSS), and a page
  // Void serves from its cache can come without one. Cloudflare doesn't: the live site's /en-US/docs
  // and assets carry no Vary. So on the preview it isn't the site's, and is left out here; on the
  // live site (`vp run test:production`) nothing is left out.
  if (!onLiveSite()) voids.add("origin");
  for (const l of LOCALES)
    for (const page of PAGES) {
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
// void.config.ts's head: one picture, the site's name and X's large card on every page; each page's
// own address as og:url.
test("link previews: the site's picture, name and card on every page; og:url its own address", async () => {
  for (const l of LOCALES)
    for (const page of ["", "/events", "/docs/tour"]) {
      const html = await (await get(`/${l}${page}`)).text();
      for (const tag of [
        `property="og:image" content="${SITE}/og-1.png"`,
        'property="og:image:width" content="1200"',
        'property="og:image:height" content="630"',
        'property="og:image:type" content="image/png"',
        'property="og:site_name" content="void-fbtee"',
        'property="og:type" content="website"',
        'name="twitter:card" content="summary_large_image"',
        `property="og:url" content="${SITE}/${l}${page}"`,
      ])
        expect(html, `${l}${page}`).toContain(tag);
    }
  const picture = await get("/og-1.png");
  expect(picture.headers.get("content-type")).toMatch(/^image\/png/);
  // 1200×630, from the PNG's own header (IHDR: width and height at bytes 16 and 20).
  const bytes = new DataView(await picture.arrayBuffer());
  expect([bytes.getUint32(16), bytes.getUint32(20)]).toEqual([1200, 630]);
});

// Structured data (schema.org JSON-LD, through jsonLd from void-fbtee/head): the site on each
// language's home page, and each event on its page, in the language it's shown in.
test("structured data: WebSite on each home page, Event on an event's page", async () => {
  const data = (html: string) =>
    [...html.matchAll(/<script type="application\/ld\+json">([^<]*)<\/script>/g)].map(([, json]) =>
      JSON.parse(json!),
    );
  for (const l of LOCALES)
    expect(data(await (await get(`/${l}`)).text()), l).toEqual([
      expect.objectContaining({ "@type": "WebSite", url: `${SITE}/${l}`, inLanguage: l }),
    ]);
  // A sample event (db/migrations/*_sample_events.sql): the swim, 6:00 on 7 March in Sydney.
  const list = await (await get(`/${SOURCE}/events`)).text();
  const swim = list.match(
    /href="(\/en-US\/events\/[0-9a-f-]{36})"(?:(?!href=)[^])*?Harbour sunrise swim/,
  )?.[1];
  expect(swim).toBeTruthy();
  expect(data(await (await get(swim!.replace("/en-US/", "/th-TH/"))).text())).toEqual([
    expect.objectContaining({
      "@type": "Event",
      startDate: "2027-03-07T06:00:00+11:00",
      url: `${SITE}${swim!.replace("/en-US/", "/th-TH/")}`,
    }),
  ]);
});

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
  // Made from the catalogs (routes/manifest.webmanifest.ts): the source language's description,
  // and every other language's, translated, with its direction.
  expect(manifest).toMatchObject({ lang: SOURCE, dir: "ltr" });
  for (const l of LOCALES.filter((l) => l !== SOURCE)) {
    const d = manifest.description_localized[l];
    expect(d.lang, l).toBe(l);
    expect(d.dir, l).toBe(l === "ar-EG" ? "rtl" : "ltr");
    expect(d.value, `${l}: translated`).not.toBe(manifest.description);
  }
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

// routes/sitemap.xml.ts and routes/robots.txt.ts, by Google's rules: every page in every language,
// each listing all its languages and x-default; dates only where something records a real change.
test("the sitemap: every page in every language, with its alternates; robots.txt points to it", async () => {
  const res = await get("/sitemap.xml");
  expect(res.headers.get("content-type")).toMatch(/^application\/xml/);
  const xml = await res.text();
  const entries = [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].map(([, u]) => ({
    loc: new URL(u.match(/<loc>(.*?)<\/loc>/)![1]).pathname,
    lastmod: u.match(/<lastmod>(.*?)<\/lastmod>/)?.[1],
    alternates: [...u.matchAll(/hreflang="([^"]+)"/g)].map(([, h]) => h),
  }));
  for (const l of LOCALES)
    // Not the form for posting one, which routes/sitemap.xml.ts leaves out.
    for (const page of PAGES.filter((p) => p !== "/events/new"))
      expect(
        entries.map((e) => e.loc),
        `${l}${page}`,
      ).toContain(`/${l}${page}`);
  for (const e of entries) {
    expect(e.alternates.sort(), e.loc).toEqual([...LOCALES, "x-default"].sort());
    expect((await get(e.loc)).status, e.loc).toBe(200);
  }
  // No date where nothing records one: the app's own pages.
  for (const l of LOCALES)
    for (const page of ["", "/docs", "/docs/intl"])
      expect(entries.find((e) => e.loc === `/${l}${page}`)?.lastmod, `${l}${page}`).toBeUndefined();
  // The tour's is its frontmatter's `updated`; an event's, a date-time.
  expect(entries.find((e) => e.loc === `/${SOURCE}/docs/tour`)?.lastmod).toMatch(
    /^\d{4}-\d{2}-\d{2}$/,
  );
  for (const e of entries.filter((e) => /\/events\/[0-9a-f-]{36}$/.test(e.loc)))
    expect(e.lastmod, e.loc).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
  const robots = await (await get("/robots.txt")).text();
  expect(robots).toMatch(/^Sitemap: https?:\/\/[^/]+\/sitemap\.xml$/m);
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
    // Counted by what defines it: the middleware and void-fbtee/server both call runWithFbtee, so
    // the name appears in more than one file.
    expect(worker.filter((f) => read(f).includes("function runWithFbtee("))).toHaveLength(1);
    expect(
      worker.filter((f) => read(f).includes("function registerRequestStateProvider(")),
    ).toHaveLength(1);
    // The app's code gets Cloudflare's own Temporal (void-fbtee's Vite plugin, plugin.ts): the
    // polyfill's code is in the worker only for the Temporal reference page, which runs it beside
    // Cloudflare's to compare. So every file that imports the polyfill is the page's rows
    // (src/docs/temporal.ts) or imports them.
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
