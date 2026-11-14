// The home page's sections after the first screen, as Void's own site (void.cloud) lays out its
// home: how to add it, what it does (each with its facts and the docs page that explains it), and
// a closing call. Every fact here is in the docs or the code; nothing is a claim made up for the page.
import { routeUrl } from "void-fbtee/routes";
import type { RouteUrl } from "void/routes";
import type { ReactNode } from "react";
import { fbt } from "fbtee";
import {
  ArrowLeftRight,
  ArrowRight,
  Bot,
  CalendarClock,
  FileText,
  Hash,
  Languages,
  Mail,
} from "lucide-react";
import { Link } from "void-fbtee/react";
import { buttonVariants } from "@/ui/button";
import { REPO, SETUP, SKILL, type Offsite } from "@/shell/project";
import { cn } from "@/ui/utils";

/** The install, as the README gives it, after the dependency is added to package.json. */
const COMMANDS = [
  "vp install",
  "vp exec void-fbtee init --locales ar-EG,th-TH",
  "vp install",
  "vp run i18n:translate",
];

/** A file name inside a sentence: kept whole and left to right, in any language. */
const file = (name: string) => (
  <bdi dir="ltr" className="whitespace-nowrap">
    {name}
  </bdi>
);

/** How to add it: the commands in a terminal window, beside a line on what they do. */
export function AddIt() {
  return (
    <section className="grid items-center gap-10 border-t py-16 lg:grid-cols-[1fr_1.1fr]">
      <div>
        <h2 className="text-3xl font-medium text-balance md:text-4xl">
          <fbt desc="Home page section heading: how to install void-fbtee">
            Add it to a Void app
          </fbt>
        </h2>
        <p className="mt-4 max-w-xl text-lg text-pretty text-muted-foreground">
          <fbt desc="Home page: what to do before running the install commands shown beside it; packageJson and workspace are file names">
            Add the GitHub release to the app's{" "}
            <fbt:param name="packageJson">{file("package.json")}</fbt:param> and allow its build in{" "}
            <fbt:param name="workspace">{file("pnpm-workspace.yaml")}</fbt:param>, then run these.
            init adds only what's missing, and translate fills in every language.
          </fbt>
        </p>
        <a
          href={SETUP}
          className="group mt-6 inline-flex items-center gap-2 font-medium text-brand"
        >
          <fbt desc="Home page link to the setup page of the docs">Read the full setup</fbt>
          <ArrowRight
            className="size-4 transition-transform duration-200 ease-out group-hover:translate-x-0.5 rtl:-scale-x-100 rtl:group-hover:-translate-x-0.5"
            aria-hidden
          />
        </a>
      </div>
      <figure className="overflow-hidden rounded-lg border bg-card shadow-[0_24px_60px_-24px_rgb(0_0_0/0.6)]">
        <figcaption className="border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
          <fbt desc="Caption of a window showing commands typed in a terminal">Terminal</fbt>
        </figcaption>
        {/* Long commands wrap with a hanging indent on a phone, so every one stays readable. */}
        <pre
          dir="ltr"
          className="p-5 font-mono text-xs leading-loose whitespace-pre-wrap sm:text-sm"
        >
          <code>
            {COMMANDS.map((c, i) => (
              <span key={i} className="block ps-[2ch] -indent-[2ch]">
                <span className="text-brand select-none">$ </span>
                {/* Whole words only: a break inside "ar-EG" would read as another command. */}
                {c.split(" ").map((word, j) => (
                  <span key={j}>
                    {j > 0 && " "}
                    <span className="whitespace-nowrap">{word}</span>
                  </span>
                ))}
              </span>
            ))}
          </code>
        </pre>
      </figure>
    </section>
  );
}

interface Feature {
  icon: ReactNode;
  title: ReactNode;
  facts: ReactNode[];
  /** What explains it: a page of this site, built by routeUrl (checked by Void's typed routes), or
   * void-fbtee's own docs (its skill, on GitHub). */
  href: RouteUrl | Offsite;
}

function features(): Feature[] {
  const icon = "size-5 text-brand";
  return [
    {
      icon: <Languages className={icon} aria-hidden />,
      title: <fbt desc="Home feature title: translated strings">Strings, by fbtee</fbt>,
      href: `${SKILL}#strings`,
      facts: [
        <fbt key="1" desc="Home feature fact about translated strings">
          Mark text with fbt in your components; each language gets a catalog file.
        </fbt>,
        <fbt key="2" desc="Home feature fact about plurals">
          Plurals follow each language's own rules: Arabic has six forms.
        </fbt>,
        <fbt key="3" desc="Home feature fact about the check command">
          void-fbtee check lists anything still untranslated.
        </fbt>,
      ],
    },
    {
      icon: <CalendarClock className={icon} aria-hidden />,
      title: <fbt desc="Home feature title: dates and times">Dates and times, by Temporal</fbt>,
      href: routeUrl("/[lang]/docs/tour"),
      facts: [
        <fbt key="1" desc="Home feature fact about times and time zones">
          Every time shown on its place's clock and on the reader's.
        </fbt>,
        <fbt key="2" desc="Home feature fact about daylight saving time">
          Daylight saving worked out for the date itself, not for today.
        </fbt>,
        <fbt key="3" desc="Home feature fact: Temporal runs natively on Cloudflare">
          Cloudflare's native Temporal on the Worker.
        </fbt>,
      ],
    },
    {
      icon: <Hash className={icon} aria-hidden />,
      title: (
        <fbt desc="Home feature title: numbers and other formats">
          Numbers and the rest, by Intl
        </fbt>
      ),
      href: routeUrl("/[lang]/docs/intl"),
      facts: [
        <fbt key="1" desc="Home feature fact about the Intl formats">
          Numbers, money, units, lists and names from the platform's own Intl.
        </fbt>,
        <fbt key="2" desc="Home feature fact: the same calls run on the server and in the browser">
          The same calls on the Worker and in the browser; the Intl page shows where engines differ.
        </fbt>,
        <fbt key="3" desc="Home feature fact: no locale data in the app's bundle">
          No locale data to ship: the platform has it.
        </fbt>,
      ],
    },
    {
      icon: <FileText className={icon} aria-hidden />,
      title: (
        <fbt desc="Home feature title: translated markdown pages">Markdown pages, translated</fbt>
      ),
      href: `${SKILL}#markdown-pages`,
      facts: [
        <fbt key="1" desc="Home feature fact about where translated markdown pages are">
          One copy of each page per language, under pages/ and the language.
        </fbt>,
        <fbt key="2" desc="Home feature fact about out-of-date translated pages">
          A copy is reported out of date when its original changes.
        </fbt>,
        <fbt key="3" desc="Home feature fact about dates and numbers inside markdown pages">
          Dates and numbers in a page are formatted for each reader.
        </fbt>,
      ],
    },
    {
      icon: <Bot className={icon} aria-hidden />,
      title: (
        <fbt desc="Home feature title: machine translation">Translated by AI, checked by you</fbt>
      ),
      href: SKILL,
      facts: [
        <fbt key="1" desc="Home feature fact about the translate command (vp run i18n:translate)">
          vp run i18n:translate hands the work to Claude Code, with void-fbtee's skill.
        </fbt>,
        <fbt key="2" desc="Home feature fact: translations are files in the app's repository">
          Translations are files in your repo, ready to review.
        </fbt>,
      ],
    },
    {
      icon: <ArrowLeftRight className={icon} aria-hidden />,
      title: (
        <fbt desc="Home feature title: right-to-left languages">
          Every language, right to left too
        </fbt>
      ),
      href: `${SKILL}#strings`,
      facts: [
        <fbt
          key="1"
          desc="Home feature fact: the middleware sets the page's language and direction"
        >
          The middleware sets the page's lang and dir from the URL.
        </fbt>,
        <fbt key="2" desc="Home feature fact about one address per language for search engines">
          One URL per language, with hreflang links for search engines.
        </fbt>,
        <fbt key="3" desc="Home feature fact: this site mirrors in Arabic">
          This site mirrors in Arabic, built with start and end, never left and right.
        </fbt>,
      ],
    },
    {
      icon: <Mail className={icon} aria-hidden />,
      title: (
        <fbt desc="Home feature title: emails in each recipient's language">
          Emails in each person's language
        </fbt>
      ),
      href: routeUrl("/[lang]/docs/emails"),
      facts: [
        <fbt
          key="1"
          desc="Home feature fact: an email is in its recipient's language, not in the language of whoever caused it"
        >
          Each person gets theirs in their own language, whoever caused it.
        </fbt>,
        <fbt key="2" desc="Home feature fact: Arabic emails read right to left in Gmail">
          Arabic reads right to left in Gmail too.
        </fbt>,
        <fbt
          key="3"
          desc="Home feature fact: in development, Void's inbox catches the emails, so tests can read them"
        >
          In development, Void's inbox catches them, so tests can read them.
        </fbt>,
      ],
    },
  ];
}

/** What it does: seven features in a ruled grid, each with its facts and the docs page on it. */
export function Features() {
  return (
    <section className="border-t py-16">
      <h2 className="max-w-2xl text-3xl font-medium text-balance md:text-4xl">
        <fbt desc="Home page section heading over the list of features">
          Everything a Void app needs to speak every language
        </fbt>
      </h2>
      {/* 1px rules between cells at any column count: the grid's colour shows through 1px gaps. */}
      <div className="mt-10 grid gap-px border-y bg-border sm:grid-cols-2 lg:grid-cols-3">
        {features().map((f, i) => (
          // Seven: the last is alone in its row at two columns and at three, so it fills it.
          <article key={i} className="flex flex-col bg-background p-6 sm:last:col-span-full">
            {f.icon}
            <h3 className="mt-4 text-lg font-medium">{f.title}</h3>
            <ul className="mt-3 flex-1 space-y-2 text-sm text-muted-foreground">
              {f.facts.map((fact, i) => (
                <li key={i} className="flex gap-2">
                  <span className="mt-2 size-1 shrink-0 rounded-full bg-brand" aria-hidden />
                  <span className="text-pretty">{fact}</span>
                </li>
              ))}
            </ul>
            <MoreLink
              href={f.href}
              className="group mt-5 inline-flex items-center gap-2 text-sm font-medium text-brand"
            >
              <fbt desc="Home page: link from a feature to the docs page about it">Read more</fbt>
              <ArrowRight
                className="size-4 transition-transform duration-200 ease-out group-hover:translate-x-0.5 rtl:-scale-x-100 rtl:group-hover:-translate-x-0.5"
                aria-hidden
              />
            </MoreLink>
          </article>
        ))}
      </div>
    </section>
  );
}

/** A page of this site through void-fbtee's Link; void-fbtee's own docs, off the site, as a plain link. */
function MoreLink({
  href,
  ...props
}: {
  href: RouteUrl | Offsite;
  className: string;
  children: ReactNode;
}) {
  return href.startsWith("https://") ? (
    <a href={href} {...props} />
  ) : (
    <Link href={href} {...props} />
  );
}

/** The two ways in, used in the first screen's style at the end of the page. */
export function GitHubButton({ className }: { className?: string }) {
  return (
    <a
      href={REPO}
      className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-11 px-5", className)}
    >
      <fbt desc="Button: open void-fbtee's code on GitHub">View on GitHub</fbt>
    </a>
  );
}

/** The close: the claim again, and the way to start. */
export function Closing() {
  return (
    <section className="border-t pt-20 pb-12">
      <h2 className="text-4xl font-medium text-balance md:text-5xl">
        <fbt common>i18n for Void apps</fbt>
      </h2>
      <div className="mt-8 flex flex-wrap gap-3">
        <a href={SETUP} className={cn(buttonVariants({ size: "lg" }), "h-11 gap-2 px-5")}>
          <fbt desc="Button: start with the setup page of the docs">Get started</fbt>
          <ArrowRight className="rtl:-scale-x-100" aria-hidden />
        </a>
        <GitHubButton />
      </div>
    </section>
  );
}
