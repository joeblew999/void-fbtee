// The docs index for one language: void-fbtee's own docs, as markdown pages under
// /<locale>/docs/ (Void's @void/md pages list). The English pages are the package's docs/ files
// themselves; the other languages are their translations.
import { fbt } from "fbtee";
import pages from "@void/md/pages";
import { useLocale } from "void-fbtee/react";
import Nav from "../../../components/Nav";

export default function DocsIndex() {
  const { locale } = useLocale();
  const docs = pages.filter((p) => p.path.startsWith(`/${locale}/docs/`));
  return (
    <main>
      <Nav page="/docs" />
      <h1 data-testid="docs-title">
        <fbt desc="Docs index heading">Documentation</fbt>
      </h1>
      <ul data-testid="docs-pages">
        {docs.map((p) => (
          <li key={p.path}>
            <a href={p.path}>{p.title}</a>
          </li>
        ))}
      </ul>
    </main>
  );
}
