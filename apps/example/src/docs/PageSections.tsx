// A code page's own contents list: its sections, as links to them (a markdown page has @void/md's
// [[toc]] instead). The Intl and Temporal pages give it their sections.
import type { ReactNode } from "react";
import { fbt } from "fbtee";

export function PageSections({ sections }: { sections: { id: string; title: ReactNode }[] }) {
  return (
    <nav aria-labelledby="page-sections" className="border-s ps-4">
      <h2 id="page-sections" className="text-sm font-semibold">
        <fbt desc="Docs: heading over the list of this page's sections">On this page</fbt>
      </h2>
      <ul className="mt-2 space-y-1">
        {sections.map((s) => (
          <li key={s.id}>
            <a
              href={`#${s.id}`}
              className="text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground"
            >
              {s.title}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
