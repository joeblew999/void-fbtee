// Server only: the best configured locale for a browser's Accept-Language, by fbtee's own
// matching (setupLocaleContext's: exact locale, then language/script parents, then a region of
// the same language). Run in a throwaway fbtee scope so it never touches a request's state.
import { runWithFbtee, setupLocaleContext } from "fbtee/server";
import { acceptedLocales, availableLanguages, type RuntimeConfig } from "./runtime";

export function bestLocale(acceptLanguage: string | null | undefined, config: RuntimeConfig) {
  const { sourceLocale } = config;
  const best = runWithFbtee({ locale: sourceLocale, sourceLocale, translations: {} }, () =>
    setupLocaleContext({
      availableLanguages: availableLanguages(config),
      clientLocales: acceptedLocales(acceptLanguage),
      sourceLocale,
      loadLocale: async () => ({}),
    }).getLocale(),
  );
  return (
    config.locales.find((l) => l.locale === best) ??
    config.locales.find((l) => l.locale === sourceLocale)!
  );
}
