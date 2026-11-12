// The docs index for one language: void-fbtee's docs, as markdown pages under /<locale>/docs/
// (Void's @void/md pages list), in the sidebar's groups. English is the original; the other
// languages are translations.
import { fbt } from "fbtee";
import { ArrowRight } from "lucide-react";
import { Link } from "void-fbtee/react";
import { useDocs } from "@/components/DocsLayout";

export default function DocsIndex() {
  const { groups, href } = useDocs();
  return (
    <div>
      <h1 className="text-4xl font-medium" data-testid="docs-title">
        <fbt desc="Docs index heading">Documentation</fbt>
      </h1>
      <div className="mt-10 grid border-y sm:grid-cols-2" data-testid="docs-pages">
        {groups.map((g, i) => (
          <section
            key={i}
            className="border-b p-6 sm:odd:border-e sm:[&:nth-last-child(-n+2)]:border-b-0"
          >
            <h2 className="text-lg font-medium">{g.name}</h2>
            <ul className="mt-3 space-y-1">
              {g.entries.map((e) => (
                <li key={e.slug}>
                  <Link
                    href={href(e.slug)}
                    className="group inline-flex items-center gap-2 text-muted-foreground transition-colors duration-150 hover:text-foreground"
                  >
                    {e.title}
                    <ArrowRight
                      className="size-4 text-brand transition-transform duration-200 ease-out group-hover:translate-x-0.5 rtl:-scale-x-100 rtl:group-hover:-translate-x-0.5"
                      aria-hidden
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
