// The locale table: URL segment <-> catalog locale <-> text direction. Pure functions, used on
// both the server (middleware) and in the browser (Link, provider).

export type Dir = "ltr" | "rtl";

/** One locale as the app configures it: a BCP 47 tag, optionally with its URL segment and direction. */
export type LocaleInput = string | { locale: string; segment?: string; dir?: Dir };

export interface Locale {
  /** BCP 47 tag, e.g. "th-TH". Also the catalog name: i18n/translations/th-TH.json. */
  locale: string;
  /** First URL path segment for this locale, e.g. "th-TH" in /th-TH/bookings. */
  segment: string;
  dir: Dir;
}

export interface LocaleConfig {
  sourceLocale: string;
  locales: Locale[];
}

const RTL_LANGUAGES = new Set(["ar", "fa", "he", "ur", "ps", "sd", "ug", "yi", "dv", "ckb"]);

/** The text direction of a locale, from Intl when the runtime knows it, else from its language. */
export function dirOf(locale: string): Dir {
  const info =
    (
      new Intl.Locale(locale) as Intl.Locale & {
        getTextInfo?: () => { direction?: string };
        textInfo?: { direction?: string };
      }
    ).getTextInfo?.() ??
    (new Intl.Locale(locale) as { textInfo?: { direction?: string } }).textInfo;
  if (info?.direction === "rtl" || info?.direction === "ltr") return info.direction;
  return RTL_LANGUAGES.has(new Intl.Locale(locale).language) ? "rtl" : "ltr";
}

export function resolveLocales(sourceLocale: string, inputs: LocaleInput[]): LocaleConfig {
  const locales = inputs.map((input) => {
    const entry = typeof input === "string" ? { locale: input } : input;
    const locale = Intl.getCanonicalLocales(entry.locale)[0]!;
    return { locale, segment: entry.segment ?? locale, dir: entry.dir ?? dirOf(locale) };
  });
  if (!locales.some((l) => l.locale === sourceLocale)) {
    throw new Error(`void-fbtee: sourceLocale "${sourceLocale}" is not in locales.`);
  }
  return { sourceLocale, locales };
}

/** The locale whose segment starts this path, e.g. "/th-TH/bookings" -> th-TH. */
export function localeFromPath(path: string, config: LocaleConfig): Locale | undefined {
  const segment = path.split("/")[1] ?? "";
  return config.locales.find((l) => l.segment === segment);
}

/** Name of the <meta> tag the middleware writes the page's i18n data into, for islands. */
export const META_NAME = "void-fbtee";
