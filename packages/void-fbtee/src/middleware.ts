// Void middleware: one request = one locale and one fbtee state.
// The app re-exports it from middleware/99.i18n.ts (Void only finds middleware by file name):
//
//   export { default } from "void-fbtee/middleware";
//
// - The locale comes from the first URL segment (/th-TH/...). "/" redirects to the best locale
//   for Accept-Language, by fbtee's own matching (negotiate.ts), uncached and per-browser.
// - fbtee's per-request state is held by fbtee itself in AsyncLocalStorage (runWithFbtee), so
//   text rendered after the shell streams in the right language too. It gets every catalog, so
//   fbtee falls back per message (de-AT -> de -> source text) as its README describes.
// - shared.i18n = { locale, dir, now }: the browser gets the same "now" the server rendered with.
// - <html lang dir>, hreflang alternates and <meta name="void-fbtee"> (the same i18n data, for
//   islands) go into headDefaults.
import { defineMiddleware } from "void";
import { runWithFbtee } from "fbtee/server";
import { Temporal } from "temporal-polyfill";
import config from "virtual:void-fbtee/config";
import catalogs from "virtual:void-fbtee/catalogs";
import { localeFromPath, META_NAME, type Dir } from "./locales";
import { bestLocale } from "./negotiate";
import { allTranslations } from "./runtime";

export interface SharedI18n {
  locale: string;
  dir: Dir;
  /** The server's "now" for this response, as an ISO instant. */
  now: string;
}

// Void's own endpoints, API routes and file requests: no catalog, no fbtee state. They still get
// shared.i18n, because Void renders its not-found page (through the app's layout) for them.
const LIGHT = /^\/(__void|api)(\/|$)|\.[a-z0-9]+$/i;

export default defineMiddleware(async (c, next) => {
  const path = c.req.path;
  const light = LIGHT.test(path);

  const found = localeFromPath(path, config);
  if (!found && path === "/" && !light) {
    const best = bestLocale(c.req.header("accept-language"), config);
    c.header("Cache-Control", "private, no-store");
    c.header("Vary", "Accept-Language");
    return c.redirect(`/${best.segment}`, 302);
  }
  const current = found ?? config.locales.find((l) => l.locale === config.sourceLocale)!;
  const i18n: SharedI18n = {
    locale: current.locale,
    dir: current.dir,
    now: Temporal.Now.instant().toString(),
  };
  const rest = found ? path.slice(found.segment.length + 1) : path;
  const origin = new URL(c.req.url).origin;
  const alternates = config.locales.map((l) => ({
    rel: "alternate",
    hreflang: l.locale,
    href: `${origin}/${l.segment}${rest}`,
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
