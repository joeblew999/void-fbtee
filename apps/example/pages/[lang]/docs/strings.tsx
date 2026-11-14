// The Strings page, a reference: how the site's text is translated with fbtee through void-fbtee,
// with one plural shown in this page's language (Arabic has six forms), and the lines that do it.
import { fbt } from "fbtee";
import { PageSections } from "@/docs/PageSections";
import { Points, Section, SkillLink, type Point } from "@/docs/Points";
import { Formatted, useLocale } from "void-fbtee/react";

const COUNTS = [0, 1, 2, 3, 11, 100];

function points(): Point[] {
  return [
    {
      id: "mark",
      title: (
        <fbt desc="Strings page point title: text is marked in the code">Marked in the code</fbt>
      ),
      why: (
        <fbt desc="Strings page point: text in components is written in fbt elements, each with a description for the translator">
          Text in a component is written inside an fbt element, with a description that tells the
          translator where it shows and what it means. void-fbtee prepare collects every one into
          each language's catalog, i18n/translations, a file in the app's repository.
        </fbt>
      ),
      code: [
        {
          file: "src/home/HomeSections.tsx",
          line: '<fbt desc="Home feature title: translated strings">Strings, by fbtee</fbt>',
        },
      ],
    },
    {
      id: "plain",
      title: <fbt desc="Strings page point title: plain strings for attributes">Plain strings</fbt>,
      why: (
        <fbt desc="Strings page point: fbs gives a plain string, for attributes, titles and emails">
          Where a plain string is needed, in an attribute, a page title or an email, fbs gives it,
          translated the same way.
        </fbt>
      ),
      code: [
        {
          file: "src/events/EventsCrumbs.tsx",
          line: 'aria-label={fbs("Where you are", "Label of the row showing where you are on the site")}',
        },
      ],
    },
    {
      id: "plurals",
      title: <fbt desc="Strings page point title: plurals">Plurals, each language's own</fbt>,
      why: (
        <fbt desc="Strings page point: a count has one translation per plural form the language uses">
          A sentence with a count gets one translation for each plural form the language has: one in
          Thai, two in English, six in Arabic. void-fbtee prepare adds the lines each language
          needs, and the reader's count picks the right one, as in the table above.
        </fbt>
      ),
      code: [
        {
          file: "pages/[lang]/index.tsx",
          line: '<fbt:plural count={count} many="nights" showCount="yes">',
        },
      ],
    },
    {
      id: "common",
      title: (
        <fbt desc="Strings page point title: words used on many pages">Common words, once</fbt>
      ),
      why: (
        <fbt desc="Strings page point: a word used on many pages is given once to voidFbtee and translated once">
          A word used on many pages, as the menu's, is given once to voidFbtee in vite.config.ts,
          with its description, and is translated once.
        </fbt>
      ),
      code: [
        {
          file: "vite.config.ts",
          line: "voidFbtee({ sourceLocale, locales, site: SITE, common }),",
        },
        { file: "src/shell/SiteHeader.tsx", line: "return <fbt common>Events</fbt>;" },
      ],
    },
    {
      id: "check",
      title: <fbt desc="Strings page point title: finding what's untranslated">Nothing missed</fbt>,
      why: (
        <fbt desc="Strings page point: void-fbtee check lists what is untranslated, and the lint rules catch text not marked">
          void-fbtee check lists every string still untranslated in any language, and fbtee's lint
          rules report text written in a component without fbt.
        </fbt>
      ),
      code: [{ file: "package.json", line: '"i18n:check": "void-fbtee check",' }],
    },
  ];
}

export default function StringsPage() {
  const { locale } = useLocale();
  const rules = new Intl.PluralRules(locale);
  const number = new Intl.NumberFormat(locale);
  const sections = [
    {
      id: "plurals-shown",
      title: (
        <fbt desc="Strings page section title: one sentence with a count, shown for several counts">
          One sentence, every count
        </fbt>
      ),
    },
    {
      id: "how",
      title: (
        <fbt desc="Strings page section title: what translated strings take">What it takes</fbt>
      ),
    },
  ];
  return (
    <div className="min-w-0 space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-medium" data-testid="strings-title">
          <fbt desc="Docs page title: the page about translated strings">Strings</fbt>
        </h1>
        <p className="text-muted-foreground">
          <fbt desc="Strings page introduction">
            Every word on this site is marked in the code with fbtee, and each language has a
            catalog file with its translations. Here is what that takes, with the lines that do it.
          </fbt>
        </p>
      </div>
      <PageSections sections={sections} />
      <Section id={sections[0].id} title={sections[0].title}>
        <p className="text-muted-foreground">
          <fbt desc="Strings page: the table shows one plural sentence for several counts, in this page's language">
            The same sentence for six counts, in this page's language. The second column is the
            plural form the language puts each count in, as Intl.PluralRules names it.
          </fbt>
        </p>
        <table className="w-full text-sm" data-testid="plurals">
          <tbody>
            {COUNTS.map((count) => (
              <tr key={count} className="border-b">
                <td className="w-16 py-2 pe-4 tabular-nums">
                  <Formatted>{number.format(count)}</Formatted>
                </td>
                <td className="w-20 py-2 pe-4 text-start font-mono text-xs text-muted-foreground">
                  <bdi dir="ltr">{rules.select(count)}</bdi>
                </td>
                <td className="py-2">
                  <fbt desc="How many nights are booked">
                    You booked{" "}
                    <fbt:plural count={count} many="nights" showCount="yes">
                      night
                    </fbt:plural>
                  </fbt>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>
      <Section id={sections[1].id} title={sections[1].title}>
        <Points points={points()} />
        <SkillLink section="strings" />
      </Section>
    </div>
  );
}
