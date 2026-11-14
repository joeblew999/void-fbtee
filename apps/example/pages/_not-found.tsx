// Not found, in the page's language, inside the site's layout (Void 1.8.0's _not-found): a URL that
// matches no page, and a page whose loader answers 404 (an event id that isn't one). Void keeps the
// 404 status. Two ways back, in the same language: the home page and the events.
import { routeUrl } from "void-fbtee/routes";
import { fbs, fbt } from "fbtee";
import type { ErrorPageProps } from "@void/react";
import { Link } from "void-fbtee/react";
import { buttonVariants } from "@/ui/button";
import { ErrorShell } from "@/shell/ErrorShell";

export default function NotFound({ error }: ErrorPageProps) {
  return (
    <ErrorShell
      testId="not-found"
      status={error.status}
      heading={fbs(
        "There's nothing here",
        "Heading of the page shown for an address with nothing at it",
      )}
      text={
        <fbt desc="Under the not-found heading: what happened and where to go">
          The link may be old, or the event may have been taken down. Try the events, or start from
          the home page.
        </fbt>
      }
    >
      <Link href={routeUrl("/[lang]/events")} className={buttonVariants({ size: "lg" })}>
        <fbt common>Events</fbt>
      </Link>
      <Link
        href={routeUrl("/[lang]")}
        className={buttonVariants({ size: "lg", variant: "outline" })}
      >
        <fbt common>Home</fbt>
      </Link>
    </ErrorShell>
  );
}
