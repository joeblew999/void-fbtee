// The language picker's list (LanguagePicker in react.tsx): names,
// order, search and the visitor's own languages. Apart from React and the app's modules, so it's
// tested on its own.
import { negotiateLocale } from "./negotiate";
import type { Locale } from "./locales";

export interface LanguageEntry extends Locale {
  /** The language named in itself. */
  name: string;
  /** The language named in the page's language. */
  pageName: string;
  /** Both names and its codes, folded, for the search box. */
  search: string;
}

/**
 * Every language the app has, named in itself and in the page's language, in the page
 * language's order. Named by its language subtag where the app has one variant of it (`th`, not
 * `th-TH`, which Intl names "ไทย (ไทย)"), by its whole tag where it has several (`en-GB`, `en-US`).
 */
export function languageEntries(
  locales: readonly Locale[],
  page: string,
  names?: Readonly<Record<string, string>>,
): LanguageEntry[] {
  const language = (l: string) => new Intl.Locale(l).language;
  const variants = (l: string) => locales.filter((o) => language(o.locale) === language(l)).length;
  const named = (l: string, inLocale: string) => {
    const tag = variants(l) > 1 ? l : language(l);
    return new Intl.DisplayNames(inLocale, { type: "language", fallback: "code" }).of(tag) ?? l;
  };
  const collator = new Intl.Collator(page);
  return locales
    .map((l) => {
      const name = names?.[l.locale] ?? named(l.locale, l.locale);
      const pageName = l.locale === page ? name : named(l.locale, page);
      return {
        ...l,
        name,
        pageName,
        search: normalize([name, pageName, l.locale, l.segment].join(" ")),
      };
    })
    .sort((a, b) => collator.compare(a.pageName, b.pageName));
}

/** The visitor's own languages the app has, best first, by fbtee's rule; no fallback. */
export function visitorsOwn(locales: readonly string[], visitor = navigator.languages): string[] {
  const own: string[] = [];
  for (const l of visitor) {
    const found = negotiateLocale(l, locales);
    if (found && !own.includes(found)) own.push(found);
  }
  return own;
}

/** Lower case, without accents: "Español" and "espanol" match. */
export function normalize(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase();
}
