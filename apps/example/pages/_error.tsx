// Something broke while making a page, in the page's language, inside the site's layout (Void
// 1.8.0's _error). Void keeps the status and hides server details in production (they stay in the
// logs). "Try again" reruns the page's loader (useRouter().refresh(), which never repeats a form).
import { routeUrl } from "void-fbtee/routes";
import { fbs, fbt } from "fbtee";
import { useRouter, type ErrorPageProps } from "@void/react";
import { Link } from "void-fbtee/react";
import { Button, buttonVariants } from "@/ui/button";
import { ErrorShell } from "@/shell/ErrorShell";

export default function ErrorPage({ error }: ErrorPageProps) {
  const router = useRouter();
  return (
    <ErrorShell
      testId="error-page"
      status={error.status}
      heading={fbs(
        "Something went wrong",
        "Heading of the page shown when the site failed to make a page",
      )}
      text={
        <fbt desc="Under the error heading: what to do">
          This page couldn't be made just now. Try again, or start from the home page.
        </fbt>
      }
    >
      <Button size="lg" onClick={() => router.refresh()}>
        <fbt desc="Button: load the page again after an error">Try again</fbt>
      </Button>
      <Link
        href={routeUrl("/[lang]")}
        className={buttonVariants({ size: "lg", variant: "outline" })}
      >
        <fbt common>Home</fbt>
      </Link>
    </ErrorShell>
  );
}
