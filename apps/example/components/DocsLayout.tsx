// The docs layout (a directory layout.tsx in each language's docs/ re-exports it): a sidebar with
// that language's docs pages (@void/md/pages), and the page. Markdown is styled by @void/md's own
// content theme, scoped to .void-md, with its colours set to shadcn's (pages/style.css).
import type { ReactNode } from "react";
import pages from "@void/md/pages";
import { Link, useLocale } from "void-fbtee/react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function DocsLayout({ children }: { children: ReactNode }) {
  const { locale, path } = useLocale();
  const docs = pages.filter((p) => p.path.startsWith(`/${locale}/docs/`));
  const isIndex = path === "/docs";
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 md:grid-cols-[13rem_minmax(0,1fr)] md:gap-10">
      <aside>
        <nav className="-mx-4 flex gap-1 overflow-x-auto px-4 md:sticky md:top-20 md:mx-0 md:flex-col md:px-0">
          {docs.map((p) => (
            <Link
              key={p.path}
              href={p.path as never}
              aria-current={`/${locale}${path}` === p.path ? "page" : undefined}
              className={cn(
                buttonVariants({
                  variant: `/${locale}${path}` === p.path ? "secondary" : "ghost",
                  size: "sm",
                }),
                "shrink-0 justify-start",
              )}
            >
              {p.title}
            </Link>
          ))}
        </nav>
      </aside>
      {isIndex ? <div>{children}</div> : <article className="void-md min-w-0">{children}</article>}
    </div>
  );
}
