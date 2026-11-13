// The root layout, around every page (markdown pages too): void-fbtee's provider
// (<fbt> runs during each page's own render), and the site's header and footer.
import { useEffect, type ReactNode } from "react";
import { I18nProvider } from "void-fbtee/react";
import SiteFooter from "@/shell/SiteFooter";
import SiteHeader from "@/shell/SiteHeader";
import "./style.css";

/**
 * Marks the page as started in the browser (`<html data-hydrated="true">`): the sign the tests wait
 * for before they use it, as voidzero-dev/void's playgrounds give theirs (its TESTING.md).
 */
function Started() {
  useEffect(() => {
    document.documentElement.dataset.hydrated = "true";
  }, []);
  return null;
}

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <I18nProvider>
      <Started />
      <div className="flex min-h-svh flex-col">
        <SiteHeader />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
        <SiteFooter />
      </div>
    </I18nProvider>
  );
}
