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
// - Zod's validation messages follow the request's language (when the app has Zod 4).
import { defineMiddleware } from "void";
import { runWithFbtee } from "fbtee/server";
import { Temporal } from "temporal-polyfill";
import config from "virtual:void-fbtee/config";
import catalogs from "virtual:void-fbtee/catalogs";
import { matchedRoutes } from "virtual:void-fbtee/hono-route";
import markdownPages from "virtual:void-fbtee/md-pages";
import { meta, type MetaTag } from "./head";
import { localeFromPath, META_NAME, type Dir, type Lang } from "./locales";
import { allTranslations } from "./runtime";
import { setup as setupZod } from "virtual:void-fbtee/zod";
import { currentLocale, siteOrigin, withLang } from "./server";

// Zod's own validation messages (a form's errors) in each request's language, when the app has
// Zod 4 (plugin.ts, zodMessages).
setupZod(currentLocale);

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

/** The markdown page at this path, from @void/md's list (a trailing slash makes no difference). */
function markdownPage(path: string) {
  const want = path.replace(/\/+$/, "") || "/";
  return markdownPages.find((p) => (p.path.replace(/\/+$/, "") || "/") === want);
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
  const page: { link: { rel: string; href: string }[]; meta: MetaTag[] } = found
    ? {
        link: [{ rel: "canonical", href: `${origin}/${found.segment}${rest}` }],
        meta: [
          { property: "og:locale", content: found.locale.replace("-", "_") },
          { property: "og:url", content: `${origin}/${found.segment}${rest}` },
        ],
      }
    : { link: [], meta: [] };
  // A markdown page's title and description for link previews: Void puts its frontmatter's into
  // <title> and description only (packages/void/src/router/compile.ts), and a markdown page has no
  // head() of its own. A code page's come from its head() (pageHead from void-fbtee/head).
  const markdown = found && markdownPage(path);
  if (markdown) {
    const { title, description } = markdown.frontmatter;
    page.meta.push(
      ...meta({
        ogTitle: typeof title === "string" ? title : undefined,
        ogDescription: typeof description === "string" ? description : undefined,
      }),
    );
  }
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
  // The request's language for fbtee, and for routeUrl from void-fbtee/routes (server.ts).
  const response = await withLang(current.segment, () =>
    runWithFbtee({ locale: current.locale, sourceLocale, fallbackLocales, translations }, () =>
      madeUp ? c.notFound() : next(),
    ),
  );
  // A copy of the site at another address (a Worker Preview, the dev server): kept out of search
  // results, so it never competes with the site itself. Only when the app names its site.
  if (config.site && new URL(c.req.url).origin !== config.site) c.header("X-Robots-Tag", "noindex");
  return response;
});

export default middleware;
