// The site header, in the root layout: the pages, and this page in every language, each named in
// its own language (Intl.DisplayNames). Plain links, so crawlers find every language version, and
// no JavaScript, so it works on markdown pages too. One row on desktop; on a phone the
// page links move to a second row that scrolls sideways.
import { fbt } from "fbtee";
import { routeUrl } from "void/routes";
import { Formatted, Link, useLocale, useLocales } from "void-fbtee/react";
import { buttonVariants } from "@/ui/button";
import { REPO } from "@/shell/project";
import { cn } from "@/ui/utils";

// The pages, as Void routes: each link is built by routeUrl, so a route that doesn't exist fails
// the type check.
const PAGES = ["/[lang]", "/[lang]/events", "/[lang]/docs"] as const;
// The part after the language, to tell which page is current ("" for the home page).
const rest = (page: (typeof PAGES)[number]) => page.slice("/[lang]".length);

function label(page: (typeof PAGES)[number]) {
  switch (page) {
    case "/[lang]":
      return <fbt desc="Navigation: the home page">Home</fbt>;
    case "/[lang]/events":
      return <fbt desc="Navigation: the list of events people post and book">Events</fbt>;
    case "/[lang]/docs":
      return <fbt desc="Navigation: the documentation">Docs</fbt>;
  }
}

// nav-home, nav-events, nav-docs.
const testId = (page: (typeof PAGES)[number]) => `nav-${rest(page).slice(1) || "home"}`;

export default function SiteHeader() {
  const { locale, lang, path } = useLocale();
  const locales = useLocales();
  // None on a page that's none of these, such as the not-found page for an unknown address.
  const current = PAGES.findLast((p) => (rest(p) === "" ? path === "" : path.startsWith(rest(p))));
  return (
    <header className="sticky top-0 z-40 border-b bg-background">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-2 px-4">
        <Link
          href={routeUrl("/[lang]", { params: { lang } })}
          className="flex h-14 items-center pe-2 font-semibold"
        >
          void-fbtee
        </Link>
        <nav className="order-last -mx-4 flex w-[calc(100%+2rem)] gap-1 overflow-x-auto px-4 pb-2 md:order-none md:mx-0 md:w-auto md:overflow-visible md:p-0">
          {PAGES.map((page) => (
            <Link
              key={page}
              href={routeUrl(page, { params: { lang } })}
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
              // This page in another language: the one link whose page is known only at run time,
              // so Void's types can't check it. Every [lang] page exists in every language, and
              // void-fbtee check fails if a markdown page lacks a copy in one.
              href={`/${l.segment}${path}`}
              hrefLang={l.locale}
              lang={l.locale}
              aria-current={l.locale === locale ? "true" : undefined}
              className={cn(
                buttonVariants({ variant: "ghost", size: "sm" }),
                l.locale === locale
                  ? "text-foreground underline decoration-brand decoration-2 underline-offset-8"
                  : "text-muted-foreground",
              )}
              data-testid={`to-${l.locale}`}
            >
              <Formatted>
                {new Intl.DisplayNames(l.locale, { type: "language" }).of(
                  new Intl.Locale(l.locale).language,
                )!}
              </Formatted>
            </Link>
          ))}
          <a
            href={REPO}
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "ms-2 border-s ps-4 text-muted-foreground",
            )}
          >
            GitHub
          </a>
        </div>
      </div>
    </header>
  );
}
