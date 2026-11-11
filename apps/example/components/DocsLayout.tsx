// The docs layout (a directory layout.tsx in each language's docs/ re-exports it), laid out like
// VitePress, the Vite family's docs: a grouped sidebar, the page, "On this page" from its headings,
// and the previous and next pages. The sidebar is set here, as VitePress sets it in its config;
// titles and headings come from each language's markdown (@void/md/pages), so a translated page
// fills its own sidebar. No JavaScript: markdown pages are server-rendered, and the phone's page
// menu is a <details>. Markdown is styled by @void/md's content theme in the site's colours
// (pages/style.css).
import type { ReactNode } from "react";
import { fbt } from "fbtee";
import { ChevronDown } from "lucide-react";
import pages from "@void/md/pages";
import { Link, useLocale } from "void-fbtee/react";
import { SECTIONS } from "@/lib/formats";
import { sectionTitle } from "@/lib/formats-titles";
import { cn } from "@/lib/utils";

interface Entry {
  /** The page under /<locale>/docs/. */
  slug: string;
  title: ReactNode;
}

/** The sidebar: its groups, and the pages in each, in reading order. */
function sidebar(title: (slug: string) => ReactNode) {
  const entries = (...slugs: string[]): Entry[] =>
    slugs.map((slug) => ({ slug, title: title(slug) }));
  return [
    {
      name: <fbt desc="Docs sidebar group: the first page to read">Start here</fbt>,
      entries: entries("setup"),
    },
    {
      name: <fbt desc="Docs sidebar group: how-to pages">Guides</fbt>,
      entries: entries("strings", "markdown-pages"),
    },
    {
      name: <fbt desc="Docs sidebar group: reference pages">Reference</fbt>,
      entries: [
        {
          slug: "formats",
          title: <fbt desc="Navigation: the page that shows every Intl format">Formats</fbt>,
        },
      ],
    },
    {
      name: (
        <fbt desc="Docs sidebar group: the events app that demonstrates void-fbtee">The demo</fbt>
      ),
      entries: entries("tour"),
    },
  ];
}

interface Heading {
  depth: number;
  slug: string;
  text: ReactNode;
}

/** "On this page" for the docs pages that aren't markdown (markdown pages list their own). */
const OUTLINES: Record<string, () => Heading[]> = {
  formats: () => SECTIONS.map((s) => ({ depth: 2, slug: s.id, text: sectionTitle(s.id) })),
};

/** This language's docs: the sidebar, and the markdown page at the current path (if it is one). */
export function useDocs() {
  const { locale, path } = useLocale();
  const md = (slug: string) => pages.find((p) => p.path === `/${locale}/docs/${slug}`);
  const groups = sidebar((slug) => md(slug)?.title ?? slug);
  const href = (slug: string) => `/${locale}/docs/${slug}`;
  const current = path.replace(/^\/docs\/?/, "");
  const page = md(current);
  const headings: readonly Heading[] | undefined = page?.headings ?? OUTLINES[current]?.();
  return { groups, href, current, page, headings };
}

/** The sidebar's groups and links. */
function Sidebar({
  groups,
  href,
  current,
}: Pick<ReturnType<typeof useDocs>, "groups" | "href" | "current">) {
  return (
    <div className="space-y-6">
      {groups.map((g, i) => (
        <section key={i}>
          <h2 className="text-sm font-semibold">{g.name}</h2>
          <ul className="mt-2 space-y-1">
            {g.entries.map((e) => (
              <li key={e.slug}>
                <Link
                  href={href(e.slug) as never}
                  aria-current={e.slug === current ? "page" : undefined}
                  className={cn(
                    "block py-1 text-sm transition-colors duration-150 hover:text-foreground",
                    e.slug === current ? "font-medium text-brand" : "text-muted-foreground",
                  )}
                >
                  {e.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/** "On this page": the page's section headings, as links to them. */
function Outline({ headings }: { headings: readonly Heading[] }) {
  const shown = headings.filter((h) => h.depth === 2 || h.depth === 3);
  if (shown.length < 2) return null;
  return (
    <nav className="sticky top-20 border-s ps-4" aria-labelledby="outline">
      <h2 id="outline" className="text-sm font-semibold">
        <fbt desc="Docs: heading over the list of this page's sections">On this page</fbt>
      </h2>
      <ul className="mt-2 space-y-1">
        {shown.map((h) => (
          <li key={h.slug} className={h.depth === 3 ? "ps-3" : undefined}>
            <a
              href={`#${h.slug}`}
              className="block py-0.5 text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground"
            >
              {h.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** The previous and next pages in the sidebar's order. */
function PrevNext({
  groups,
  href,
  current,
}: Pick<ReturnType<typeof useDocs>, "groups" | "href" | "current">) {
  const all = groups.flatMap((g) => g.entries);
  const i = all.findIndex((e) => e.slug === current);
  if (i < 0) return null;
  const [prev, next] = [all[i - 1], all[i + 1]];
  const box = "block rounded-md border p-4 transition-colors duration-150 hover:border-brand";
  return (
    <nav className="mt-16 grid gap-4 border-t pt-8 sm:grid-cols-2">
      {prev ? (
        <Link href={href(prev.slug) as never} className={box} data-testid="docs-prev">
          <span className="text-xs text-muted-foreground">
            <fbt desc="Docs: label on the link to the previous page">Previous page</fbt>
          </span>
          <span className="mt-1 block font-medium text-brand">{prev.title}</span>
        </Link>
      ) : (
        <span />
      )}
      {next && (
        <Link
          href={href(next.slug) as never}
          className={cn(box, "text-end")}
          data-testid="docs-next"
        >
          <span className="text-xs text-muted-foreground">
            <fbt desc="Docs: label on the link to the next page">Next page</fbt>
          </span>
          <span className="mt-1 block font-medium text-brand">{next.title}</span>
        </Link>
      )}
    </nav>
  );
}

export default function DocsLayout({ children }: { children: ReactNode }) {
  const docs = useDocs();
  const isIndex = docs.current === "";
  // A third column for "On this page" when the page has one.
  const outline = !isIndex && docs.headings;
  return (
    <div
      className={cn(
        "grid grid-cols-[minmax(0,1fr)] gap-8 md:grid-cols-[13rem_minmax(0,1fr)] md:gap-10",
        outline && "xl:grid-cols-[13rem_minmax(0,1fr)_12rem]",
      )}
    >
      {/* On a phone: the pages in a menu that opens, above the page. */}
      <details className="group border-y md:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between py-3 text-sm font-medium">
          <fbt desc="Docs: the menu of documentation pages on a phone">Pages</fbt>
          <ChevronDown
            className="size-4 text-muted-foreground transition-transform duration-200 group-open:rotate-180"
            aria-hidden
          />
        </summary>
        <div className="pb-4">
          <Sidebar {...docs} />
        </div>
      </details>
      <aside className="hidden md:block">
        <nav className="sticky top-20">
          <Sidebar {...docs} />
        </nav>
      </aside>
      <div className="min-w-0">
        {isIndex || !docs.page ? children : <article className="void-md">{children}</article>}
        {!isIndex && <PrevNext {...docs} />}
      </div>
      {outline && (
        <aside className="hidden xl:block">
          <Outline headings={docs.headings!} />
        </aside>
      )}
    </div>
  );
}
