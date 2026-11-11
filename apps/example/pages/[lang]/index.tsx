// The home page: the claim, the fbtee code of one line beside what it renders on this page, and
// the example's pages. Translated strings with fbtee (a plural, a list in a sentence), and a line
// that arrives after the shell (a defer() read), which must render in the page's language too.
import { Suspense, use, useState } from "react";
import { fbt, list } from "fbtee";
import { ArrowRight } from "lucide-react";
import { Link, useLocale, useLocales } from "void-fbtee/react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AddIt, Closing, Features, GitHubButton } from "@/components/HomeSections";
import type { Props } from "./index.server";

// fbtee's list(), joined to plain text first. A list inside a string (<fbt:list>, or list() in an
// <fbt:param>) renders as one text on the server but as separate pieces in the browser, so
// hydration fails (seen with fbtee 5.0.0; plan #1, Upstream).
// oxlint-disable-next-line no-base-to-string
const listText = (items: string[]) => String(list(items));

/** The code of the plural below (the formatter keeps it on fewer lines there), wrapped to fit a
 * phone's width: what it takes to translate a line. */
const CODE = `<fbt desc="How many nights are booked">
  You booked{" "}
  <fbt:plural
    count={count}
    many="nights"
    showCount="yes"
  >
    night
  </fbt:plural>
</fbt>`;

/** CODE, coloured as Void's site colours its code: tags in the accent, attribute names plain, strings and expressions
    muted. Enough for this one snippet, not a general highlighter. */
const TOKEN = /(<\/?[\w:]+|\/?>)|(\w+)(?==)|("[^"]*")|(\{[^}]*\})/g;
function Highlighted({ code }: { code: string }) {
  const parts = [];
  let last = 0;
  for (const m of code.matchAll(TOKEN)) {
    parts.push(code.slice(last, m.index));
    const color = m[1] ? "text-brand" : m[2] ? "text-foreground" : "text-muted-foreground";
    parts.push(
      <span key={m.index} className={color}>
        {m[0]}
      </span>,
    );
    last = m.index + m[0].length;
  }
  parts.push(code.slice(last));
  return <code>{parts}</code>;
}

/** The files in the code window: the line's code, the plugin that turns it on, and one of the
    catalogs it produces (each an excerpt of the real file). */
const FILES = [
  { name: "index.tsx", code: CODE },
  {
    name: "vite.config.ts",
    code: `import voidFbtee from "void-fbtee/vite";

export default defineConfig({
  plugins: [
    voidFbtee({
      sourceLocale: "en-US",
      locales: ["en-US", "ar-EG", "th-TH"],
    }),
    voidPlugin(),
  ],
});`,
  },
  {
    name: "th-TH.json",
    code: `"d20AdENCUCFEupNI3bkyqg==": {
  "description": "How many nights are booked",
  "status": "translated",
  "translations": [
    { "translation": "คุณจองไว้ {number} คืน" }
  ]
}`,
  },
];

/** A language's name in its own language: "English", "العربية", "ไทย". */
const languageName = (locale: string) =>
  new Intl.DisplayNames(locale, { type: "language" }).of(new Intl.Locale(locale).language)!;

function Slow({ late }: { late: Props["late"] }) {
  const { count } = use(late);
  return (
    <p data-testid="deferred" className="text-muted-foreground">
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

/** The code window: the line's fbtee code, and below it the line as this page renders it. */
function CodeWindow({ count, late }: Props) {
  const { locale } = useLocale();
  const [open, setOpen] = useState(0);
  return (
    <figure className="overflow-hidden rounded-lg border bg-card shadow-[0_24px_60px_-24px_rgb(0_0_0/0.6)]">
      <figcaption className="flex items-center justify-between border-b">
        <div role="tablist" dir="ltr" className="flex min-w-0 flex-1 overflow-x-auto">
          {FILES.map((f, i) => (
            <button
              key={f.name}
              type="button"
              role="tab"
              id={`file-${i}`}
              aria-selected={i === open}
              aria-controls="file-code"
              tabIndex={i === open ? 0 : -1}
              onClick={() => setOpen(i)}
              onKeyDown={(e) => {
                // The tabs pattern: one Tab stop, the arrow keys move between the files.
                const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
                if (!step) return;
                e.preventDefault();
                const next = (i + step + FILES.length) % FILES.length;
                setOpen(next);
                document.getElementById(`file-${next}`)?.focus();
              }}
              className={cn(
                "shrink-0 border-e px-4 py-2.5 font-mono text-xs transition-colors duration-150 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
                i === open
                  ? "bg-background/60 text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {f.name}
            </button>
          ))}
        </div>
        <span className="hidden shrink-0 px-4 text-xs text-muted-foreground sm:inline">
          {languageName(locale)}
        </span>
      </figcaption>
      <pre
        id="file-code"
        role="tabpanel"
        aria-labelledby={`file-${open}`}
        dir="ltr"
        className="min-h-72 overflow-x-auto p-5 font-mono text-sm leading-relaxed [scrollbar-color:var(--border)_transparent]"
      >
        <Highlighted code={FILES[open]!.code} />
      </pre>
      <div className="border-t bg-muted/40 p-5">
        {/* A fixed height: switching language changes the words, never the layout around them. */}
        <div className="min-h-16 space-y-1">
          <p className="text-2xl font-medium" data-testid="plural">
            <fbt desc="How many nights are booked">
              You booked{" "}
              <fbt:plural count={count} many="nights" showCount="yes">
                night
              </fbt:plural>
            </fbt>
          </p>
          <Suspense fallback={<p className="text-muted-foreground">…</p>}>
            <Slow late={late} />
          </Suspense>
        </div>
      </div>
    </figure>
  );
}

/** The first screen: the claim and the way into the demo, beside the code window. */
function Hero(props: Props) {
  const { locale } = useLocale();
  const names = useLocales().map((l) => languageName(l.locale));
  return (
    <section className="grid items-center gap-12 py-10 md:py-20 lg:grid-cols-[1fr_1.1fr]">
      <div>
        <h1
          className="text-5xl leading-[1.05] font-medium text-balance md:text-6xl"
          data-testid="title"
        >
          <fbt desc="Home page heading">i18n for Void apps</fbt>
        </h1>
        <p className="mt-6 max-w-xl text-lg text-pretty text-muted-foreground" data-testid="intro">
          <fbt desc="Home page introduction; languages is a list of language names">
            Strings by fbtee, dates by Temporal, and everything else by the platform's own Intl.
            This example is in <fbt:param name="languages">{listText(names)}</fbt:param>.
          </fbt>
        </p>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            href={`/${locale}/events` as never}
            className={cn(buttonVariants({ size: "lg" }), "h-11 gap-2 px-5")}
            data-testid="try-demo"
          >
            <fbt desc="Home page button: open the events app, the live demo">
              Try the events demo
            </fbt>
            <ArrowRight className="rtl:-scale-x-100" aria-hidden />
          </Link>
          <Link
            href={`/${locale}/docs` as never}
            className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-11 px-5")}
          >
            <fbt desc="Navigation: the documentation">Docs</fbt>
          </Link>
          <GitHubButton />
        </div>
      </div>
      <CodeWindow {...props} />
    </section>
  );
}

/** The example's other pages, in a ruled grid: what each is, and the way in. */
function Pages() {
  const { locale } = useLocale();
  const pages = [
    {
      href: `/${locale}/events`,
      title: <fbt desc="Home card title: the events app">Events</fbt>,
      text: (
        <fbt desc="Home card text: what the events app shows">
          Post an event, book a seat: every time on the event's clock and on yours.
        </fbt>
      ),
    },
    {
      href: `/${locale}/docs/formats`,
      title: <fbt desc="Home card title: the formats page">Formats</fbt>,
      text: (
        <fbt desc="Home card text: what the formats page shows">
          Every Intl format, run on the Worker and in your browser, side by side.
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
    <section className="grid border-y sm:grid-cols-3">
      {pages.map((p) => (
        <Link
          key={p.href}
          href={p.href as never}
          className="group border-b p-6 transition-colors duration-200 last:border-b-0 hover:bg-muted/50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring sm:border-e sm:border-b-0 sm:last:border-e-0"
        >
          <h2 className="flex items-center justify-between text-xl font-medium">
            {p.title}
            <ArrowRight
              className="size-5 text-brand transition-transform duration-200 ease-out group-hover:translate-x-1 rtl:-scale-x-100 rtl:group-hover:-translate-x-1"
              aria-hidden
            />
          </h2>
          <p className="mt-3 text-pretty text-muted-foreground">{p.text}</p>
        </Link>
      ))}
    </section>
  );
}

export default function HomePage(props: Props) {
  return (
    <div>
      <Hero {...props} />
      <AddIt />
      <Features />
      <Pages />
      <Closing />
    </div>
  );
}
