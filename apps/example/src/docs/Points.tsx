// A reference page's points: what it takes and why, each with the code that does it, as written in
// its file (the Emails, Strings, Markdown, Translating and Right-to-left pages). The code is shown
// left to right in every language: code reads that way.
import type { ReactNode } from "react";
import { fbt } from "fbtee";
import { SKILL } from "@/shell/project";

export interface Point {
  id: string;
  title: ReactNode;
  why: ReactNode;
  /** Lines copied from the app's files, with the file they're in. */
  code: { file: string; line: string }[];
}

export function Points({ points }: { points: Point[] }) {
  return points.map((p) => (
    <div key={p.id} id={p.id} data-point={p.id} className="space-y-2">
      <h3 className="text-lg font-medium">{p.title}</h3>
      <p className="text-pretty text-muted-foreground">{p.why}</p>
      <div dir="ltr" className="space-y-2 rounded-md bg-muted p-3 font-mono text-xs">
        {p.code.map((c) => (
          <div key={c.file + c.line}>
            <div className="text-muted-foreground">{c.file}</div>
            <code className="break-all">{c.line}</code>
          </div>
        ))}
      </div>
    </div>
  ));
}

/** A page section: its heading (the same text as its entry in PageSections) and contents. */
export function Section({
  id,
  title,
  className = "space-y-6",
  children,
}: {
  id: string;
  title: ReactNode;
  /** Its spacing, space-y-6 if not given. */
  className?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className={`scroll-mt-20 pt-6 ${className}`}>
      <h2 className="border-b pb-2 text-2xl font-medium">{title}</h2>
      {children}
    </section>
  );
}

/** On to void-fbtee's skill, with the package: the full reference for what a page shows at work. */
export function SkillLink({ section }: { section: string }) {
  return (
    <p className="text-sm text-muted-foreground">
      <fbt desc="Docs: link at the end of a page to void-fbtee's skill, its full reference">
        The full reference is in{" "}
        <fbt:param name="link">
          <a href={`${SKILL}#${section}`} className="underline">
            <fbt desc="Docs: link text naming void-fbtee's skill, its full reference">
              void-fbtee's skill
            </fbt>
          </a>
        </fbt:param>.
      </fbt>
    </p>
  );
}
