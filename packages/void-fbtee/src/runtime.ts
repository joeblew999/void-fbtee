// fbtee's runtime options from the app's config, for the browser (setupLocaleContext) and the
// server (runWithFbtee). fbtee does the work: loading a locale's fallback catalogs, falling back
// per message (de-AT -> de -> source text) and matching locales. This only hands it the app's
// locales and catalogs.
import type { FallbackLocales, LocaleContextProps, TranslationDictionary } from "fbtee";
import type { LocaleConfig } from "./locales";

/** The config the plugin hands the runtime (virtual:void-fbtee/config). */
export interface RuntimeConfig extends LocaleConfig {
  /** fbtee's own fallbackLocales option, passed through as is. */
  fallbackLocales?: FallbackLocales;
}

/** One lazy loader per translated locale; each resolves to { [locale]: fbtee's table }. */
export type CatalogLoaders = Record<string, () => Promise<{ default: TranslationDictionary }>>;

const availableLanguages = (config: RuntimeConfig) =>
  new Map(config.locales.map((l) => [l.locale, l.locale]));

/** fbtee's setupLocaleContext options for a page in `locale` (the browser). */
export function localeContextOptions(
  config: RuntimeConfig,
  catalogs: CatalogLoaders,
  locale: string,
  onMissingTranslation?: LocaleContextProps["onMissingTranslation"],
): LocaleContextProps {
  return {
    availableLanguages: availableLanguages(config),
    clientLocales: [locale],
    sourceLocale: config.sourceLocale,
    fallbackLocales: config.fallbackLocales,
    onMissingTranslation,
    loadLocale: async (l) => (await catalogs[l]?.())?.default[l] ?? {},
  };
}

/**
 * Every catalog, for runWithFbtee: fbtee picks each message's fallback from what it is given.
 * The catalog modules load once per server process; later requests reuse them.
 */
export async function allTranslations(catalogs: CatalogLoaders): Promise<TranslationDictionary> {
  const modules = await Promise.all(Object.values(catalogs).map((load) => load()));
  return Object.assign({}, ...modules.map((m) => m.default));
}

/** The tags of an Accept-Language header, most wanted first. */
export function acceptedLocales(header: string | null | undefined): string[] {
  return (header ?? "")
    .split(",")
    .map((part, i) => {
      const [tag = "", ...params] = part.trim().split(";");
      const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
      return { tag: tag.trim(), q: q ? Number(q.slice(2)) : 1, i };
    })
    .filter((w) => w.tag && w.tag !== "*" && w.q > 0)
    .sort((a, b) => b.q - a.q || a.i - b.i)
    .map((w) => w.tag);
}

export { availableLanguages };
