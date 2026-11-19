// Server code's i18n: the parts an app's loaders, actions, routes, jobs and queues use, beside the
// middleware (void-fbtee/middleware) that sets each request's language.
//
// - inLocale(): code in a language of its own choosing, not the request's: a scheduled job
//   (crons/), a queue consumer (queues/) or an email, which Void runs with no request (Void's docs:
//   guide/jobs.md, defineScheduled(async (controller, env) => …); guide/queues.md,
//   defineQueue(async (batch, env) => …)), or one person's language inside a request in another.
// - revalidate(): Void's (void/isr), clearing a page in every language.
// - sitemap(): /sitemap.xml with every page in every language.
// - textLocales(), pickText(): which stored translation of what people post to show.
// - The current language for routeUrl (void-fbtee/routes): the request's, set by the middleware
//   (runIn), or inLocale()'s, held here in an AsyncLocalStorage, as fbtee holds its own state.
import { AsyncLocalStorage } from "node:async_hooks";
import { runWithFbtee } from "fbtee/server";
import { revalidate as voidRevalidate } from "void/isr";
import type { PagePath, PagePathMap, RouteUrl } from "void/routes";
import config from "virtual:void-fbtee/config";
import catalogs from "virtual:void-fbtee/catalogs";
import markdownPages from "virtual:void-fbtee/md-pages";
import langPages from "virtual:void-fbtee/pages";
import { setServerLang, setServerTranslations } from "./current";
import type { TranslationDictionary } from "fbtee";
import { present } from "./guards";
import { fallbackOf, type AppLocale, type Dir, type Lang, type Locale } from "./locales";
import { buildUrl } from "./routes";
import { allTranslations, fallbacksOf, reportMissing } from "./runtime";
import texts from "virtual:void-fbtee/texts";

const storage = new AsyncLocalStorage<Lang>();
setServerLang(() => storage.getStore());
// The catalogs runIn renders with, for <InLanguage> (react.tsx): it builds its own runtime from them.
const catalogsNow = new AsyncLocalStorage<TranslationDictionary>();
setServerTranslations(() => catalogsNow.getStore());

/** The current language's BCP 47 tag: the request's or inLocale()'s; undefined outside both. */
export function currentLocale(): AppLocale | undefined {
  const lang = storage.getStore();
  return lang && config.locales.find((l) => l.segment === lang)?.locale;
}

/** Runs `fn` with `lang` as the current language (the middleware, for each request). */
function withLang<T>(lang: Lang, fn: () => T): T {
  return storage.run(lang, fn);
}

/** Runs `fn` in `language`, for fbtee (with these catalogs) and for routeUrl both. */
export function runIn<T>(language: Locale, translations: TranslationDictionary, fn: () => T): T {
  const { sourceLocale, fallbackLocales } = config;
  return withLang(language.segment, () =>
    catalogsNow.run(translations, () =>
      runWithFbtee(
        {
          locale: language.locale,
          sourceLocale,
          fallbackLocales,
          translations,
          onMissingTranslation: missing,
        },
        fn,
      ),
    ),
  );
}

/** Each language's missing string, logged once per Worker isolate (runtime.ts). */
const missing = reportMissing(texts);

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
  if (!found) {
    throw new Error(
      `void-fbtee: inLocale("${locale}"): not one of the app's languages (${config.locales.map((l) => l.locale).join(", ")})`,
    );
  }
  const translations = await allTranslations(catalogs);
  return await runIn(found, translations, () => fn({ locale, dir: found.dir }));
}

/**
 * Void's revalidate (void/isr), with every language: a path that starts `/[lang]` is cleared in
 * each of the app's languages, so none is left stale; any other path as it is.
 *
 *   await revalidate({ paths: ["/[lang]/events", `/[lang]/events/${id}`, "/sitemap.xml"] });
 */
export function revalidate(options: {
  // In this package RouteUrl is Void's stub (string); in an app it's the app's routes.
  // oxlint-disable-next-line no-redundant-type-constituents -- RouteUrl is only string inside this package (the line above)
  paths?: ReadonlyArray<`/[lang]${string}` | RouteUrl>;
  all?: boolean;
}): Promise<void> {
  const paths = options.paths?.flatMap((path): Array<string> => {
    const rest = path.startsWith("/[lang]") ? path.slice("/[lang]".length) : undefined;
    return rest !== undefined && isSubPath(rest) ? localizedPaths(rest) : [path];
  });
  return clearPaths({ ...options, paths });
}

/**
 * The same page in every language: `localizedPaths("/events")` is ["/en-US/events",
 * "/th-TH/events", …].
 */
/** A path below a language's own ("/events"), or none: what follows `/[lang]` in a pattern. */
const isSubPath = (path: string): path is `/${string}` | "" => path === "" || path.startsWith("/");

// Void's revalidate, for paths built when the code runs: in an app it takes the app's own routes
// (RouteUrl), which this package, built without an app, doesn't have; its parameter as plain
// text is what Void's runtime takes. A typed view of the function, which TypeScript checks.
const clearPaths: (options: { paths?: Array<string>; all?: boolean }) => Promise<void> =
  voidRevalidate;

export function localizedPaths<P extends `/${string}` | "">(path: P): Array<`/${Lang}${P}`> {
  return config.locales.map((l) => `/${l.segment}${path}` as const);
}

/**
 * Every language as a page's `[lang]` param: `[{ lang: "en-US" }, { lang: "th-TH" }, …]`. For
 * prerendering a page under `pages/[lang]/` in every language (Void's edge prerendering, which
 * needs a page's params; it builds the pages during the deploy on Void's platform, and on the
 * first visit after a deploy on direct Cloudflare):
 * `export const prerender = true; export const getPrerenderPaths = langParams;`.
 */
export function langParams(): Array<{ lang: Lang }> {
  return config.locales.map((l) => ({ lang: l.segment }));
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
  const translations = await allTranslations(catalogs);
  return Object.fromEntries(
    config.locales.map((l) => [
      l.locale,
      runIn(l, translations, () => fn({ locale: l.locale, dir: l.dir })),
    ]),
  );
}

/**
 * The site's own address: `voidFbtee({ site })`, or else the one this request came to. For the
 * site's canonical addresses (a sitemap, robots.txt's Sitemap line, structured data), so they match
 * the pages' canonical and hreflang. Not for a link someone follows from an email: that goes to
 * where the request came from (`new URL(c.req.url).origin`: the dev server, a preview, or live),
 * since `site` is the live address everywhere.
 */
export function siteOrigin(c: { req: { url: string } }): string {
  return config.site ?? new URL(c.req.url).origin;
}

/** The app's languages (`voidFbtee({ locales })`), for server code that works per language. */
export function appLocales(): Array<AppLocale> {
  return config.locales.map((l) => l.locale);
}

/**
 * One of the app's languages, from text stored or sent (a booker's language in the database):
 * the text when it's one of them, else the fallback language (`voidFbtee({ fallbackLocale })`),
 * so someone whose language the app no longer has gets the one it gives everyone else. Checked,
 * where a cast would believe any text.
 */
export function appLocaleOf(value: string): AppLocale {
  const own = config.locales.find((l) => l.locale === value);
  if (own) {
    return own.locale;
  }
  return fallbackOf(config).locale;
}

/**
 * A page under pages/[lang]/, as Void's generated route types name it ("/[lang]/events/[id]"):
 * the app's own pages, from `PagePath` (void/routes). Void's older ":lang" spellings aside.
 */
export type LangPagePattern = Exclude<Extract<PagePath, `/[lang]${string}`>, `/:${string}`>;

/** A page under pages/[lang]/ whose only parameter is the language ("/[lang]/docs"): the pages the
 * sitemap lists by itself. */
export type LangPage = {
  [P in LangPagePattern]: [PagePathMap[P]] extends ["lang"] ? P : never;
}[LangPagePattern];

/** A page for the sitemap: a route under pages/[lang]/, with its other params, and its last change. */
export interface SitemapPage {
  path: LangPagePattern;
  params?: Record<string, string | number>;
  /** When its content last changed (W3C date or date-time), in every language or per language. */
  lastmod?: string | ((locale: AppLocale) => string | undefined);
}

/**
 * The sitemap (a route's response: `export const GET = defineHandler((c) => sitemap(c))` in
 * routes/sitemap.xml.ts), by Google's rules (Search Central, "Build and submit a sitemap" and
 * "Tell Google about localized versions of your page", checked 2026-11-12): each page in every
 * language, each listing all its languages, itself included, plus x-default ("/" for the
 * home page, which sends each visitor to their language; else the fallback language's); full addresses on the site's own origin (siteOrigin); <lastmod> only where it's a
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
  options: { pages?: ReadonlyArray<SitemapPage>; exclude?: ReadonlyArray<LangPage> } = {},
): Response {
  const origin = siteOrigin(c);
  const given = options.pages ?? [];
  const lastmodOf = new Map(given.filter((p) => !p.params).map((p) => [p.path, p.lastmod]));
  type Entry = { urls: Record<string, string>; lastmod?: SitemapPage["lastmod"] };
  const urlsOf = (page: SitemapPage) =>
    Object.fromEntries(
      config.locales.map((l) => [
        l.locale,
        buildUrl(page.path, { params: { ...page.params, lang: l.segment } }),
      ]),
    );
  const entries: Array<Entry> = [
    ...langPages
      .filter((path) => !options.exclude?.includes(path))
      .map((path) => ({ urls: urlsOf({ path }), lastmod: lastmodOf.get(path) })),
    ...given
      .filter((p) => p.params || !langPages.some((path) => path === p.path))
      .map((p) => ({ urls: urlsOf(p), lastmod: p.lastmod })),
    ...markdownEntries(),
  ];
  // x-default: "/" for the home page, which sends each visitor to their language; else the page in
  // the fallback language (as the middleware's xDefault).
  const fallback = fallbackOf(config);
  const xDefaultOf = (entry: Entry) => {
    const url = present(entry.urls[fallback.locale], `the sitemap's address in ${fallback.locale}`);
    return config.redirectHome && url.replace(/\/$/, "") === `/${fallback.segment}` ? "/" : url;
  };
  const xml = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">`,
    ...entries.flatMap((entry) =>
      config.locales.map((l) => {
        const lastmod =
          typeof entry.lastmod === "function" ? entry.lastmod(l.locale) : entry.lastmod;
        const alternates = [
          ...config.locales.map(
            (a) =>
              [
                a.locale,
                present(entry.urls[a.locale], `the sitemap's address in ${a.locale}`),
              ] as const,
          ),
          ["x-default", xDefaultOf(entry)] as const,
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
function markdownEntries(): Array<{
  urls: Record<string, string>;
  lastmod: (l: string) => string | undefined;
}> {
  const byPath = new Map<
    string,
    { urls: Record<string, string>; updated: Record<string, string> }
  >();
  for (const page of markdownPages) {
    const [, segment, ...rest] = page.path.replace(/\/+$/, "").split("/");
    const locale = config.locales.find((l) => l.segment === segment)?.locale;
    if (!locale) {
      continue;
    }
    const key = `/${rest.join("/")}`;
    const entry = byPath.get(key) ?? { urls: {}, updated: {} };
    entry.urls[locale] = page.path;
    const updated = page.frontmatter.updated;
    if (typeof updated === "string") {
      entry.updated[locale] = updated;
    }
    byPath.set(key, entry);
  }
  return [...byPath.values()]
    .filter((p) => config.locales.every((l) => p.urls[l.locale]))
    .map((p) => ({ urls: p.urls, lastmod: (l: string) => p.updated[l] }));
}

/** Text for XML: its five special characters escaped. */
const xmlText = (text: string) => text.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);

/**
 * The languages to look for a stored translation in, best first: the page's own, then its
 * fallbacks as fbtee uses them for the app's own strings (its natural parents, fr-CA → fr, and
 * `voidFbtee({ fallbackLocales })`: runtime.ts fallbacksOf), only the app's own languages.
 * For content people post, kept one row per language beside the original (a table such as
 * `event_texts`: the item's id, `locale`, and the translated fields, unique on the two):
 * `where(and(eq(event_texts.event_id, id), inArray(event_texts.locale, textLocales(locale))))`.
 */
export function textLocales(locale: string): Array<string> {
  const own = new Set(config.locales.map((l) => l.locale));
  return [
    ...new Set([locale, ...fallbacksOf(locale, config.fallbackLocales).filter((l) => own.has(l))]),
  ];
}

/**
 * The best of the stored translations for a page in `locale` (rows with a `locale`, as
 * textLocales() found them), or undefined: then show the original, as its writer wrote it, marked
 * with its own language (langAttrs).
 */
export function pickText<T extends { locale: string }>(
  rows: ReadonlyArray<T>,
  locale: string,
): T | undefined {
  for (const l of textLocales(locale)) {
    const found = rows.find((r) => r.locale === l);
    if (found) {
      return found;
    }
  }
}
