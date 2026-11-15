// The Components page, a reference: everything void-fbtee/react gives an app's pages, each with
// what it's for, the piece at work where it shows something, and a line of the app that uses it.
// The language picker is shown twice, styled two ways, since its look is the app's.
import { fbs, fbt, useFbt } from "fbtee";
import { routeUrl } from "void-fbtee/routes";
import {
  Formatted,
  InLanguage,
  LanguagePicker,
  Link,
  useHydrated,
  useLocale,
  useLocales,
  useNow,
  useTimeZone,
} from "void-fbtee/react";
import type { ReactNode } from "react";
import { DocsPage } from "@/docs/DocsPage";
import { Section } from "@/docs/Points";

/** One of void-fbtee's pieces: its name (code: left to right), why, at work, and its use. */
function Piece({
  name,
  why,
  file,
  line,
  children,
}: {
  name: string;
  why: ReactNode;
  file: string;
  line: string;
  children?: ReactNode;
}) {
  return (
    <div
      id={name}
      className="scroll-mt-20 space-y-2 rounded-lg border p-4"
      data-testid={`component-${name}`}
    >
      <h3 className="font-mono text-sm font-medium" dir="ltr">
        {name}
      </h3>
      <p className="text-sm text-muted-foreground">{why}</p>
      {children && (
        <div className="rounded-md bg-muted/50 p-3 text-sm" data-testid={`component-${name}-demo`}>
          {children}
        </div>
      )}
      <div className="font-mono text-xs" dir="ltr">
        <div className="text-muted-foreground">{file}</div>
        <code className="break-all">{line}</code>
      </div>
    </div>
  );
}

/** Inside <InLanguage>: this runtime's fbt, so it's in that language. */
function Booked() {
  const { fbt } = useFbt();
  return (
    <fbt desc="Strings page: said to the reader right after they book a seat at an event, and it means: you have a seat now. Short, like the English">
      You're booked.
    </fbt>
  );
}

/** The second look for the picker: a row of pills, open at once below, no search box styling. */
const PILLS = {
  root: "w-full",
  summary:
    "inline-flex cursor-pointer list-none items-center rounded-full border px-3 py-1 text-sm [&::-webkit-details-marker]:hidden",
  panel: "mt-3 flex flex-wrap gap-2",
  search: "w-full rounded-full border px-3 py-1 text-sm",
  "yours-label": "w-full text-xs text-muted-foreground",
  yours: "flex w-full flex-wrap gap-2",
  list: "flex flex-wrap gap-2",
  item: "inline-flex gap-1 rounded-full border px-3 py-1 text-sm data-[current]:border-brand data-[current]:bg-brand/10",
  "page-name": "text-muted-foreground",
} as const;

export default function ComponentsPage() {
  const { locale, dir, path } = useLocale();
  const locales = useLocales();
  const hydrated = useHydrated();
  const now = useNow({ updateInterval: 60_000 });
  const zone = useTimeZone();
  const others = locales.filter((l) => l.locale !== locale);
  const sections = [
    {
      id: "components",
      title: <fbt common>Components</fbt>,
    },
    {
      id: "picker",
      title: (
        <fbt desc="Components page section title: the language picker, styled two ways">
          The language picker, two looks
        </fbt>
      ),
    },
    {
      id: "hooks",
      title: <fbt desc="Components page section title: the React hooks">Hooks</fbt>,
    },
  ];
  return (
    <DocsPage
      testId="components-title"
      title={<fbt common>Components</fbt>}
      intro={
        <fbt desc="Components page introduction">
          Everything void-fbtee gives an app's pages, from void-fbtee/react: its components and
          hooks, what each is for, each at work, and the line that uses it.
        </fbt>
      }
      sections={sections}
    >
      <Section id={sections[0].id} title={sections[0].title}>
        <Piece
          name="I18nProvider"
          why={
            <fbt desc="Components page: I18nProvider goes once in the root layout and makes every page's strings work">
              Goes once around the app, in the root layout, so every page's strings are in its
              language from the first render.
            </fbt>
          }
          file="pages/layout.tsx"
          line="<I18nProvider>"
        />
        <Piece
          name="Link"
          why={
            <fbt desc="Components page: Link keeps the page's language in the address it links to">
              Void's link, with the page's language in the address it goes to.
            </fbt>
          }
          file="src/shell/SiteFooter.tsx"
          line='<Link href={routeUrl("/[lang]/events")} className={linkClass}>'
        >
          <Link href={routeUrl("/[lang]/events")} className="underline" data-testid="demo-link">
            <fbt common>Events</fbt>
          </Link>
        </Piece>
        <Piece
          name="Formatted"
          why={
            <fbt desc="Components page: Formatted holds text the server formatted, so the browser keeps it">
              Text formatted while rendering, such as a date, kept as the server wrote it, since
              each browser formats a little differently.
            </fbt>
          }
          file="pages/[lang]/index.tsx"
          line="<Formatted>{languageName(locale)}</Formatted>"
        >
          <Formatted data-testid="demo-formatted">
            {new Intl.DateTimeFormat(locale, { dateStyle: "full" }).format(
              new Date("2026-07-04T12:00:00Z"),
            )}
          </Formatted>
        </Piece>
        <Piece
          name="InLanguage"
          why={
            <fbt desc="Components page: InLanguage shows part of a page in another language">
              Part of a page in another language, with its own lang and direction, and worded by the
              reader's gender where the language needs it.
            </fbt>
          }
          file="src/docs/StringPieces.tsx"
          line="<InLanguage locale={locale} gender={gender}>"
        >
          <ul className="space-y-1" data-testid="demo-in-language">
            {others.map((l) => (
              <li key={l.locale}>
                <InLanguage locale={l.locale}>
                  <Booked />
                </InLanguage>
              </li>
            ))}
          </ul>
        </Piece>
        <Piece
          name="LanguagePicker"
          why={
            <fbt desc="Components page: the language picker is one control for any number of languages, with no look of its own">
              One control for choosing another language, however many the app has: the reader's own
              first, then every language, with a search box. It has no look of its own: the app
              gives it one.
            </fbt>
          }
          file="src/shell/SiteHeader.tsx"
          line="<LanguagePicker"
        />
      </Section>
      <Section id={sections[1].id} title={sections[1].title}>
        <p className="text-muted-foreground">
          <fbt desc="Components page: the same picker, styled two ways, to show its look is the app's">
            The same component twice, with different class names: the header's look, and a row of
            pills. Its order, names, links and search are the package's; how it looks is the app's.
          </fbt>
        </p>
        <div className="flex justify-end rounded-lg border p-3" data-testid="picker-header-look">
          <LanguagePicker
            label={fbs("Language", "The language picker in the site header, for screen readers")}
            placeholder={fbs("Search languages", "Placeholder of the language picker's search box")}
            yours={fbt("Your language", "Above the visitor's own languages in the language picker")}
            classNames={{
              root: "relative",
              summary:
                "inline-flex cursor-pointer list-none items-center rounded-md px-2.5 py-1 text-sm hover:bg-muted [&::-webkit-details-marker]:hidden",
              panel:
                "absolute end-0 top-full z-10 mt-1 max-h-72 w-72 overflow-y-auto rounded-lg border bg-background p-2 shadow-lg",
              search: "mb-2 h-8 w-full rounded-lg border px-2.5 text-sm",
              "yours-label": "px-2 pb-1 text-xs text-muted-foreground",
              yours: "mb-2 border-b pb-2",
              item: "flex items-baseline justify-between gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-muted data-[current]:underline",
              "page-name": "text-xs text-muted-foreground",
            }}
          />
        </div>
        <div className="rounded-lg border p-3" data-testid="picker-pills-look">
          <LanguagePicker
            label={fbs("Language", "The language picker in the site header, for screen readers")}
            placeholder={fbs("Search languages", "Placeholder of the language picker's search box")}
            yours={fbt("Your language", "Above the visitor's own languages in the language picker")}
            classNames={PILLS}
          />
        </div>
      </Section>
      <Section id={sections[2].id} title={sections[2].title}>
        <Piece
          name="useLocale"
          why={
            <fbt desc="Components page: useLocale gives the page's language, direction and address">
              The page's language, its direction, and the address after the language.
            </fbt>
          }
          file="src/shell/SiteHeader.tsx"
          line="const { path } = useLocale();"
        >
          <code dir="ltr" className="break-all" data-testid="demo-use-locale">
            {JSON.stringify({ locale, dir, path })}
          </code>
        </Piece>
        <Piece
          name="useLocales"
          why={
            <fbt desc="Components page: useLocales gives every language the app has, from its settings">
              Every language the app has, from its settings: never a list of its own.
            </fbt>
          }
          file="pages/[lang]/docs/right-to-left.tsx"
          line="const locales = useLocales();"
        >
          <code dir="ltr" className="break-all" data-testid="demo-use-locales">
            {locales.map((l) => l.locale).join(", ")}
          </code>
        </Piece>
        <Piece
          name="useHydrated"
          why={
            <fbt desc="Components page: useHydrated is false on the server and while hydrating, then true">
              False on the server and while the page starts, true after: for what only the browser
              knows, so the first render matches the server's.
            </fbt>
          }
          file="pages/[lang]/events/[id].tsx"
          line="const hydrated = useHydrated();"
        >
          <code dir="ltr" className="break-all" data-testid="demo-use-hydrated">
            {String(hydrated)}
          </code>
        </Piece>
        <Piece
          name="useNow"
          why={
            <fbt desc="Components page: useNow gives the current moment, the server's at first, then the browser's clock">
              Now: the server's moment at first, so both render the same, then the browser's clock.
            </fbt>
          }
          file="src/docs/Fmt.tsx"
          line="const now = useNow({ updateInterval: 60_000 });"
        >
          <Formatted data-testid="demo-use-now">
            {now.toZonedDateTimeISO(zone ?? "UTC").toLocaleString(locale, {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </Formatted>
        </Piece>
        <Piece
          name="useTimeZone"
          why={
            <fbt desc="Components page: useTimeZone gives the reader's own time zone, once the browser knows it">
              The reader's own time zone, once the browser knows it; none on the server.
            </fbt>
          }
          file="src/events/EventTime.tsx"
          line="const reader = useTimeZone();"
        >
          <code dir="ltr" className="break-all" data-testid="demo-use-time-zone">
            {zone ?? "—"}
          </code>
        </Piece>
        <Piece
          name="useForm"
          why={
            <fbt desc="Components page: useForm is Void's form with the page's language in its address">
              Void's form, posting to the address in the page's language, so its answer and errors
              are too.
            </fbt>
          }
          file="pages/[lang]/events/new.tsx"
          line='const form = useForm("/[lang]/events/new", {'
        />
        <Piece
          name="langAttrs"
          why={
            <fbt desc="Components page: langAttrs marks text in another language with its lang and direction">
              lang and dir for text in a language other than the page's, such as what people post.
            </fbt>
          }
          file="pages/[lang]/events/[id].tsx"
          line="<bdi {...langAttrs(event.locale)}>{event.venue}</bdi>"
        />
      </Section>
    </DocsPage>
  );
}
