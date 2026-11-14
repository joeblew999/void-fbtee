// The Right-to-left page, a reference: one address per language, and the same markup shown both
// ways round (written with start and end, never left and right), and what it takes, with the lines
// that do it.
import { fbt } from "fbtee";
import { ChevronRight } from "lucide-react";
import type { RouteUrl } from "void/routes";
import { langAttrs } from "void-fbtee/locales";
import { Link, useLocale, useLocales } from "void-fbtee/react";
import { PageSections } from "@/docs/PageSections";
import { Points, Section, SkillLink, type Point } from "@/docs/Points";

function points(): Point[] {
  return [
    {
      id: "direction",
      title: (
        <fbt desc="Right-to-left page point title: the page's language and direction">
          The page's language and direction
        </fbt>
      ),
      why: (
        <fbt desc="Right-to-left page point: void-fbtee's middleware sets the page's lang and dir from the URL, and links to the page in every language">
          void-fbtee's middleware reads the language from the address, sets lang and dir on the
          page, and lists the same page in every language for search engines (hreflang).
        </fbt>
      ),
      code: [
        { file: "middleware/99.i18n.ts", line: 'export { default } from "void-fbtee/middleware";' },
      ],
    },
    {
      id: "start-end",
      title: (
        <fbt desc="Right-to-left page point title: start and end instead of left and right">
          Start and end, never left and right
        </fbt>
      ),
      why: (
        <fbt desc="Right-to-left page point: spacing and alignment are written as start and end, so the same markup mirrors; arrows that point a way are flipped">
          Spacing and alignment are written as start and end, so the same markup mirrors by itself
          in Arabic, as in the boxes above. An icon that points a way is flipped.
        </fbt>
      ),
      code: [
        {
          file: "src/shell/SiteHeader.tsx",
          line: '<div className="ms-auto flex h-14 items-center gap-1">',
        },
        {
          file: "src/events/EventsCrumbs.tsx",
          line: '<ChevronRight className="size-3.5 rtl:-scale-x-100" />',
        },
      ],
    },
    {
      id: "mixed",
      title: (
        <fbt desc="Right-to-left page point title: text in another language than the page">
          Text in another language
        </fbt>
      ),
      why: (
        <fbt desc="Right-to-left page point: text in another language than the page is marked with its own language and direction, so it reads the right way round">
          What people post is in their language, not the page's. It's marked with its own language
          and direction, with void-fbtee's langAttrs, so an English title on an Arabic page, or an
          Arabic one on an English page, reads the right way round.
        </fbt>
      ),
      code: [
        {
          file: "pages/[lang]/events/[id].tsx",
          line: "<bdi {...langAttrs(event.locale)}>{event.venue}</bdi>",
        },
      ],
    },
    {
      id: "ltr",
      title: (
        <fbt desc="Right-to-left page point title: what is always left to right">
          What stays left to right
        </fbt>
      ),
      why: (
        <fbt desc="Right-to-left page point: code, commands and web addresses read left to right in every language, so they are marked so">
          Code, commands and web addresses read left to right in every language. In a right-to-left
          page their parts would come out reversed, so they're marked left to right.
        </fbt>
      ),
      code: [
        {
          file: "src/home/HomeSections.tsx",
          line: '<bdi dir="ltr" className="whitespace-nowrap">',
        },
      ],
    },
  ];
}

/** Two events' titles as their organisers wrote them (the app's sample events): data, not the page's text. */
const SAMPLE = { ar: "أمسية خط عربي", en: "Cooking class by the sea" };

/** The same row both ways round: the markup is identical, only dir differs. */
function Row({ dir }: { dir: "ltr" | "rtl" }) {
  return (
    <div
      dir={dir}
      data-testid={`row-${dir}`}
      className="flex items-center gap-3 rounded-lg border border-s-4 border-s-brand p-3 text-sm"
    >
      <span className="font-mono text-xs text-muted-foreground" dir="ltr">
        {`dir="${dir}"`}
      </span>
      <bdi {...langAttrs("ar-EG")} className="font-medium">
        {SAMPLE.ar}
      </bdi>
      <bdi {...langAttrs("en-US")} className="text-muted-foreground">
        {SAMPLE.en}
      </bdi>
      <ChevronRight className="ms-auto size-4 rtl:-scale-x-100" aria-hidden />
    </div>
  );
}

export default function RightToLeftPage() {
  const { path } = useLocale();
  const locales = useLocales();
  const sections = [
    {
      id: "addresses",
      title: (
        <fbt desc="Right-to-left page section title: this page's address in every language">
          One address per language
        </fbt>
      ),
    },
    {
      id: "mirrored",
      title: (
        <fbt desc="Right-to-left page section title: the same markup shown both ways round">
          The same markup, both ways round
        </fbt>
      ),
    },
    {
      id: "how",
      title: (
        <fbt desc="Right-to-left page section title: what right to left takes">What it takes</fbt>
      ),
    },
  ];
  return (
    <div className="min-w-0 space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-medium" data-testid="right-to-left-title">
          <fbt desc="Docs page title: the page about right-to-left languages">Right to left</fbt>
        </h1>
        <p className="text-muted-foreground">
          <fbt desc="Right-to-left page introduction">
            Every language gets its own address, and Arabic reads right to left: the whole site
            mirrors. Here is the same markup both ways round, and what it takes, with the lines that
            do it.
          </fbt>
        </p>
      </div>
      <PageSections sections={sections} />
      <Section id={sections[0].id} title={sections[0].title}>
        <ul className="space-y-2 text-sm" data-testid="addresses">
          {locales.map((l) => (
            <li key={l.segment} className="flex gap-3">
              <span className="w-14 font-mono text-xs text-muted-foreground" dir="ltr">
                {l.dir}
              </span>
              <Link
                href={`/${l.segment}${path}` as RouteUrl}
                className="font-mono text-xs underline"
                dir="ltr"
              >
                {`/${l.segment}${path}`}
              </Link>
            </li>
          ))}
        </ul>
      </Section>
      <Section id={sections[1].id} title={sections[1].title}>
        <p className="text-muted-foreground">
          <fbt desc="Right-to-left page: the two boxes have the same markup, only the direction differs">
            Both boxes are the same markup, written with start and end; only their direction
            differs. The coloured edge, the order and the arrow all follow it.
          </fbt>
        </p>
        <Row dir="ltr" />
        <Row dir="rtl" />
      </Section>
      <Section id={sections[2].id} title={sections[2].title}>
        <Points points={points()} />
        <SkillLink section="strings" />
      </Section>
    </div>
  );
}
