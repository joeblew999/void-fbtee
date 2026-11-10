// The i18n provider sits above every page: <fbt> runs during each page's own render.
import type { ReactNode } from "react";
import { I18nProvider } from "void-fbtee/react";

export default function Layout({ children }: { children: ReactNode }) {
  return <I18nProvider>{children}</I18nProvider>;
}
