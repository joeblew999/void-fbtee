// The language of whatever is running now, for code that builds an address without being told
// it (routeUrl from void-fbtee/routes): on the server, the request's (the middleware) or
// inLocale()'s; in the browser, the page's. The server registers its source when its module loads
// (server.ts), so nothing here imports node:async_hooks, and the browser can load it.
import type { TranslationDictionary } from "fbtee";
import { readMeta, type Lang } from "./locales";

let serverLang: (() => Lang | undefined) | undefined;

/** The server's source of the current language (server.ts, once). */
export function setServerLang(source: () => Lang | undefined): void {
  serverLang = source;
}

let serverTranslations: (() => TranslationDictionary | undefined) | undefined;

/** The server's source of the current request's catalogs (server.ts, once). */
export function setServerTranslations(source: () => TranslationDictionary | undefined): void {
  serverTranslations = source;
}

/**
 * The catalogs the server is rendering with now (the request's, or inLocale()'s), for a part of the
 * page in another language (<InLanguage>). Undefined in the browser and outside a request.
 */
export function currentTranslations(): TranslationDictionary | undefined {
  return serverTranslations?.();
}

/** The current language's URL segment, or undefined where there is none (no request, no inLocale). */
export function currentLang(): Lang | undefined {
  const fromServer = serverLang?.();
  if (fromServer) return fromServer;
  // The page's own i18n data, as islands read it (install.ts, documentI18n).
  return readMeta<{ lang: Lang }>()?.lang;
}
