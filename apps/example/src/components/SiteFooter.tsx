// The site footer, in the root layout, in link columns as Void's own site has: the docs pages (from
// the docs sidebar, so it matches), the project, and what the example is made with.
import { routeUrl } from "void/routes";
import type { ReactNode } from "react";
import { fbt } from "fbtee";
import { Link, useLocale } from "void-fbtee/react";
import { useDocs } from "@/components/DocsLayout";
import { RELEASES, REPO } from "@/lib/project";

/** What the example is made with (names, not translated). */
const TOOLS = [
  ["Void", "https://void.cloud"],
  ["Vite+", "https://viteplus.dev"],
  ["fbtee", "https://github.com/nkzw-tech/fbtee"],
  ["Temporal", "https://tc39.es/proposal-temporal/docs/"],
  ["shadcn/ui", "https://ui.shadcn.com"],
] as const;

const linkClass =
  "text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground";

function Column({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-sm font-semibold">{title}</h2>
      <ul className="mt-3 space-y-2">{children}</ul>
    </section>
  );
}

export default function SiteFooter() {
  const { lang } = useLocale();
  const { groups } = useDocs();
  return (
    <footer className="mt-12 border-t">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:grid-cols-3">
        <Column title={<fbt desc="Footer column heading: the documentation pages">Docs</fbt>}>
          {groups
            .flatMap((g) => g.entries)
            .map((e) => (
              <li key={e.slug}>
                <Link href={e.href} className={linkClass}>
                  {e.title}
                </Link>
              </li>
            ))}
        </Column>
        <Column
          title={
            <fbt desc="Footer column heading: links about the void-fbtee project">Project</fbt>
          }
        >
          <li>
            <Link href={routeUrl("/[lang]/events", { params: { lang } })} className={linkClass}>
              <fbt desc="Navigation: the list of events people post and book">Events</fbt>
            </Link>
          </li>
          <li>
            <a href={REPO} className={linkClass}>
              GitHub
            </a>
          </li>
          <li>
            <a href={RELEASES} className={linkClass}>
              <fbt desc="Footer link: the project's releases on GitHub">Releases</fbt>
            </a>
          </li>
        </Column>
        <Column
          title={
            <fbt desc="Footer column heading: the tools this example is built with">Built with</fbt>
          }
        >
          {TOOLS.map(([name, url]) => (
            <li key={name}>
              <a href={url} className={linkClass}>
                {name}
              </a>
            </li>
          ))}
        </Column>
      </div>
    </footer>
  );
}
