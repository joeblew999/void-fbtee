// Installing a locale's catalog into fbtee in the browser, shared by the layout's I18nProvider
// and by islands (which hydrate without the layout).
import { setupFbtee, IntlVariations } from "fbtee";
import catalogs from "virtual:void-fbtee/catalogs";
import config from "virtual:void-fbtee/config";
import texts from "virtual:void-fbtee/texts";
import { META_NAME } from "./locales";
import type { SharedI18n } from "./middleware";

type Tracked = Promise<void> & { status?: "pending" | "fulfilled"; value?: void };
const installed = new Map<string, Tracked>();

/**
 * Loads a locale's catalog and installs it, once per locale. The promise is marked fulfilled
 * when done (React's convention), so `use()` on it later returns at once instead of suspending.
 */
export function install(locale: string): Tracked {
  let ready = installed.get(locale);
  if (!ready) {
    const load = catalogs[locale];
    const p: Tracked = (load ? load().then((m) => m.default) : Promise.resolve({})).then(
      (translations) => {
        setupFbtee({
          translations: translations as never,
          sourceLocale: config.sourceLocale,
          hooks: { getViewerContext: () => ({ GENDER: IntlVariations.GENDER_UNKNOWN, locale }) },
          // Dev only: name each string this page shows untranslated (fbtee reports each once).
          onMissingTranslation: import.meta.env.DEV
            ? ({ hashKey }) =>
                console.warn(
                  `void-fbtee: no ${locale} translation for ${JSON.stringify(texts[hashKey] ?? hashKey)}`,
                )
            : undefined,
        });
        p.status = "fulfilled";
      },
    );
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
