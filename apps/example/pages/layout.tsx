// The i18n provider sits above every page: <fbt> runs during each page's own render. Inside it,
// shadcn's direction for the page's language.
import type { ReactNode } from "react";
import { I18nProvider } from "void-fbtee/react";
import LocaleDirection from "@/components/LocaleDirection";
import "./style.css";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <I18nProvider>
      <LocaleDirection>
        <div className="mx-auto max-w-6xl px-4 py-6">{children}</div>
      </LocaleDirection>
    </I18nProvider>
  );
}
