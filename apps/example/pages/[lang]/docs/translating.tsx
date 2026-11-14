// The Translating page, a reference: how this app gets translated. Its own text and pages by
// Claude Code, into files in the repository (with each catalog's counts, from the loader); what
// people post by Workers AI, as it's posted. With the lines that do it.
import { fbt } from "fbtee";
import { routeUrl } from "void-fbtee/routes";
import { Formatted, Link, useLocale } from "void-fbtee/react";
import { PageSections } from "@/docs/PageSections";
import { Points, Section, SkillLink, type Point } from "@/docs/Points";
import type { Props } from "./translating.server";

function points(): Point[] {
  return [
    {
      id: "claude",
      title: (
        <fbt desc="Translating page point title: the translate script hands the work to Claude Code">
          One command, by Claude Code
        </fbt>
      ),
      why: (
        <fbt desc="Translating page point: the translate script prepares the catalogs and hands the work to Claude Code with void-fbtee's skill">
          vp run i18n:translate collects the new strings into each catalog, then hands the work to
          Claude Code with void-fbtee's skill: the strings, and the markdown pages that changed. The
          app's AGENTS.md says so too, so asking Claude Code to translate the app does the same.
        </fbt>
      ),
      code: [
        { file: "package.json", line: '"i18n:translate": "void-fbtee translate",' },
        {
          file: "AGENTS.md",
          line: '- To translate new strings and pages, run the `i18n:translate` script (or ask: "translate the app"). To see what\'s missing, run `i18n:check`.',
        },
      ],
    },
    {
      id: "review",
      title: (
        <fbt desc="Translating page point title: translations are files to review">
          Files you review
        </fbt>
      ),
      why: (
        <fbt desc="Translating page point: translations are files in the repository, reviewed and committed like code">
          The translations are files in the repository, one catalog per language and a copy of each
          markdown page, so they're reviewed with git diff and committed like code. Nothing is
          translated while a visitor waits.
        </fbt>
      ),
      code: [{ file: "i18n/translations/ar-EG.json", line: '"status": "translated",' }],
    },
    {
      id: "posts",
      title: (
        <fbt desc="Translating page point title: what people post is translated as it's posted">
          What people post, as it's posted
        </fbt>
      ),
      why: (
        <fbt desc="Translating page point: a posted event goes to a queue whose consumer translates it with Workers AI">
          An event someone posts isn't in the repository, so it's translated as it's posted: the
          post goes to a queue, and its consumer asks Workers AI for each of the app's other
          languages, after the poster has their answer.
        </fbt>
      ),
      code: [
        {
          file: "pages/[lang]/events/new.server.ts",
          line: "await queues.translate.send({ eventId: created.id });",
        },
        {
          file: "queues/translate.ts",
          line: 'const MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";',
        },
      ],
    },
  ];
}

export default function TranslatingPage({ catalogs }: Props) {
  const { locale } = useLocale();
  const number = new Intl.NumberFormat(locale);
  const sections = [
    {
      id: "catalogs",
      title: (
        <fbt desc="Translating page section title: this app's catalogs, one per language">
          This app's catalogs
        </fbt>
      ),
    },
    {
      id: "how",
      title: (
        <fbt desc="Translating page section title: how the app is translated">How it's done</fbt>
      ),
    },
  ];
  return (
    <div className="min-w-0 space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-medium" data-testid="translating-title">
          <fbt desc="Docs page title: the page about how the app gets translated">Translating</fbt>
        </h1>
        <p className="text-muted-foreground">
          <fbt desc="Translating page introduction">
            The app's own text is translated by Claude Code, into files in the repository that you
            review. What people post is translated by Workers AI as it's posted. Here is each, with
            the lines that do it.
          </fbt>
        </p>
      </div>
      <PageSections sections={sections} />
      <Section id={sections[0].id} title={sections[0].title}>
        <table className="w-full text-sm" data-testid="catalogs">
          <tbody>
            {catalogs.map((c) => (
              <tr key={c.locale} className="border-b">
                <td className="py-2 pe-4 font-mono text-xs" dir="ltr">
                  {`i18n/translations/${c.locale}.json`}
                </td>
                <td className="py-2">
                  <fbt desc="Translating page: how many of a catalog's strings are translated">
                    <fbt:param name="translated">
                      <Formatted>{number.format(c.translated)}</Formatted>
                    </fbt:param>{" "}
                    of{" "}
                    <fbt:param name="strings">
                      <Formatted>{number.format(c.strings)}</Formatted>
                    </fbt:param>{" "}
                    strings translated
                  </fbt>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-muted-foreground">
          <fbt desc="Translating page: link to the events, whose posts are translated by Workers AI">
            The events are translated by Workers AI:{" "}
            <fbt:param name="link">
              <Link href={routeUrl("/[lang]/events")} className="underline">
                <fbt desc="Translating page: link text to the list of events">see them</fbt>
              </Link>
            </fbt:param>.
          </fbt>
        </p>
      </Section>
      <Section id={sections[1].id} title={sections[1].title}>
        <Points points={points()} />
        <SkillLink section="translate-a-void-app-with-void-fbtee" />
      </Section>
    </div>
  );
}
