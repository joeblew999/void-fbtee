// SPIKE client provider. On the server the per-request fbtee state comes from
// AsyncLocalStorage (middleware/99.i18n.ts), so this renders children as-is.
// In the browser it suspends until the page's catalog is loaded, then installs
// it once, before any <fbt> below it renders. Hydration runs in a transition,
// so the suspend keeps the server HTML on screen (no English flash).
import { use, type ReactNode } from "react";
import { setupFbtee, IntlVariations } from "fbtee";
import { useShared } from "@void/react";

const loaders = import.meta.glob<Record<string, unknown>>("./translations/*.json", {
  import: "default",
});
const pending = new Map<string, Promise<void>>();

function install(locale: string): Promise<void> {
  let p = pending.get(locale);
  if (!p) {
    const load = loaders[`./translations/${locale}.json`];
    p = (load ? load() : Promise.resolve({})).then((table: Record<string, unknown>) => {
      setupFbtee({
        translations: table as never,
        hooks: { getViewerContext: () => ({ GENDER: IntlVariations.GENDER_UNKNOWN, locale }) },
      });
    });
    pending.set(locale, p);
  }
  return p as Promise<void>;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const { i18n } = useShared() as { i18n: { locale: string } };
  if (!import.meta.env.SSR) use(install(i18n.locale));
  return children;
}
