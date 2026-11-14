// fbtee's runtime options from the app's config, for the browser (setupLocaleContext) and the
// server (runWithFbtee). fbtee does the work: loading a locale's fallback catalogs and falling
// back per message (de-AT -> de -> source text). This only hands it the app's locales and
// catalogs.
import type { FallbackLocales, LocaleContextProps, TranslationDictionary } from "fbtee";
import type { LocaleConfig } from "./locales";

/** The config the plugin hands the runtime (virtual:void-fbtee/config). */
export interface RuntimeConfig extends LocaleConfig {
  /** fbtee's own fallbackLocales option, passed through as is. */
  fallbackLocales?: FallbackLocales;
  /** voidFbtee({ site }): the site's own address, or none. */
  site?: string;
}

/**
 * fbtee's onMissingTranslation, logging each language's missing string once for as long as the
 * process (a Worker isolate, the browser tab) lives. fbtee reports once per runtime, and the server
 * makes one per request (runWithFbtee), so without this a busy page would log on every request.
 */
export function reportMissing(texts: Record<string, string>) {
  const seen = new Set<string>();
  return ({ locale, hashKey }: { locale: string; hashKey: string }) => {
    const key = `${locale} ${hashKey}`;
    if (seen.has(key)) return;
    seen.add(key);
    console.warn(
      `void-fbtee: no ${locale} translation for ${JSON.stringify(texts[hashKey] ?? hashKey)}`,
    );
  };
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

/** A language's fallbacks (`voidFbtee({ fallbackLocales })`, fbtee's option), best first. */
export function fallbacksOf(locale: string, fallbacks: FallbackLocales | undefined): string[] {
  if (!fallbacks) return [];
  return Array.isArray(fallbacks)
    ? [...fallbacks]
    : [...((fallbacks as Readonly<Record<string, readonly string[]>>)[locale] ?? [])];
}

/**
 * The catalogs text in one language can need, loaded: its own, its fallbacks', and the source
 * language's (which has one when it has more plural forms than the code writes). Not the rest,
 * so a part of a page in another language loads one language, not all of them.
 */
export async function translationsFor(
  catalogs: CatalogLoaders,
  locale: string,
  config: Pick<RuntimeConfig, "sourceLocale" | "fallbackLocales">,
): Promise<TranslationDictionary> {
  const wanted = new Set([
    locale,
    ...fallbacksOf(locale, config.fallbackLocales),
    config.sourceLocale,
  ]);
  const loads = [...wanted].flatMap((l) => (catalogs[l] ? [catalogs[l]()] : []));
  const modules = await Promise.all(loads);
  return Object.assign({}, ...modules.map((m) => m.default));
}

/**
 * Every catalog, for runWithFbtee: fbtee picks each message's fallback from what it is given.
 * The catalog modules load once per server process; later requests reuse them.
 */
export async function allTranslations(catalogs: CatalogLoaders): Promise<TranslationDictionary> {
  const modules = await Promise.all(Object.values(catalogs).map((load) => load()));
  return Object.assign({}, ...modules.map((m) => m.default));
}
