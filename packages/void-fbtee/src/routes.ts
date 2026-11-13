// Void's routeUrl (void/routes), with the language filled in: `routeUrl("/[lang]/events")` is the
// events page in the current language (the request's, inLocale()'s, or in the browser the page's).
// `params.lang` still picks another language. Typed against the app's routes as Void's is, so a
// page that doesn't exist, or a missing parameter other than lang, fails the type check.
//
// A markdown page has one route per language ("/en-US/docs/tour", "/th-TH/docs/tour"), not a
// [lang] pattern: `routeUrl("/[lang]/docs/tour")` takes it too, and type-checks only when the page
// exists in every language.
import {
  routeUrl as voidRouteUrl,
  type RouteOptions,
  type RoutePath,
  type RoutePathMap,
  type RouteQuery,
  type RouteUrl,
} from "void/routes";
import { currentLang } from "./current";
import type { Lang } from "./locales";

type ParamsOf<P extends RoutePath> = RoutePathMap[P] & string;
type OthersOf<P extends RoutePath> = Exclude<ParamsOf<P>, "lang">;

/** Void's RouteOptions, with `lang` optional among the params. */
export type LangRouteOptions<P extends RoutePath> = { query?: RouteQuery; hash?: string } & ([
  OthersOf<P>,
] extends [never]
  ? { params?: { lang?: Lang } }
  : { params: { [K in OthersOf<P>]: string | number } & { lang?: Lang } });

type Args<P extends RoutePath> =
  "lang" extends ParamsOf<P>
    ? [OthersOf<P>] extends [never]
      ? [options?: LangRouteOptions<P>]
      : [options: LangRouteOptions<P>]
    : [ParamsOf<P>] extends [never]
      ? [options?: RouteOptions<P>]
      : [options: RouteOptions<P>];

type MarkdownOptions = { query?: RouteQuery; hash?: string; params?: { lang?: Lang } };

/** A page's address, in the current language unless `params.lang` says otherwise. */
export function routeUrl<P extends RoutePath>(path: P, ...args: Args<NoInfer<P>>): RouteUrl;
/** A markdown page's address (a route per language), in the current language. */
export function routeUrl<R extends string>(
  path: `/[lang]${R}`,
  ...args: `/${Lang}${R}` extends RoutePath ? [options?: MarkdownOptions] : [options: never]
): RouteUrl;
export function routeUrl(
  path: string,
  options: { params?: Record<string, string | number> } = {},
): RouteUrl {
  if (!path.includes("[lang]")) return voidRouteUrl(path as RoutePath, options as never);
  const lang = options.params?.lang ?? currentLang();
  if (!lang)
    throw new Error(
      `void-fbtee: routeUrl("${path}"): no current language here (not in a request or inLocale()); pass params.lang`,
    );
  return voidRouteUrl(
    path as RoutePath,
    {
      ...options,
      params: { ...options.params, lang },
    } as never,
  );
}
