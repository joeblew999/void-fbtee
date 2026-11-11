// The home page: translated strings with fbtee (a plural, a list in a sentence), and a line that
// arrives after the shell (a defer() read), which must render in the page's language too.
import { Suspense, use } from "react";
import { fbt, list } from "fbtee";
import { Link, useLocale, useLocales } from "void-fbtee/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Props } from "./index.server";

// fbtee's list(), joined to plain text first. A list inside a string (<fbt:list>, or list() in an
// <fbt:param>) renders as one text on the server but as separate pieces in the browser, so
// hydration fails (seen with fbtee 5.0.0; plan #1, Upstream).
// oxlint-disable-next-line no-base-to-string
const listText = (items: string[]) => String(list(items));

function Slow({ late }: { late: Props["late"] }) {
  const { count } = use(late);
  return (
    <p data-testid="deferred">
      <fbt desc="Text rendered from deferred loader data">
        Deferred:{" "}
        <fbt:plural count={count} many="nights" showCount="yes">
          night
        </fbt:plural>{" "}
        left
      </fbt>
    </p>
  );
}

/** The example's pages, as cards. */
function Pages() {
  const { locale } = useLocale();
  const cards = [
    {
      href: `/${locale}/formats`,
      title: <fbt desc="Home card title: the formats page">Formats</fbt>,
      text: (
        <fbt desc="Home card text: what the formats page shows">
          Every Intl format, run on the Worker and in your browser, side by side.
        </fbt>
      ),
    },
    {
      href: `/${locale}/about`,
      title: <fbt desc="Home card title: the page made of islands">Islands</fbt>,
      text: (
        <fbt desc="Home card text: what the islands page shows">
          A static page whose interactive parts hydrate on their own, in the page's language.
        </fbt>
      ),
    },
    {
      href: `/${locale}/docs`,
      title: <fbt desc="Home card title: the documentation">Docs</fbt>,
      text: (
        <fbt desc="Home card text: what the docs show">
          Markdown pages, translated into every language.
        </fbt>
      ),
    },
  ];
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {cards.map((c) => (
        <Link key={c.href} href={c.href as never} className="group">
          <Card className="h-full transition-colors group-hover:bg-muted/50">
            <CardHeader>
              <CardTitle>{c.title}</CardTitle>
              <CardDescription>{c.text}</CardDescription>
            </CardHeader>
          </Card>
        </Link>
      ))}
    </div>
  );
}

export default function HomePage({ count, late }: Props) {
  // Each language named in its own language: "English", "العربية", "ไทย".
  const names = useLocales().map((l) =>
    new Intl.DisplayNames(l.locale, { type: "language" }).of(new Intl.Locale(l.locale).language)!,
  );
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl" data-testid="title">
            <fbt desc="Home page heading">i18n for Void apps</fbt>
          </CardTitle>
          <CardDescription data-testid="intro">
            <fbt desc="Home page introduction; languages is a list of language names">
              Strings by fbtee, dates by Temporal, and everything else by the platform's own Intl.
              This example is in <fbt:param name="languages">{listText(names)}</fbt:param>.
            </fbt>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <p data-testid="plural">
            <fbt desc="How many nights are booked">
              You booked{" "}
              <fbt:plural count={count} many="nights" showCount="yes">
                night
              </fbt:plural>
            </fbt>
          </p>
          <Suspense fallback={<p>…</p>}>
            <Slow late={late} />
          </Suspense>
        </CardContent>
      </Card>
      <Pages />
    </div>
  );
}
