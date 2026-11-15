// The Translating page, a reference: how this app gets translated. Its own text and pages by
// Claude Code, into files in the repository (with each catalog's counts, from the loader); what
// people post by Workers AI, as it's posted. With the lines that do it.
import { fbt } from "fbtee";
import type { ReactNode } from "react";
import { routeUrl } from "void-fbtee/routes";
import { Formatted, Link, useLocale } from "void-fbtee/react";
import { DocsPage } from "@/docs/DocsPage";
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

/**
 * Each stage of a Vite+ app's work, and what it does about translations: the same commands on a
 * developer's machine as in CI, so nothing untranslated gets past any of them.
 */
function stages(): { command: string; what: ReactNode; where: string }[] {
  return [
    {
      command: "vp check",
      what: (
        <fbt desc="Translating page: what vp check does about translations">
          Lints with fbtee's own rules: text nobody wrapped for translation is an error.
        </fbt>
      ),
      where: "vite.config.ts",
    },
    {
      command: "vp dev",
      what: (
        <fbt desc="Translating page: what the dev server does about translations">
          Says what's untranslated as you work, and shows an edited translation at once.
        </fbt>
      ),
      where: "vite.config.ts (voidFbtee)",
    },
    {
      command: "vp run i18n:prepare",
      what: (
        <fbt desc="Translating page: what i18n:prepare does">
          Adds every new string to each language's catalog, with the forms that language needs,
          marked new.
        </fbt>
      ),
      where: "package.json",
    },
    {
      command: "vp run i18n:translate",
      what: (
        <fbt desc="Translating page: what i18n:translate does">
          Claude Code translates what's new, strings and markdown pages, by fbtee's own skill.
        </fbt>
      ),
      where: "package.json",
    },
    {
      command: "vp run i18n:check",
      what: (
        <fbt desc="Translating page: what i18n:check does">
          Fails if a string is untranslated or a page's copy is older than its original.
        </fbt>
      ),
      where: "package.json",
    },
    {
      command: "vp build",
      what: (
        <fbt desc="Translating page: what the build does about translations">
          Fails on an untranslated string, so a deploy can't ship one.
        </fbt>
      ),
      where: "vite.config.ts (failOnMissing)",
    },
    {
      command: "CI",
      what: (
        <fbt desc="Translating page: what CI does about translations">
          Runs the same commands on every push: check, i18n:check, build, then deploys and checks
          the live site.
        </fbt>
      ),
      where: ".github/workflows/ci.yml",
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
      id: "vite-plus",
      title: (
        <fbt desc="Translating page section title: translation built into Vite+'s commands">
          Built into Vite+
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
    <DocsPage
      testId="translating-title"
      title={<fbt common>Translating</fbt>}
      intro={
        <fbt desc="Translating page introduction">
          The app's own text is translated by Claude Code, into files in the repository that you
          review. What people post is translated by Workers AI as it's posted. Here is each, with
          the lines that do it.
        </fbt>
      }
      sections={sections}
    >
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
        <p className="text-muted-foreground">
          <fbt desc="Translating page: translation is part of each of Vite+'s commands, the same locally and in CI">
            Translation isn't a separate tool: it's part of each command a Vite+ app already runs,
            the same on your machine as in CI.
          </fbt>
        </p>
        <dl className="divide-y text-sm" data-testid="stages">
          {stages().map((s) => (
            <div key={s.command} className="space-y-1 py-2">
              <dt className="flex flex-wrap items-baseline justify-between gap-x-4" dir="ltr">
                <code className="font-mono text-xs">{s.command}</code>
                <span className="font-mono text-xs text-muted-foreground">{s.where}</span>
              </dt>
              <dd>{s.what}</dd>
            </div>
          ))}
        </dl>
      </Section>
      <Section id={sections[2].id} title={sections[2].title}>
        <Points points={points()} />
        <SkillLink section="translate-a-void-app-with-void-fbtee" />
      </Section>
    </DocsPage>
  );
}
