// The Markdown pages page, a reference: this site's markdown pages, each with its copy in every
// language (from @void/md's pages list, so a page added shows here by itself), and what it takes,
// with the lines that do it.
import { fbt } from "fbtee";
import pages from "@void/md/pages";
import type { RouteUrl } from "void/routes";
import { langAttrs } from "void-fbtee/locales";
import { Link, useLocales } from "void-fbtee/react";
import { PageSections } from "@/docs/PageSections";
import { Points, Section, SkillLink, type Point } from "@/docs/Points";

function points(): Point[] {
  return [
    {
      id: "copies",
      title: (
        <fbt desc="Markdown page point title: a copy of each page per language">
          A copy per language
        </fbt>
      ),
      why: (
        <fbt desc="Markdown page point: each page has a copy per language at the same path under the language's folder">
          A page is written once under pages/ and the source language, and each language has its
          copy at the same path under its own folder, translated whole: headings, text, and the
          title and description in its frontmatter.
        </fbt>
      ),
      code: [
        { file: "pages/en-US/docs/tour.md", line: "title: The tour" },
        { file: "pages/ar-EG/docs/tour.md", line: "title: جولة" },
      ],
    },
    {
      id: "out-of-date",
      title: (
        <fbt desc="Markdown page point title: a copy whose original changed">
          Out of date, reported
        </fbt>
      ),
      why: (
        <fbt desc="Markdown page point: each copy records which version of the original it was translated from, and check reports it when the original changes">
          Each copy records the version of the original it was translated from. When the original
          changes, void-fbtee check reports the copy as out of date, as the column above would show.
        </fbt>
      ),
      code: [
        {
          file: "packages/void-fbtee/src/check.ts",
          line: 'export const TRANSLATED_FROM = "translatedFrom";',
        },
      ],
    },
    {
      id: "values",
      title: (
        <fbt desc="Markdown page point title: dates and numbers in a markdown page">
          Dates and numbers for each reader
        </fbt>
      ),
      why: (
        <fbt desc="Markdown page point: dates and numbers in a page are islands that format them with Intl, on a line of their own">
          A date or a number in a page isn't written out: it's an island that formats it with Intl
          for the reader. Each island goes on a line of its own, since the page's HTML is cut at
          each one.
        </fbt>
      ),
      code: [
        {
          file: "pages/en-US/docs/tour.md",
          line: 'import Fmt from "../../../src/docs/Fmt.tsx" with { island: "load" }',
        },
        { file: "pages/en-US/docs/tour.md", line: '<Fmt num="1234567.891" />' },
      ],
    },
    {
      id: "links",
      title: (
        <fbt desc="Markdown page point title: links between the site's pages">
          Links stay in the language
        </fbt>
      ),
      why: (
        <fbt desc="Markdown page point: links to the site's own pages are written relative, so each copy's links stay in its language">
          Links to the site's own pages are written relative, never with the language in them, so
          every copy's links stay in its own language.
        </fbt>
      ),
      code: [
        {
          file: "pages/en-US/docs/tour.md",
          line: "Back to [every time, twice](./tour.md#times), or [see the upcoming events](../events).",
        },
      ],
    },
  ];
}

/** Every markdown page under docs/, once, with its copy in each language (or none). */
function copies(segments: string[]) {
  const byPath = new Map<string, Map<string, (typeof pages)[number]>>();
  for (const page of pages) {
    const [, segment, ...rest] = page.path.split("/");
    if (!segments.includes(segment)) continue;
    const path = rest.join("/");
    if (!byPath.has(path)) byPath.set(path, new Map());
    byPath.get(path)!.set(segment, page);
  }
  return [...byPath].map(([path, bySegment]) => ({ path, bySegment }));
}

export default function MarkdownPage() {
  const locales = useLocales();
  const all = copies(locales.map((l) => l.segment));
  const sections = [
    {
      id: "pages",
      title: (
        <fbt desc="Markdown page section title: this site's markdown pages and their copies">
          This site's pages
        </fbt>
      ),
    },
    {
      id: "how",
      title: (
        <fbt desc="Markdown page section title: what translated markdown pages take">
          What it takes
        </fbt>
      ),
    },
  ];
  return (
    <div className="min-w-0 space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-medium" data-testid="markdown-title">
          <fbt desc="Docs page title: the page about translated markdown pages">Markdown pages</fbt>
        </h1>
        <p className="text-muted-foreground">
          <fbt desc="Markdown page introduction">
            A page written in markdown has a copy in each language, translated whole. Here are this
            site's, and what it takes, with the lines that do it.
          </fbt>
        </p>
      </div>
      <PageSections sections={sections} />
      <Section id={sections[0].id} title={sections[0].title}>
        {all.map(({ path, bySegment }) => (
          <table key={path} className="w-full text-sm" data-testid="markdown-copies">
            <caption className="pb-2 text-start font-mono text-xs text-muted-foreground" dir="ltr">
              {`${path}.md`}
            </caption>
            <tbody>
              {locales.map((l) => {
                const page = bySegment.get(l.segment);
                const from = page?.frontmatter.translatedFrom;
                return (
                  <tr key={l.segment} className="border-b">
                    <td className="py-2 pe-4 font-mono text-xs" dir="ltr">
                      {l.locale}
                    </td>
                    <td className="py-2 pe-4">
                      {page ? (
                        <Link href={page.path as RouteUrl} {...langAttrs(l.locale)}>
                          {page.title}
                        </Link>
                      ) : (
                        <fbt desc="Markdown page: this language has no copy of the page yet">
                          not translated yet
                        </fbt>
                      )}
                    </td>
                    <td className="py-2 text-xs text-muted-foreground">
                      {typeof from === "string" ? (
                        <bdi dir="ltr" className="font-mono">{`translatedFrom: ${from}`}</bdi>
                      ) : (
                        <fbt desc="Markdown page: this copy is the original that the others are translated from">
                          the original
                        </fbt>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ))}
      </Section>
      <Section id={sections[1].id} title={sections[1].title}>
        <Points points={points()} />
        <SkillLink section="markdown-pages" />
      </Section>
    </div>
  );
}
