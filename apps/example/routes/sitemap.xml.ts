// The sitemap, at /sitemap.xml (Void drops only the `.ts`), made when it's asked for so it lists
// events posted since the deploy. Google's rules (Search Central, "Build and submit a sitemap" and
// "Tell Google about localized versions of your page", checked 2026-11-12): each page in every
// language, each listing all its languages, itself included, plus x-default; values escaped (the
// XML builder does it); <lastmod> only where it's a real change to the content, never the time it
// was drawn; no changefreq or priority (Google ignores them). Void's page cache keeps it until the
// next deploy (routing.revalidate in void.config.ts); posting an event clears it (new.server.ts).
import { event_texts, events } from "@schema";
import pages from "@void/md/pages";
import XMLBuilder from "fast-xml-builder";
import { defineHandler } from "void";
import { db, eq, max } from "void/db";
import { routeUrl } from "void/routes";
import { appLocales, langParams, siteOrigin } from "void-fbtee/middleware";

/** One page in every language: its address in each, and its last real change where there is one. */
type Page = { urls: Record<string, string>; lastmod?: (locale: string) => string | undefined };

/** SQLite's "2026-11-12 09:42:31" (UTC) as the W3C date-time the sitemap takes. */
const w3c = (sqlite: string) => `${sqlite.replace(" ", "T")}Z`;
const newest = (...dates: (string | null | undefined)[]) =>
  dates
    .filter((d): d is string => !!d)
    .sort()
    .at(-1);

export const GET = defineHandler(async (c) => {
  const origin = siteOrigin(c);
  const locales = appLocales();
  const langs = langParams();
  // The same page in each language, by locale.
  const each = (url: (lang: (typeof langs)[number]["lang"]) => string) =>
    Object.fromEntries(langs.map(({ lang }, i) => [locales[i], url(lang)]));

  // Each event's last change: its own row, or a translation of it added later.
  const changed = await db
    .select({ id: events.id, at: events.updatedAt, text: max(event_texts.updatedAt) })
    .from(events)
    .leftJoin(event_texts, eq(event_texts.event_id, events.id))
    .groupBy(events.id);
  const eventDate = new Map(changed.map((e) => [e.id, w3c(newest(e.at, e.text)!)]));
  const listDate = newest(...eventDate.values());

  const list: Page[] = [
    // The app's own pages, each built with routeUrl so the type check catches a wrong one. No
    // <lastmod>: nothing records when their content changed. The posting form isn't listed: it has
    // nothing to find.
    { urls: each((lang) => routeUrl("/[lang]", { params: { lang } })) },
    { urls: each((lang) => routeUrl("/[lang]/docs", { params: { lang } })) },
    { urls: each((lang) => routeUrl("/[lang]/docs/intl", { params: { lang } })) },
    { urls: each((lang) => routeUrl("/[lang]/docs/temporal", { params: { lang } })) },
    // The events list changes when an event is posted or changes.
    {
      urls: each((lang) => routeUrl("/[lang]/events", { params: { lang } })),
      lastmod: () => listDate,
    },
    ...[...eventDate].map(([id, date]) => ({
      urls: each((lang) => routeUrl("/[lang]/events/[id]", { params: { lang, id } })),
      lastmod: () => date,
    })),
    ...markdownPages(
      locales,
      langs.map((l) => l.lang),
    ),
  ];

  const alternates = (urls: Record<string, string>) => [
    ...locales.map((l) => link(l, origin + urls[l])),
    link("x-default", origin + urls[locales[0]]),
  ];
  const xml = new XMLBuilder({
    ignoreAttributes: false,
    format: true,
    suppressEmptyNode: true,
  }).build({
    "?xml": { "@_version": "1.0", "@_encoding": "UTF-8" },
    urlset: {
      "@_xmlns": "http://www.sitemaps.org/schemas/sitemap/0.9",
      "@_xmlns:xhtml": "http://www.w3.org/1999/xhtml",
      url: list.flatMap((page) =>
        locales.map((l) => {
          const lastmod = page.lastmod?.(l);
          return {
            loc: origin + page.urls[l],
            ...(lastmod ? { lastmod } : {}),
            "xhtml:link": alternates(page.urls),
          };
        }),
      ),
    },
  });
  return c.body(xml, 200, { "content-type": "application/xml; charset=utf-8" });
});

const link = (hreflang: string, href: string) => ({
  "@_rel": "alternate",
  "@_hreflang": hreflang,
  "@_href": href,
});

/**
 * The markdown pages, from @void/md's own list: each one's copies under pages/<locale>/ grouped as
 * one page, each language's <lastmod> its own frontmatter `updated` (the date the page shows).
 */
function markdownPages(locales: string[], segments: string[]): Page[] {
  const byPath = new Map<
    string,
    { urls: Record<string, string>; updated: Record<string, string> }
  >();
  for (const page of pages) {
    const [, segment, ...rest] = page.path.split("/");
    const locale = locales[segments.indexOf(segment)];
    if (!locale) continue;
    const key = `/${rest.join("/")}`;
    const entry = byPath.get(key) ?? { urls: {}, updated: {} };
    entry.urls[locale] = page.path;
    const updated = page.frontmatter.updated;
    if (typeof updated === "string") entry.updated[locale] = updated;
    byPath.set(key, entry);
  }
  // Only pages in every language: an alternate must exist.
  return [...byPath.values()]
    .filter((p) => locales.every((l) => p.urls[l]))
    .map((p) => ({ urls: p.urls, lastmod: (l: string) => p.updated[l] }));
}
