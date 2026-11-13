// Not found, in the page's language, inside the site's layout (Void 1.8.0's _not-found): a URL that
// matches no page, and a page whose loader answers 404 (an event id that isn't one). Void keeps the
// 404 status. Two ways back, in the same language: the home page and the events.
import { routeUrl } from "void/routes";
import { fbt } from "fbtee";
import type { ErrorPageProps } from "@void/react";
import { Link, useLocale } from "void-fbtee/react";
import { buttonVariants } from "@/ui/button";

export default function NotFound({ error }: ErrorPageProps) {
  const { lang } = useLocale();
  return (
    <section className="grid max-w-xl gap-6 py-12" data-testid="not-found">
      <p className="text-muted-foreground font-mono text-sm" dir="ltr">
        {error.status}
      </p>
      <h1 className="text-3xl font-medium text-balance md:text-4xl">
        <fbt desc="Heading of the page shown for an address with nothing at it">
          There's nothing here
        </fbt>
      </h1>
      <p className="text-muted-foreground text-pretty">
        <fbt desc="Under the not-found heading: what happened and where to go">
          The link may be old, or the event may have been taken down. Try the events, or start from
          the home page.
        </fbt>
      </p>
      <div className="flex flex-wrap gap-3">
        <Link
          href={routeUrl("/[lang]/events", { params: { lang } })}
          className={buttonVariants({ size: "lg" })}
        >
          <fbt desc="Navigation: the list of events people post and book">Events</fbt>
        </Link>
        <Link
          href={routeUrl("/[lang]", { params: { lang } })}
          className={buttonVariants({ size: "lg", variant: "outline" })}
        >
          <fbt desc="Navigation: the home page">Home</fbt>
        </Link>
      </div>
    </section>
  );
}
