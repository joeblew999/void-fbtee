// Where you are in the events pages: "Events › Post an event", "Events › <an event's title>".
// "Events" goes back to the list; the last part is this page. Right to left in Arabic, with the
// arrow turned to match.
import type { ReactNode } from "react";
import { routeUrl } from "void-fbtee/routes";
import { fbs, fbt } from "fbtee";
import { ChevronRight } from "lucide-react";
import { langAttrs, Link, useLocale } from "void-fbtee/react";

export function EventsCrumbs({ children, lang }: { children: ReactNode; lang?: string }) {
  const { lang: page } = useLocale();
  return (
    <nav
      aria-label={fbs("Where you are", "Label of the row showing where you are on the site")}
      className="text-muted-foreground text-sm"
      data-testid="events-crumbs"
    >
      <ol className="flex flex-wrap items-center gap-1.5">
        <li>
          <Link
            href={routeUrl("/[lang]/events", { params: { lang: page } })}
            className="hover:text-foreground"
            data-testid="crumb-events"
          >
            <fbt common>Events</fbt>
          </Link>
        </li>
        <li aria-hidden>
          <ChevronRight className="size-3.5 rtl:-scale-x-100" />
        </li>
        <li aria-current="page" className="text-foreground" {...(lang && langAttrs(lang))}>
          {children}
        </li>
      </ol>
    </nav>
  );
}
