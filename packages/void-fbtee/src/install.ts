// Installing the page's catalogs into fbtee in the browser, shared by the layout's I18nProvider
// and by islands (which hydrate without the layout). fbtee's own setupLocaleContext does it: it
// loads the locale's catalog and its fallback catalogs (de-AT -> de) and shares pending loads.
import { setupLocaleContext } from "fbtee";
import catalogs from "virtual:void-fbtee/catalogs";
import config from "virtual:void-fbtee/config";
import texts from "virtual:void-fbtee/texts";
import { META_NAME } from "./locales";
import type { SharedI18n } from "./middleware";
import { localeContextOptions } from "./runtime";

type Tracked = Promise<void> & { status?: "pending" | "fulfilled"; value?: void };
const installed = new Map<string, Tracked>();

/**
 * Loads and installs a locale's catalogs, once per locale. The promise is marked fulfilled when
 * done (React's convention), so `use()` on it later returns at once instead of suspending.
 */
export function install(locale: string): Tracked {
  let ready = installed.get(locale);
  if (!ready) {
    // Dev only: name each string this page shows untranslated (fbtee reports each once).
    const onMissing = import.meta.env.DEV
      ? ({ hashKey }: { hashKey: string }) =>
          console.warn(
            `void-fbtee: no ${locale} translation for ${JSON.stringify(texts[hashKey] ?? hashKey)}`,
          )
      : undefined;
    const context = setupLocaleContext(localeContextOptions(config, catalogs, locale, onMissing));
    const p: Tracked = context.preloadLocale(locale).then(() => {
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
  if (typeof document === "undefined") return;
  const content = document.querySelector<HTMLMetaElement>(`meta[name="${META_NAME}"]`)?.content;
  return content ? (JSON.parse(content) as SharedI18n) : undefined;
}
