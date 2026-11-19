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
  /** voidFbtee({ fallbackLocale }), checked: one of the app's languages. */
  fallbackLocale: string;
  /** voidFbtee({ redirectHome }): whether "/" sends each visitor to their own language. */
  redirectHome: boolean;
  /** The app's name, its package.json's, for AI Gateway's logs. */
  app?: string;
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
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    console.warn(
      `void-fbtee: no ${locale} translation for ${JSON.stringify(texts[hashKey] ?? hashKey)}`,
    );
  };
}

/** One lazy loader per translated locale; each resolves to { [locale]: fbtee's table }. */
export type CatalogLoaders = Record<string, () => Promise<{ default: TranslationDictionary }>>;

/** Catalog modules' tables as one, later ones winning. */
function merged(modules: Array<{ default: TranslationDictionary }>): TranslationDictionary {
  const all: TranslationDictionary = {};
  for (const m of modules) {
    Object.assign(all, m.default);
  }
  return all;
}

const availableLanguages = (config: Pick<RuntimeConfig, "locales">) =>
  new Map(config.locales.map((l) => [l.locale, l.locale]));

/** fbtee's setupLocaleContext options for a page in `locale` (the browser). */
export function localeContextOptions(
  config: Pick<RuntimeConfig, "sourceLocale" | "locales" | "fallbackLocales">,
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
 * A locale and its natural parents, as fbtee 6 makes them (lib/localeFallback.tsx
 * getLocaleHierarchy, not exported): its base name, its language with script and region, its
 * language with its likely script, and its bare language when that's the language's own script
 * (fr-CA → fr; zh-Hant-TW → zh-Hant, never zh, which is Hans).
 */
function hierarchy(locale: string): Array<string> {
  const out = new Set([locale]);
  try {
    const parsed = new Intl.Locale(locale);
    out.add(parsed.baseName);
    out.add([parsed.language, parsed.script, parsed.region].filter(Boolean).join("-"));
    const script = parsed.maximize().script;
    if (script) {
      out.add(`${parsed.language}-${script}`);
    }
    if (script === new Intl.Locale(parsed.language).maximize().script) {
      out.add(parsed.language);
    }
  } catch {
    // Not a locale Intl knows: only itself.
  }
  return [...out];
}

/**
 * A language's fallbacks, best first, as fbtee's own lookup tries them (fbtee 6
 * lib/localeFallback.tsx getLocaleFallbackChain, not exported), without the locale itself and the
 * source language, which callers add: its natural parents (fr-CA → fr), each with its own
 * fallbacks from `voidFbtee({ fallbackLocales })`, then the default ones. Some are fbtee's own
 * identities ("th-Thai") that name no catalog; callers keep only the ones the app has.
 */
/** fbtee's fallbacks as one list for every language, rather than a list per language. */
const isList = (fallbacks: FallbackLocales): fallbacks is ReadonlyArray<string> =>
  Array.isArray(fallbacks);

export function fallbacksOf(locale: string, fallbacks: FallbackLocales | undefined): Array<string> {
  const map: Readonly<Record<string, ReadonlyArray<string>>> =
    fallbacks && !isList(fallbacks) ? fallbacks : {};
  const result = new Set<string>();
  const append = (value: string) => {
    const added: Array<string> = [];
    for (const parent of hierarchy(value)) {
      if (!result.has(parent)) {
        result.add(parent);
        added.push(parent);
      }
    }
    for (const parent of added) {
      map[parent]?.forEach(append);
    }
  };
  append(locale);
  (fallbacks && isList(fallbacks) ? fallbacks : map.default)?.forEach(append);
  result.delete(locale);
  return [...result];
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
  return merged(modules);
}

/**
 * Every catalog, for runWithFbtee: fbtee picks each message's fallback from what it is given.
 * The catalog modules load once per server process; later requests reuse them.
 */
export async function allTranslations(catalogs: CatalogLoaders): Promise<TranslationDictionary> {
  const modules = await Promise.all(Object.values(catalogs).map((load) => load()));
  return merged(modules);
}
