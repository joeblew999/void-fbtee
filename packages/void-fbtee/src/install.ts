// Installing the page's catalogs into fbtee in the browser, shared by the layout's I18nProvider
// and by islands (which hydrate without the layout). fbtee's own setupLocaleContext does it: it
// loads the locale's catalog and its fallback catalogs (de-AT -> de) and shares pending loads.
import { setupLocaleContext } from "fbtee";
import catalogs from "virtual:void-fbtee/catalogs";
import config from "virtual:void-fbtee/config";
import texts from "virtual:void-fbtee/texts";
import { readMeta } from "./locales";
import type { SharedI18n } from "./middleware";
import { localeContextOptions, reportMissing } from "./runtime";

type Tracked = Promise<void> & { status?: "pending" | "fulfilled"; value?: void };
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
    // The source language's own catalog, when it has one (catalogs.ts, sourceNeedsCatalog), is
    // given up front: fbtee's setupLocaleContext never loads a catalog for the source language
    // itself, though it reads one it's given.
    const source = catalogs[config.sourceLocale];
    const p: Tracked = (async () => {
      const translations = source ? (await source()).default : undefined;
      const context = setupLocaleContext({
        ...localeContextOptions(config, catalogs, locale, onMissing),
        ...(translations && { translations }),
      });
      await context.preloadLocale(locale);
    })().then(() => {
      p.status = "fulfilled";
    });
    p.status = "pending";
    ready = p;
    installed.set(locale, ready);
  }
  return ready;
}

/** The middleware's i18n data from the page's <meta name="void-fbtee">, in the browser. */
export function documentI18n(): SharedI18n | undefined {
  return readMeta<SharedI18n>();
}
