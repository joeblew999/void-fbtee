// Server code's i18n: the parts an app's loaders, actions, routes, jobs and queues use, beside the
// middleware (void-fbtee/middleware) that sets each request's language.
//
// - inLocale(): code in a language of its own choosing, not the request's: a scheduled job
//   (crons/), a queue consumer (queues/) or an email, which Void runs with no request (Void's docs:
//   guide/jobs.md, defineScheduled(async (controller, env) => …); guide/queues.md,
//   defineQueue(async (batch, env) => …)), or one person's language inside a request in another.
// - revalidate(): Void's (void/isr), clearing a page in every language.
// - sitemap(): /sitemap.xml with every page in every language.
// - The current language for routeUrl (void-fbtee/routes): the request's, set by the middleware
//   (withLang), or inLocale()'s, held here in an AsyncLocalStorage, as fbtee holds its own state.
import { AsyncLocalStorage } from "node:async_hooks";
import { runWithFbtee } from "fbtee/server";
import { revalidate as voidRevalidate } from "void/isr";
import type { RouteUrl } from "void/routes";
import config from "virtual:void-fbtee/config";
import catalogs from "virtual:void-fbtee/catalogs";
import markdownPages from "virtual:void-fbtee/md-pages";
import langPages from "virtual:void-fbtee/pages";
import { setServerLang } from "./current";
import type { AppLocale, Dir, Lang } from "./locales";
import { routeUrl } from "./routes";
import { allTranslations } from "./runtime";

const storage = new AsyncLocalStorage<Lang>();
setServerLang(() => storage.getStore());

/** The current language's BCP 47 tag: the request's or inLocale()'s; undefined outside both. */
export function currentLocale(): AppLocale | undefined {
  const lang = storage.getStore();
  return lang && config.locales.find((l) => l.segment === lang)?.locale;
}

/** Runs `fn` with `lang` as the current language (the middleware, for each request). */
export function withLang<T>(lang: Lang, fn: () => T): T {
  return storage.run(lang, fn);
}

/**
 * Runs `fn` in one of the app's languages: `fbs(…)` and `<fbt>` there are in it, with the same
 * catalogs and fallbacks as a page, including after an `await`, and `routeUrl` builds addresses
 * in it. `fn` gets the language and its text direction, for Intl and Temporal
 * (`toLocaleString(locale, …)`) and for an email's `dir`.
 *
 *   const subject = await inLocale(user.locale, () => fbs("Your booking", "Email subject: …"));
 *
 * A language the app doesn't have is an error, not a quiet fall back to the source: it's a stored
 * value gone wrong (a user's language from before a language was removed), and should be seen.
 */
export async function inLocale<T>(
  locale: AppLocale,
  fn: (language: { locale: AppLocale; dir: Dir }) => T,
): Promise<Awaited<T>> {
  const found = config.locales.find((l) => l.locale === locale);
  if (!found)
    throw new Error(
      `void-fbtee: inLocale("${locale}"): not one of the app's languages (${config.locales.map((l) => l.locale).join(", ")})`,
    );
  const { sourceLocale, fallbackLocales } = config;
  const translations = await allTranslations(catalogs);
  return await withLang(found.segment, () =>
    runWithFbtee({ locale, sourceLocale, fallbackLocales, translations }, () =>
      fn({ locale, dir: found.dir }),
    ),
  );
}

/**
 * Void's revalidate (void/isr), with every language: a path that starts `/[lang]` is cleared in
 * each of the app's languages, so none is left stale; any other path as it is.
 *
 *   await revalidate({ paths: ["/[lang]/events", `/[lang]/events/${id}`, "/sitemap.xml"] });
 */
export function revalidate(options: {
  // In this package RouteUrl is Void's stub (string); in an app it's the app's routes.
  // oxlint-disable-next-line no-redundant-type-constituents
  paths?: readonly (`/[lang]${string}` | RouteUrl)[];
  all?: boolean;
}): Promise<void> {
  const paths = options.paths?.flatMap((path) =>
    path.startsWith("/[lang]")
      ? localizedPaths(path.slice("/[lang]".length) as `/${string}`)
      : [path],
  );
  return voidRevalidate({ ...options, paths: paths as RouteUrl[] | undefined });
}

/**
 * The same page in every language: `localizedPaths("/events")` is ["/en-US/events",
 * "/th-TH/events", …].
 */
export function localizedPaths<P extends `/${string}` | "">(path: P): `/${Lang}${P}`[] {
  return config.locales.map((l) => `/${l.segment}${path}` as const);
}

/**
 * Every language as a page's `[lang]` param: `[{ lang: "en-US" }, { lang: "th-TH" }, …]`. For
 * prerendering a page under `pages/[lang]/` in every language (Void's edge prerendering, which
 * needs a page's params; it builds the pages during the deploy on Void's platform, and on the
 * first visit after a deploy on direct Cloudflare):
 * `export const prerender = true; export const getPrerenderPaths = langParams;`.
 */
export function langParams(): { lang: Lang }[] {
  return config.locales.map((l) => ({ lang: l.segment as Lang }));
}

/**
 * Something worked out in every language at once, for one response that holds them all (a web app
 * manifest's translated fields): `fn` runs once per language inside fbtee's state for it, so
 * `fbs(…)` there is in that language, with the same catalogs and fallbacks as a page. It gets the
 * language and its text direction. Keyed by locale, in the app's order (the source first).
 */
export async function inEveryLocale<T>(
  fn: (language: { locale: string; dir: Dir }) => T,
): Promise<Record<string, T>> {
  const { sourceLocale, fallbackLocales } = config;
  const translations = await allTranslations(catalogs);
  return Object.fromEntries(
    config.locales.map((l) => [
      l.locale,
      withLang(l.segment, () =>
        runWithFbtee({ locale: l.locale, sourceLocale, fallbackLocales, translations }, () =>
          fn({ locale: l.locale, dir: l.dir }),
        ),
      ),
    ]),
  );
}

/**
 * The site's own address: `voidFbtee({ site })`, or else the one this request came to. For anything
 * that writes full addresses (a sitemap, robots.txt's Sitemap line), so they match the pages'
 * canonical and hreflang.
 */
export function siteOrigin(c: { req: { url: string } }): string {
  return config.site ?? new URL(c.req.url).origin;
}

/** The app's languages (`voidFbtee({ locales })`), for server code that works per language. */
export function appLocales(): string[] {
  return config.locales.map((l) => l.locale);
}

/** A page for the sitemap: a route under pages/[lang]/, with its other params, and its last change. */
export interface SitemapPage {
  path: `/[lang]${string}`;
  params?: Record<string, string | number>;
  /** When its content last changed (W3C date or date-time), in every language or per language. */
  lastmod?: string | ((locale: AppLocale) => string | undefined);
}

/**
 * The sitemap (a route's response: `export const GET = defineHandler((c) => sitemap(c))` in
 * routes/sitemap.xml.ts), by Google's rules (Search Central, "Build and submit a sitemap" and
 * "Tell Google about localized versions of your page", checked 2026-11-12): each page in every
 * language, each listing all its languages, itself included, plus x-default (the source
 * language's); full addresses on the site's own origin (siteOrigin); <lastmod> only where it's a
 * real change, never the time it was drawn; no changefreq or priority (Google ignores them).
 *
 * Without options it lists every page under pages/[lang]/ whose only parameter is the language
 * (from Void's own list of the app's pages), and every markdown page that's in every language
 * (its frontmatter's `updated`, the date the page shows, as its <lastmod>). `pages` adds the
 * app's own (each event: `{ path: "/[lang]/events/[id]", params: { id }, lastmod }`) or gives a
 * listed page its last change; `exclude` leaves listed pages out (a form, with nothing to find).
 */
export function sitemap(
  c: { req: { url: string } },
  options: { pages?: readonly SitemapPage[]; exclude?: readonly `/[lang]${string}`[] } = {},
): Response {
  const origin = siteOrigin(c);
  const given = options.pages ?? [];
  const lastmodOf = new Map(given.filter((p) => !p.params).map((p) => [p.path, p.lastmod]));
  type Entry = { urls: Record<string, string>; lastmod?: SitemapPage["lastmod"] };
  const urlsOf = (page: SitemapPage) =>
    Object.fromEntries(
      config.locales.map((l) => [
        l.locale,
        routeUrl(page.path as never, { params: { ...page.params, lang: l.segment } } as never),
      ]),
    );
  const entries: Entry[] = [
    ...langPages
      .filter((path) => !options.exclude?.includes(path))
      .map((path) => ({ urls: urlsOf({ path }), lastmod: lastmodOf.get(path) })),
    ...given
      .filter((p) => p.params || !langPages.includes(p.path))
      .map((p) => ({ urls: urlsOf(p), lastmod: p.lastmod })),
    ...markdownEntries(),
  ];
  const source = config.sourceLocale;
  const xml = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">`,
    ...entries.flatMap((entry) =>
      config.locales.map((l) => {
        const lastmod =
          typeof entry.lastmod === "function" ? entry.lastmod(l.locale) : entry.lastmod;
        const alternates = [
          ...config.locales.map((a) => [a.locale, entry.urls[a.locale]!] as const),
          ["x-default", entry.urls[source]!] as const,
        ].map(
          ([hreflang, url]) =>
            `    <xhtml:link rel="alternate" hreflang="${xmlText(hreflang)}" href="${xmlText(origin + url)}"/>`,
        );
        return [
          `  <url>`,
          `    <loc>${xmlText(origin + entry.urls[l.locale])}</loc>`,
          ...(lastmod ? [`    <lastmod>${xmlText(lastmod)}</lastmod>`] : []),
          ...alternates,
          `  </url>`,
        ].join("\n");
      }),
    ),
    `</urlset>`,
    ``,
  ].join("\n");
  return new Response(xml, { headers: { "content-type": "application/xml; charset=utf-8" } });
}

/** The markdown pages, from @void/md's own list: each one's copies under pages/<locale>/ as one
 * page, only where it's in every language (an alternate must exist). */
function markdownEntries(): {
  urls: Record<string, string>;
  lastmod: (l: string) => string | undefined;
}[] {
  const byPath = new Map<
    string,
    { urls: Record<string, string>; updated: Record<string, string> }
  >();
  for (const page of markdownPages) {
    const [, segment, ...rest] = page.path.replace(/\/+$/, "").split("/");
    const locale = config.locales.find((l) => l.segment === segment)?.locale;
    if (!locale) continue;
    const key = `/${rest.join("/")}`;
    const entry = byPath.get(key) ?? { urls: {}, updated: {} };
    entry.urls[locale] = page.path;
    const updated = page.frontmatter.updated;
    if (typeof updated === "string") entry.updated[locale] = updated;
    byPath.set(key, entry);
  }
  return [...byPath.values()]
    .filter((p) => config.locales.every((l) => p.urls[l.locale]))
    .map((p) => ({ urls: p.urls, lastmod: (l: string) => p.updated[l] }));
}

/** Text for XML: its five special characters escaped. */
const xmlText = (text: string) => text.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
