// Void middleware: one request = one locale and one fbtee state.
// The app re-exports it from middleware/99.i18n.ts (Void only finds middleware by file name, and runs it in
// the order of the number, so 99 runs after the app's own):
//
//   export { default } from "void-fbtee/middleware";
//
// - The locale comes from the first URL segment (/th-TH/...). "/" goes to the source locale by
//   Void's own redirects (routing.redirects in void.config.ts, which init adds and check requires):
//   one URL per language, as Google wants, never a redirect by the visitor's language.
// - fbtee's per-request state is held by fbtee itself in AsyncLocalStorage (runWithFbtee), so
//   text rendered after the shell streams in the right language too. It gets every catalog, so
//   fbtee falls back per message (de-AT -> de -> source text) as its README describes.
// - c.get("i18n") and shared.i18n = { locale, lang, dir, now, path }: the browser gets the same "now" the server rendered
//   with; path is the page without its locale prefix, for links to it in other languages.
// - <html lang dir>, hreflang alternates (plus x-default, the source locale) and <meta name="void-fbtee"> (the same i18n data, for
//   islands) go into headDefaults.
import { defineMiddleware } from "void";
import { runWithFbtee } from "fbtee/server";
import { Temporal } from "temporal-polyfill";
import config from "virtual:void-fbtee/config";
import catalogs from "virtual:void-fbtee/catalogs";
import { matchedRoutes } from "virtual:void-fbtee/hono-route";
import { localeFromPath, META_NAME, type Dir, type Lang } from "./locales";
import { allTranslations } from "./runtime";

export interface SharedI18n {
  locale: string;
  /** The language's URL segment, typed as one of the app's (VoidFbteeRegister, in void-fbtee/locales): the
   * `lang` of `routeUrl("/[lang]/events", { params: { lang } })`, and of `/${lang}/docs/tour`. */
  lang: Lang;
  dir: Dir;
  /** The server's "now" for this response, as an ISO instant. */
  now: string;
  /** This page's path without the locale prefix ("/docs/intl" for /th-TH/docs/intl; "" for /th-TH):
   * `/${locale.segment}${path}` is the same page in another language. */
  path: string;
}

// `c.get("i18n")` in loaders and actions, typed (Void's "Context
// Variables"). Its own name, not `shared`: `shared` is the app's to type, and two declarations of
// one property with different types don't merge.
declare module "void" {
  interface CloudContextVariables {
    i18n: SharedI18n;
  }
}

/**
 * The same page in every language: `localizedPaths("/events")` is ["/en-US/events",
 * "/th-TH/events", …]. For anything that acts on all of them, such as clearing Void's page cache
 * after a change (`revalidate({ paths: localizedPaths(…) })` from void/isr).
 */
export function localizedPaths<P extends `/${string}`>(path: P): `/${Lang}${P}`[] {
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
      runWithFbtee({ locale: l.locale, sourceLocale, fallbackLocales, translations }, () =>
        fn({ locale: l.locale, dir: l.dir }),
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

// Void's own endpoints, API routes and file requests: no catalog, no fbtee state. They still get
// shared.i18n, because Void renders its not-found page (through the app's layout) for them.
const LIGHT = /^\/(__void|api)(\/|$)|\.[a-z0-9]+$/i;

/** The path of the route that will answer this request: the first one after the middleware that
 * isn't itself middleware (those match every path). */
function answeringRoute(c: { req: { routeIndex: number } }): string | undefined {
  return matchedRoutes(c)
    .slice(c.req.routeIndex + 1)
    .find((r) => r.path !== "*" && r.path !== "/*")?.path;
}

// Typed by Void's own name for it, so the built types point to "void" (every app has it) rather than
// carrying a copy of Hono's (Void's dependency; a pnpm app can't import it).
const middleware: ReturnType<typeof defineMiddleware> = defineMiddleware(async (c, next) => {
  const path = c.req.path;
  const light = LIGHT.test(path);

  const found = localeFromPath(path, config);
  const source = config.locales.find((l) => l.locale === config.sourceLocale)!;
  const current = found ?? source;
  const rest = found ? path.slice(found.segment.length + 1) : path;
  const i18n: SharedI18n = {
    locale: current.locale,
    lang: current.segment,
    dir: current.dir,
    now: Temporal.Now.instant().toString(),
    path: rest,
  };
  const origin = siteOrigin(c);
  // Only on a page in one of the languages: anywhere else (a page with no language in its path)
  // the same path under each language isn't a page.
  const alternates = !found
    ? []
    : [
        ...config.locales.map((l) => ({ hreflang: l.locale, segment: l.segment })),
        { hreflang: "x-default", segment: source.segment },
      ].map(({ hreflang, segment }) => ({
        rel: "alternate",
        hreflang,
        href: `${origin}/${segment}${rest}`,
      }));
  c.set("i18n", i18n);
  const shared = (c.get("shared") ?? {}) as Record<string, unknown>;
  const head = c.get("headDefaults") ?? {};
  c.set("shared", { ...shared, i18n });
  // On a page in one of the languages: its own address as canonical (each language version is its
  // own canonical; one pointing at another language makes search engines ignore its hreflang), and
  // Open Graph's locale in its language_TERRITORY form (en_US, not en-US), so link previews are in
  // the page's language (ogp.me, og:locale). Not og:locale:alternate: it's one tag per other
  // language, and Void keeps one meta tag per property (resolveHead, packages/void/src/pages/head.ts
  // in Void 1.8.0), so only the last would be left.
  const page = found
    ? {
        link: [{ rel: "canonical", href: `${origin}/${found.segment}${rest}` }],
        meta: [
          { property: "og:locale", content: found.locale.replace("-", "_") },
          { property: "og:url", content: `${origin}/${found.segment}${rest}` },
        ],
      }
    : { link: [], meta: [] };
  c.set("headDefaults", {
    ...head,
    htmlAttrs: { ...head.htmlAttrs, lang: current.locale, dir: current.dir },
    link: [...(head.link ?? []), ...alternates, ...page.link],
    // Islands hydrate without Void's shared data, so they read i18n from here (install.ts).
    meta: [...(head.meta ?? []), ...page.meta, { name: META_NAME, content: JSON.stringify(i18n) }],
  });
  // No catalogs for light requests, but still inside fbtee state, so a not-found page with <fbt> renders.
  const { sourceLocale, fallbackLocales } = config;
  const translations = light ? {} : await allTranslations(catalogs);
  // A page under [lang] for a language the app doesn't have (/xx-XX/events, /nope) doesn't exist:
  // Void's not-found page, in the source language, rather than a copy of the page under a made-up
  // language. Only when the route that will answer is one whose first segment is a parameter, as
  // Void finds the answering route (matchedRoutes after this middleware, as Void's own
  // packages/void/src/runtime/routing-pages.ts does), so the app's own routes (/webhook) are left
  // alone. c.notFound() runs the app's not-found handler (docs/guide/pages-routing/errors.md).
  // Files too (/void.svg, /robots.txt): on Cloudflare, an app with middleware sends every request
  // to the Worker first (Void's asset-worker-bypass.ts), where [lang] matches them; Void's
  // not-found handler serves the file if there is one ("Dynamic page patterns also match real
  // files", packages/void/src/runtime/routing-pages.ts), else the not-found page.
  const own = /^\/(__void|api)(\/|$)/.test(path);
  const answering = found || own ? undefined : answeringRoute(c);
  const madeUp = answering !== undefined && /^\/:[^/]+/.test(answering);
  return runWithFbtee({ locale: current.locale, sourceLocale, fallbackLocales, translations }, () =>
    madeUp ? c.notFound() : next(),
  );
});

export default middleware;
