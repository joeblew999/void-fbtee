// The docs layout (a directory layout.tsx in each language's docs/ re-exports it): the sidebar and
// the page, as Void's guide lays out markdown docs (pages-routing/markdown.md, "Building a
// Sidebar"). A page's own contents list is the page's: [[toc]] in a markdown page (@void/md), the
// sections list in the Intl and Temporal pages. No JavaScript: markdown pages are server-rendered,
// and the phone's page menu is a <details>. Markdown is styled by @void/md's content theme in the
// site's colours (pages/style.css).
import type { ReactNode } from "react";
import { fbt } from "fbtee";
import { ChevronDown } from "lucide-react";
import { useFrontmatter } from "@void/md";
import pages from "@void/md/pages";
import { Temporal } from "temporal-polyfill";
import { routeUrl, type RouteUrl } from "void/routes";
import type { Lang } from "void-fbtee/locales";
import { Formatted, Link, useLocale } from "void-fbtee/react";
import { cn } from "@/lib/utils";

interface Entry {
  /** The page under /<lang>/docs/: which entry is current. */
  slug: string;
  title: ReactNode;
  /** Its link, built by routeUrl: checked by Void's typed routes. */
  href: RouteUrl;
}

/**
 * The sidebar: its groups, and the pages in each. Intl and Temporal are pages under [lang]. The
 * markdown pages are this language's own files under pages/<lang>/docs/, from @void/md's pages
 * list, as Void's guide builds a sidebar (pages-routing/markdown.md, "Building a Sidebar"): a
 * page added or translated appears with its own title, with no list to keep here. How to set up
 * and use void-fbtee is in its own README and skill, with the package; these pages show it at work.
 */
function sidebar(lang: Lang) {
  const prefix = `/${lang}/docs/`;
  const markdown = pages
    .filter((p) => p.path.startsWith(prefix))
    // The path of a page Void found: a route by definition (Void's pages list has no route type).
    .map((p): Entry => ({
      slug: p.path.slice(prefix.length),
      title: p.title,
      href: p.path as RouteUrl,
    }));
  return [
    {
      name: <fbt desc="Docs sidebar group: reference pages">Reference</fbt>,
      entries: [
        { slug: "intl", title: "Intl", href: routeUrl("/[lang]/docs/intl", { params: { lang } }) },
        {
          slug: "temporal",
          title: "Temporal",
          href: routeUrl("/[lang]/docs/temporal", { params: { lang } }),
        },
      ],
    },
    {
      name: (
        <fbt desc="Docs sidebar group: the events app that demonstrates void-fbtee">The demo</fbt>
      ),
      entries: markdown,
    },
  ];
}

/** This language's docs: the sidebar, and the markdown page at the current path (if it is one). */
export function useDocs() {
  const { lang, path } = useLocale();
  const groups = sidebar(lang);
  const current = path.replace(/^\/docs\/?/, "");
  const page = pages.find((p) => p.path === `/${lang}/docs/${current}`);
  return { groups, current, page };
}

/** The sidebar's groups and links. */
function Sidebar({ groups, current }: Pick<ReturnType<typeof useDocs>, "groups" | "current">) {
  return (
    <div className="space-y-6">
      {groups.map((g, i) => (
        <section key={i}>
          <h2 className="text-sm font-semibold">{g.name}</h2>
          <ul className="mt-2 space-y-1">
            {g.entries.map((e) => (
              <li key={e.slug}>
                <Link
                  href={e.href}
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

/**
 * When a markdown page was last changed: its frontmatter's `updated`, a plain date (data, the same
 * in every copy), read with @void/md's useFrontmatter() (Void wraps the layouts in it) and
 * formatted in the page's language.
 */
function Updated() {
  const { locale } = useLocale();
  const { updated } = useFrontmatter() as { updated?: string };
  if (!updated) return null;
  const date = Temporal.PlainDate.from(updated).toLocaleString(locale, { dateStyle: "long" });
  return (
    <p className="mt-12 border-t pt-4 text-sm text-muted-foreground" data-testid="docs-updated">
      <fbt desc="Docs: when this page was last changed; date is a date, written out">
        Updated{" "}
        <fbt:param name="date">
          <Formatted>{date}</Formatted>
        </fbt:param>
      </fbt>
    </p>
  );
}

export default function DocsLayout({ children }: { children: ReactNode }) {
  const docs = useDocs();
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-8 md:grid-cols-[13rem_minmax(0,1fr)] md:gap-10">
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
        {docs.page ? (
          <>
            <article className="void-md">{children}</article>
            <Updated />
          </>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
