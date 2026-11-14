// The not-found and error pages' shared frame (pages/_not-found.tsx, pages/_error.tsx): the tab's
// title, the status, a heading, a line under it, and the ways on. These pages take no head(), so
// React's own <title> sets the title (React 19), as the other pages have it ("… · void-fbtee").
import type { ReactNode } from "react";
import { SITE_NAME } from "@/site";

export function ErrorShell({
  testId,
  status,
  heading,
  text,
  children,
}: {
  testId: string;
  status: number;
  /** The heading, also the tab's title: a plain string (fbs), already in the page's language. */
  heading: string;
  text: ReactNode;
  /** The ways on: links and buttons. */
  children: ReactNode;
}) {
  return (
    <>
      <title>{`${heading} · ${SITE_NAME}`}</title>
      <section className="grid max-w-xl gap-6 py-12" data-testid={testId}>
        <p className="text-muted-foreground font-mono text-sm" dir="ltr">
          {status}
        </p>
        <h1 className="text-3xl font-medium text-balance md:text-4xl">{heading}</h1>
        <p className="text-muted-foreground text-pretty">{text}</p>
        <div className="flex flex-wrap gap-3">{children}</div>
      </section>
    </>
  );
}
