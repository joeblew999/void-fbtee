// The root layout, around every page (markdown pages too): void-fbtee's provider
// (<fbt> runs during each page's own render), and the site's header and footer.
import type { ReactNode } from "react";
import { I18nProvider } from "void-fbtee/react";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import "./style.css";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <I18nProvider>
      <div className="flex min-h-svh flex-col">
        <SiteHeader />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
        <SiteFooter />
      </div>
    </I18nProvider>
  );
}
