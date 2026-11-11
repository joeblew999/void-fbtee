// The site header, in the root layout: the pages, and this page in every language, each named in
// its own language (Intl.DisplayNames). Plain links, so crawlers find every language version, and
// no JavaScript, so it works on island and markdown pages too. One row on desktop; on a phone the
// page links move to a second row that scrolls sideways.
import { fbt } from "fbtee";
import { Link, useLocale, useLocales } from "void-fbtee/react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const PAGES = ["", "/formats", "/about", "/docs"] as const;

function label(page: (typeof PAGES)[number]) {
  switch (page) {
    case "":
      return <fbt desc="Navigation: the home page">Home</fbt>;
    case "/formats":
      return <fbt desc="Navigation: the page that shows every Intl format">Formats</fbt>;
    case "/about":
      return <fbt desc="Navigation: the page made of islands">Islands</fbt>;
    case "/docs":
      return <fbt desc="Navigation: the documentation">Docs</fbt>;
  }
}

const testId = (page: string) => `nav-${page.slice(1) || "home"}`;

export default function SiteHeader() {
  const { locale, path } = useLocale();
  const locales = useLocales();
  const current = PAGES.findLast((p) => (p === "" ? path === "" : path.startsWith(p))) ?? "";
  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-2 px-4">
        <Link
          href={`/${locale}` as never}
          className="flex h-14 items-center pe-2 font-semibold tracking-tight"
        >
          void-fbtee
        </Link>
        <nav className="order-last -mx-4 flex w-[calc(100%+2rem)] gap-1 overflow-x-auto px-4 pb-2 md:order-none md:mx-0 md:w-auto md:overflow-visible md:p-0">
          {PAGES.map((page) => (
            <Link
              key={page}
              href={`/${locale}${page}` as never}
              aria-current={page === current ? "page" : undefined}
              className={cn(
                buttonVariants({ variant: page === current ? "secondary" : "ghost", size: "sm" }),
                "shrink-0",
              )}
              data-testid={testId(page)}
            >
              {label(page)}
            </Link>
          ))}
        </nav>
        <div className="ms-auto flex h-14 items-center gap-1">
          {locales.map((l) => (
            <Link
              key={l.locale}
              href={`/${l.segment}${path}` as never}
              hrefLang={l.locale}
              lang={l.locale}
              aria-current={l.locale === locale ? "true" : undefined}
              className={buttonVariants({
                variant: l.locale === locale ? "outline" : "ghost",
                size: "sm",
              })}
              data-testid={`to-${l.locale}`}
            >
              {new Intl.DisplayNames(l.locale, { type: "language" }).of(
                new Intl.Locale(l.locale).language,
              )}
            </Link>
          ))}
        </div>
      </div>
    </header>
  );
}
