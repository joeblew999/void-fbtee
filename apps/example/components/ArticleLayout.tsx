// A single Markdown page (the tour), styled by @void/md's content theme like the docs, without the
// docs sidebar. Each language's tour/ folder has a layout.tsx that re-exports it.
import type { ReactNode } from "react";

export default function ArticleLayout({ children }: { children: ReactNode }) {
  return <article className="void-md mx-auto min-w-0 max-w-3xl">{children}</article>;
}
