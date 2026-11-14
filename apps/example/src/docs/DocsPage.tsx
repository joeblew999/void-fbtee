// A code docs page's frame: its title and introduction, anything that goes with them, and its own
// contents list over its sections. Each page passes its own words, as literal fbt elements.
import type { ReactNode } from "react";
import { PageSections } from "@/docs/PageSections";

export function DocsPage({
  testId,
  title,
  intro,
  header,
  lead,
  sections,
  children,
}: {
  /** The title's data-testid, which the browser tests read. */
  testId: string;
  title: ReactNode;
  intro: ReactNode;
  /** Under the introduction, in the page's header: a tally, a note. */
  header?: ReactNode;
  /** Between the header and the contents list. */
  lead?: ReactNode;
  sections: { id: string; title: ReactNode }[];
  children: ReactNode;
}) {
  return (
    <div className="min-w-0 space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-medium" data-testid={testId}>
          {title}
        </h1>
        <p className="text-muted-foreground">{intro}</p>
        {header}
      </div>
      {lead}
      <PageSections sections={sections} />
      {children}
    </div>
  );
}
