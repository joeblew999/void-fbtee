// Void middleware: one request = one locale and one fbtee state.
// The app re-exports it from middleware/99.i18n.ts (Void only finds middleware by file name, and runs it in
// the order of the number, so 99 runs after the app's own):
//
//   export { default } from "void-fbtee/middleware";
//
// - The locale comes from the first URL segment (/th-TH/...). "/" redirects to the source
//   locale: one URL per language, as Google wants, and never a redirect by the visitor's language.
// - fbtee's per-request state is held by fbtee itself in AsyncLocalStorage (runWithFbtee), so
//   text rendered after the shell streams in the right language too. It gets every catalog, so
//   fbtee falls back per message (de-AT -> de -> source text) as its README describes.
// - shared.i18n = { locale, dir, now, path }: the browser gets the same "now" the server rendered
//   with; path is the page without its locale prefix, for links to it in other languages.
// - <html lang dir>, hreflang alternates (plus x-default, the source locale) and <meta name="void-fbtee"> (the same i18n data, for
//   islands) go into headDefaults.
import { defineMiddleware } from "void";
import { runWithFbtee } from "fbtee/server";
import { Temporal } from "temporal-polyfill";
import config from "virtual:void-fbtee/config";
import catalogs from "virtual:void-fbtee/catalogs";
import { localeFromPath, META_NAME, type Dir } from "./locales";
import { allTranslations } from "./runtime";

export interface SharedI18n {
  locale: string;
  dir: Dir;
  /** The server's "now" for this response, as an ISO instant. */
  now: string;
  /** This page's path without the locale prefix ("/docs/intl" for /th-TH/docs/intl; "" for /th-TH):
   * `/${locale.segment}${path}` is the same page in another language. */
  path: string;
}

/**
 * The same page in every language: `localizedPaths("/events")` is ["/en-US/events",
 * "/th-TH/events", …]. For anything that acts on all of them, such as clearing Void's page cache
 * after a change (`revalidate({ paths: localizedPaths(…) })` from void/isr).
 */
export function localizedPaths(path: string): string[] {
  return config.locales.map((l) => `/${l.segment}${path}`);
}

/** The app's languages (`voidFbtee({ locales })`), for server code that works per language. */
export function appLocales(): string[] {
  return config.locales.map((l) => l.locale);
}

// Void's own endpoints, API routes and file requests: no catalog, no fbtee state. They still get
// shared.i18n, because Void renders its not-found page (through the app's layout) for them.
const LIGHT = /^\/(__void|api)(\/|$)|\.[a-z0-9]+$/i;

export default defineMiddleware(async (c, next) => {
  const path = c.req.path;
  const light = LIGHT.test(path);

  const found = localeFromPath(path, config);
  const source = config.locales.find((l) => l.locale === config.sourceLocale)!;
  // Always the source language, never chosen by the visitor's language: Google's crawler sends no
  // Accept-Language, and redirecting by language hides the other versions from it.
  if (!found && path === "/" && !light) return c.redirect(`/${source.segment}`, 301);
  const current = found ?? source;
  const rest = found ? path.slice(found.segment.length + 1) : path;
  const i18n: SharedI18n = {
    locale: current.locale,
    dir: current.dir,
    now: Temporal.Now.instant().toString(),
    path: rest,
  };
  const origin = new URL(c.req.url).origin;
  const alternates = [
    ...config.locales.map((l) => ({ hreflang: l.locale, segment: l.segment })),
    { hreflang: "x-default", segment: source.segment },
  ].map(({ hreflang, segment }) => ({
    rel: "alternate",
    hreflang,
    href: `${origin}/${segment}${rest}`,
  }));
  const shared = (c.get("shared" as never) ?? {}) as Record<string, unknown>;
  const head = (c.get("headDefaults" as never) ?? {}) as {
    htmlAttrs?: Record<string, string>;
    link?: unknown[];
    meta?: unknown[];
  };
  c.set("shared" as never, { ...shared, i18n } as never);
  c.set(
    "headDefaults" as never,
    {
      ...head,
      htmlAttrs: { ...head.htmlAttrs, lang: current.locale, dir: current.dir },
      link: [...(head.link ?? []), ...alternates],
      // Islands hydrate without Void's shared data, so they read i18n from here (install.ts).
      meta: [...(head.meta ?? []), { name: META_NAME, content: JSON.stringify(i18n) }],
    } as never,
  );
  // No catalogs for light requests, but still inside fbtee state, so a not-found page with <fbt> renders.
  const { sourceLocale, fallbackLocales } = config;
  const translations = light ? {} : await allTranslations(catalogs);
  return runWithFbtee({ locale: current.locale, sourceLocale, fallbackLocales, translations }, () =>
    next(),
  );
});
