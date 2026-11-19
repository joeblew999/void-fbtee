// The locale table: URL segment <-> catalog locale <-> text direction. Pure functions, used on
// both the server (middleware) and in the browser (Link, provider).

import { parseJson } from "./guards";

export type Dir = "ltr" | "rtl";

// What runtimes have that TypeScript's own types don't: a locale's text direction, as
// `getTextInfo()` (the current proposal) or `textInfo` (the earlier one). Neither is everywhere.
declare global {
  // oxlint-disable-next-line typescript/no-namespace
  namespace Intl {
    interface Locale {
      getTextInfo?(): { direction?: string };
      readonly textInfo?: { direction?: string };
    }
  }
}

/** One locale as the app configures it: a BCP 47 tag, optionally with its URL segment and direction. */
export type LocaleInput = string | { locale: string; segment?: string; dir?: Dir };

/**
 * The app's languages, as types. The app registers its list once, where it's defined, so a URL
 * built from the page's language is checked by Void's typed routes like any other:
 *
 *   export const locales = ["en-US", "ar-EG", "th-TH"] as const;
 *   declare global {
 *     interface VoidFbteeRegister { locales: typeof locales }
 *   }
 *
 * The same list goes to voidFbtee({ locales }). Unregistered, a language is any string. A global
 * interface, as Void does for its generated bindings (packages/void/src/runtime/handler.ts): the
 * package's built types move a module's interface into a shared chunk, where augmenting the
 * module can't reach it.
 */
declare global {
  // oxlint-disable-next-line no-empty-interface
  interface VoidFbteeRegister {}
}

type SegmentOf<L> = L extends string
  ? L
  : L extends { segment: infer S extends string }
    ? S
    : L extends { locale: infer T extends string }
      ? T
      : never;

/** A language's URL segment ("th-TH" in /th-TH/events): one of the registered languages. */
export type Lang = VoidFbteeRegister extends { locales: readonly (infer L)[] }
  ? SegmentOf<L>
  : string;

type TagOf<L> = L extends string ? L : L extends { locale: infer T extends string } ? T : never;

/** A language's BCP 47 tag ("th-TH"): one of the registered languages, as inLocale() takes it. */
export type AppLocale = VoidFbteeRegister extends { locales: readonly (infer L)[] }
  ? TagOf<L>
  : string;

export interface Locale {
  /** BCP 47 tag, e.g. "th-TH". Also the catalog name: i18n/translations/th-TH.json. */
  locale: AppLocale;
  /** First URL path segment for this locale, e.g. "th-TH" in /th-TH/bookings. */
  segment: Lang;
  dir: Dir;
}

export interface LocaleConfig {
  sourceLocale: string;
  locales: Locale[];
}

const RTL_LANGUAGES = new Set(["ar", "fa", "he", "ur", "ps", "sd", "ug", "yi", "dv", "ckb"]);

/**
 * The attributes for an element holding text in a language of its own, such as what a person
 * posted, in the language they wrote it in: `lang`, so browsers, screen readers and search engines
 * read it as that language, and `dir`, so Arabic posted on an English page reads right to left
 * (W3C, "Inline markup and bidirectional text in HTML"). `<h1 {...langAttrs(event.locale)}>`.
 */
export function langAttrs(locale: string): { lang: string; dir: Dir } {
  return { lang: locale, dir: dirOf(locale) };
}

/** The text direction of a locale, from Intl when the runtime knows it, else from its language. */
export function dirOf(locale: string): Dir {
  const intl = new Intl.Locale(locale);
  const info = intl.getTextInfo?.() ?? intl.textInfo;
  if (info?.direction === "rtl" || info?.direction === "ltr") return info.direction;
  return RTL_LANGUAGES.has(new Intl.Locale(locale).language) ? "rtl" : "ltr";
}

export function resolveLocales(sourceLocale: string, inputs: readonly LocaleInput[]): LocaleConfig {
  // The list as the app wrote it, which its register gives the types of (VoidFbteeRegister): a tag
  // or segment in it is one of the app's. Checked against it, not assumed.
  const entries = inputs.map((input) => (typeof input === "string" ? { locale: input } : input));
  const tags = new Set(entries.map((e) => e.locale));
  const segments = new Set(entries.map((e) => e.segment ?? e.locale));
  const isTag = (s: string): s is AppLocale => tags.has(s);
  const isSegment = (s: string): s is Lang => segments.has(s);
  const locales = entries.map((entry): Locale => {
    const locale = Intl.getCanonicalLocales(entry.locale)[0]!;
    // Written as its canonical form, or the app's types and its URLs would name another spelling.
    const spelling = `void-fbtee: locale "${entry.locale}" is written "${locale}": write it so in locales.`;
    if (!isTag(locale)) throw new Error(spelling);
    const segment = entry.segment ?? locale;
    if (!isSegment(segment)) throw new Error(`void-fbtee: no segment for "${locale}".`);
    return { locale, segment, dir: entry.dir ?? dirOf(locale) };
  });
  if (!locales.some((l) => l.locale === sourceLocale)) {
    throw new Error(`void-fbtee: sourceLocale "${sourceLocale}" is not in locales.`);
  }
  return { sourceLocale, locales };
}

/** The source language: the one the app is written in. */
export const sourceOf = (config: LocaleConfig): Locale =>
  config.locales.find((l) => l.locale === config.sourceLocale)!;

/** Every language but the source: the ones translated into. */
export const translatedOf = (config: LocaleConfig): Locale[] =>
  config.locales.filter((l) => l.locale !== config.sourceLocale);

/** The locale whose segment starts this path, e.g. "/th-TH/bookings" -> th-TH. */
export function localeFromPath(path: string, config: LocaleConfig): Locale | undefined {
  const segment = path.split("/")[1] ?? "";
  return config.locales.find((l) => l.segment === segment);
}

/** Name of the <meta> tag the middleware writes the page's i18n data into, for islands. */
export const META_NAME = "void-fbtee";

/** The page's <meta name="void-fbtee"> data, in the browser, for a check to read; undefined on the
 * server or without it. */
export function readMeta(): unknown {
  if (typeof document === "undefined") return;
  const content = document.querySelector<HTMLMetaElement>(`meta[name="${META_NAME}"]`)?.content;
  return content ? parseJson(content) : undefined;
}

/** One of the app's URL segments, by its language list. */
export const isLang = (config: LocaleConfig, value: unknown): value is Lang =>
  config.locales.some((l) => l.segment === value);

/** One of the app's languages, by its list. */
export const isAppLocale = (config: LocaleConfig, value: unknown): value is AppLocale =>
  config.locales.some((l) => l.locale === value);
