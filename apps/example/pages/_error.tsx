// Something broke while making a page, in the page's language, inside the site's layout (Void
// 1.8.0's _error). Void keeps the status and hides server details in production (they stay in the
// logs). "Try again" reruns the page's loader (useRouter().refresh(), which never repeats a form).
import { routeUrl } from "void-fbtee/routes";
import { fbs, fbt } from "fbtee";
import { useRouter, type ErrorPageProps } from "@void/react";
import { Link } from "void-fbtee/react";
import { Button, buttonVariants } from "@/ui/button";

export default function ErrorPage({ error }: ErrorPageProps) {
  const router = useRouter();
  return (
    <>
      {/* The tab's title in the page's language, as the other pages have it ("… · void-fbtee"):
          these components take no head(), so React's own <title> sets it (React 19). */}
      <title>{`${fbs("Something went wrong", "Heading of the page shown when the site failed to make a page")} · void-fbtee`}</title>
      <section className="grid max-w-xl gap-6 py-12" data-testid="error-page">
        <p className="text-muted-foreground font-mono text-sm" dir="ltr">
          {error.status}
        </p>
        <h1 className="text-3xl font-medium text-balance md:text-4xl">
          <fbt desc="Heading of the page shown when the site failed to make a page">
            Something went wrong
          </fbt>
        </h1>
        <p className="text-muted-foreground text-pretty">
          <fbt desc="Under the error heading: what to do">
            This page couldn't be made just now. Try again, or start from the home page.
          </fbt>
        </p>
        <div className="flex flex-wrap gap-3">
          <Button size="lg" onClick={() => router.refresh()}>
            <fbt desc="Button: load the page again after an error">Try again</fbt>
          </Button>
          <Link
            href={routeUrl("/[lang]")}
            className={buttonVariants({ size: "lg", variant: "outline" })}
          >
            <fbt common>Home</fbt>
          </Link>
        </div>
      </section>
    </>
  );
}
