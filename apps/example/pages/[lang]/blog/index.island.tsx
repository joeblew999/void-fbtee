// The blog index for one language: every markdown post under /<locale>/blog/, from Void's
// @void/md/pages list. Static HTML, no islands, plain <a> links (island pages have no router).
import { fbt } from "fbtee";
import pages from "@void/md/pages";
import { useLocale } from "void-fbtee/react";

export default function BlogIndex() {
  const { locale } = useLocale();
  const posts = pages.filter((p) => p.path.startsWith(`/${locale}/blog/`));
  return (
    <main>
      <h1 data-testid="blog-title">
        <fbt desc="Blog index heading">Blog</fbt>
      </h1>
      <ul data-testid="blog-posts">
        {posts.map((p) => (
          <li key={p.path}>
            <a href={p.path}>{p.title}</a>
          </li>
        ))}
      </ul>
    </main>
  );
}
