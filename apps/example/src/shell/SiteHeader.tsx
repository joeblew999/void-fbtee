// The site header, in the root layout: the pages, and void-fbtee's language picker, for someone
// who wants another language on purpose ("/" already sends each visitor to their own). The picker
// is one control however many languages the app has, and the package gives it no look: it's
// styled here, with the header's own classes. One row on desktop; on a phone the page links move
// to a second row that scrolls sideways.
import { fbs, fbt } from "fbtee";
import { routeUrl } from "void-fbtee/routes";
import { LanguagePicker, Link, useLocale } from "void-fbtee/react";
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
      return <fbt common>Home</fbt>;
    case "/[lang]/events":
      return <fbt common>Events</fbt>;
    case "/[lang]/docs":
      return <fbt common>Docs</fbt>;
  }
}

// nav-home, nav-events, nav-docs.
const testId = (page: (typeof PAGES)[number]) => `nav-${rest(page).slice(1) || "home"}`;

export default function SiteHeader() {
  const { path } = useLocale();
  // None on a page that's none of these, such as the not-found page for an unknown address.
  const current = PAGES.findLast((p) => (rest(p) === "" ? path === "" : path.startsWith(rest(p))));
  return (
    <header className="sticky top-0 z-40 border-b bg-background">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-2 px-4">
        <Link
          href={routeUrl("/[lang]")}
          className="flex h-14 items-center gap-2 pe-2 font-semibold"
        >
          {/* The site's icon (public/favicon.svg); the name beside it says what it is, so no alt. */}
          <img src="/favicon.svg" alt="" width={24} height={24} className="size-6" />
          void-fbtee
        </Link>
        <nav className="order-last -mx-4 flex w-[calc(100%+2rem)] gap-1 overflow-x-auto px-4 pb-2 md:order-none md:mx-0 md:w-auto md:overflow-visible md:p-0">
          {PAGES.map((page) => (
            <Link
              key={page}
              href={routeUrl(page)}
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
          <LanguagePicker
            label={fbs("Language", "The language picker in the site header, for screen readers")}
            placeholder={fbs("Search languages", "Placeholder of the language picker's search box")}
            yours={fbt("Your language", "Above the visitor's own languages in the language picker")}
            classNames={{
              root: "relative [&[data-yours-elsewhere]>summary]:text-brand",
              summary: cn(
                buttonVariants({ variant: "ghost", size: "sm" }),
                "cursor-pointer list-none text-foreground [&::-webkit-details-marker]:hidden",
              ),
              panel:
                "absolute end-0 top-full z-50 mt-1 max-h-[66vh] w-72 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-lg border bg-background p-2 shadow-lg",
              search:
                "mb-2 h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
              "yours-label": "px-2 pb-1 text-xs text-muted-foreground",
              yours: "mb-2 border-b pb-2",
              item: "flex items-baseline justify-between gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-muted data-[current]:underline data-[current]:decoration-brand data-[current]:decoration-2 data-[current]:underline-offset-4",
              "page-name": "text-xs text-muted-foreground",
            }}
          />
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
