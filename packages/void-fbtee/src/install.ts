// Installing the page's catalogs into fbtee in the browser, shared by the layout's I18nProvider
// and by islands (which hydrate without the layout). fbtee's own setupLocaleContext does it: it
// loads the locale's catalog and its fallback catalogs (de-AT -> de) and shares pending loads.
import { setupLocaleContext } from "fbtee";
import catalogs from "virtual:void-fbtee/catalogs";
import config from "virtual:void-fbtee/config";
import texts from "virtual:void-fbtee/texts";
import { field, textField } from "./guards";
import { isAppLocale, isLang, readMeta, type Dir } from "./locales";
import type { SharedI18n } from "./middleware/i18n";
import { localeContextOptions, reportMissing } from "./runtime";

/** A load React's `use()` can read the state of: pending, or fulfilled with its value (React's
 * convention for a promise it's given). */
type Tracked =
  | (Promise<void> & { status: "pending" })
  | (Promise<void> & { status: "fulfilled"; value: undefined });
const installed = new Map<string, Tracked>();
const missing = reportMissing(texts);

/**
 * Loads and installs a locale's catalogs, once per locale. The promise is marked fulfilled when
 * done (React's convention), so `use()` on it later returns at once instead of suspending.
 */
export function install(locale: string): Tracked {
  let ready = installed.get(locale);
  if (!ready) {
    // Dev only in the browser: production's missing strings are logged where they're rendered
    // first, on the server (server.ts, runIn).
    const onMissing = import.meta.env.DEV ? missing : undefined;
    // The source language's own catalog, when it has one (dev/catalogs.ts, sourceNeedsCatalog), is
    // given up front: fbtee's setupLocaleContext never loads a catalog for the source language
    // itself, though it reads one it's given.
    const source = catalogs[config.sourceLocale];
    const loading = (async () => {
      const translations = source ? (await source()).default : undefined;
      const context = setupLocaleContext({
        ...localeContextOptions(config, catalogs, locale, onMissing),
        ...(translations && { translations }),
      });
      await context.preloadLocale(locale);
    })().then(() => void Object.assign(p, { status: "fulfilled", value: undefined }));
    const p: Tracked = Object.assign(loading, { status: "pending" as const });
    ready = p;
    installed.set(locale, ready);
  }
  return ready;
}

/** The middleware's i18n data from the page's <meta name="void-fbtee">, in the browser. */
export function documentI18n(): SharedI18n | undefined {
  return sharedI18n(readMeta());
}

/** The middleware's i18n data, checked: from Void's shared data or the page's <meta>. */
export function sharedI18n(meta: unknown): SharedI18n | undefined {
  const locale = field(meta, "locale");
  const lang = field(meta, "lang");
  const dir = field(meta, "dir");
  const now = textField(meta, "now");
  const path = textField(meta, "path");
  if (!isAppLocale(config, locale) || !isLang(config, lang) || !isDir(dir)) {
    return;
  }
  if (now === undefined || path === undefined) {
    return;
  }
  return { locale, lang, dir, now, path };
}

const isDir = (value: unknown): value is Dir => value === "ltr" || value === "rtl";
