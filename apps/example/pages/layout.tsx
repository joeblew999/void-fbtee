// The i18n provider must sit above every page: <fbt> runs during the page's
// own render, so a provider inside the page would be too late.
import type { ReactNode } from "react";
import { I18nProvider } from "../i18n/provider";

export default function Layout({ children }: { children: ReactNode }) {
  return <I18nProvider>{children}</I18nProvider>;
}
